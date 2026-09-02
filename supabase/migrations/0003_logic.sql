-- 0003_logic.sql — Business logic in the database (docs/DATA-MODEL.md §4, §6, §7):
-- checklist status function + views, engine hours, maintenance log views, dashboard stats,
-- template instantiation, imported-log review, trash purge, business triggers, realtime.
-- Covers BACKLOG E3-1, E4-1 (SQL side), E4-7 (publication) and the boat_invitations_safe view (E1-5).

-- ---------------------------------------------------------------------------------------------
-- anon never sees public objects, including those created from now on
-- ---------------------------------------------------------------------------------------------
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on functions from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------------------------
-- Checklist status: one pure function, used by the view and mirrored in src/lib/checklist-status.ts
-- ---------------------------------------------------------------------------------------------
create type public.checklist_state as enum ('never', 'ok', 'soon', 'overdue');

create or replace function public.checklist_compute_status(
  p_last_completed_at date,
  p_interval_months int,
  p_last_engine_hours numeric,
  p_interval_hours int,
  p_current_hours numeric,
  p_today date default current_date,
  out due_at date,
  out due_hours numeric,
  out days_remaining int,
  out hours_remaining numeric,
  out status public.checklist_state
)
language plpgsql immutable
set search_path = ''
as $$
begin
  if p_last_completed_at is null then
    status := 'never';
    return;
  end if;
  if p_interval_months is not null then
    due_at := (p_last_completed_at + make_interval(months => p_interval_months))::date;
    days_remaining := due_at - p_today;
  end if;
  if p_interval_hours is not null and p_last_engine_hours is not null then
    due_hours := p_last_engine_hours + p_interval_hours;
    if p_current_hours is not null then
      hours_remaining := due_hours - p_current_hours;
    end if;
  end if;
  if days_remaining < 0 or hours_remaining < 0 then
    status := 'overdue';
  elsif days_remaining <= 30 or hours_remaining <= 25 then
    status := 'soon';
  else
    status := 'ok';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Views (all security_invoker: the caller's RLS applies)
-- ---------------------------------------------------------------------------------------------
-- 6.1 current hours per engine = latest reading not carried by a trashed log
create or replace view public.engine_current_hours
with (security_invoker = true) as
select distinct on (r.engine_id)
  r.engine_id,
  r.boat_id,
  r.hours,
  r.read_at,
  r.source,
  r.id as reading_id
from public.engine_hour_readings r
left join public.maintenance_logs l on l.id = r.maintenance_log_id
where l.id is null or l.deleted_at is null
order by r.engine_id, r.read_at desc, r.created_at desc;

-- 6.2 status of every active item of an active category
create or replace view public.checklist_item_status
with (security_invoker = true) as
with last_completion as (
  select distinct on (c.checklist_item_id)
    c.checklist_item_id,
    c.id as completion_id,
    c.completed_at,
    c.completed_by,
    c.completed_by_name,
    c.engine_hours,
    c.note
  from public.checklist_completions c
  order by c.checklist_item_id, c.completed_at desc, c.created_at desc
),
base as (
  select
    i.id,
    i.boat_id,
    i.category_id,
    i.label,
    i.description,
    i.interval_months,
    i.interval_hours,
    i.engine_id,
    i.actions,
    i.source,
    i.template_item_id,
    i.sort_order,
    lc.completion_id as last_completion_id,
    lc.completed_at as last_completed_at,
    lc.completed_by as last_completed_by,
    coalesce(lc.completed_by_name, p.full_name, p.email) as last_completed_by_name,
    lc.engine_hours as last_engine_hours,
    lc.note as last_note,
    ech.hours as current_hours,
    (public.checklist_compute_status(
      lc.completed_at, i.interval_months, lc.engine_hours, i.interval_hours, ech.hours, current_date
    )).*
  from public.checklist_items i
  join public.boat_categories cat on cat.id = i.category_id
  left join last_completion lc on lc.checklist_item_id = i.id
  left join public.profiles p on p.id = lc.completed_by
  left join public.engine_current_hours ech on ech.engine_id = i.engine_id
  where i.is_active and cat.is_active
)
select
  b.id,
  b.boat_id,
  b.category_id,
  b.label,
  b.description,
  b.interval_months,
  b.interval_hours,
  b.engine_id,
  b.actions,
  b.source,
  b.template_item_id,
  b.sort_order,
  b.last_completion_id,
  b.last_completed_at,
  b.last_completed_by,
  b.last_completed_by_name,
  b.last_engine_hours,
  b.last_note,
  b.current_hours,
  b.due_at,
  b.due_hours,
  b.days_remaining,
  b.hours_remaining,
  b.status
from base b;

-- 6.2 progress per active category (progress null when the category has no active item)
create or replace view public.checklist_category_progress
with (security_invoker = true) as
select
  c.id as category_id,
  c.boat_id,
  c.name,
  c.color,
  c.icon,
  c.sort_order,
  count(s.id)::int as total,
  count(s.id) filter (where s.status = 'ok')::int as ok_count,
  count(s.id) filter (where s.status = 'soon')::int as soon_count,
  count(s.id) filter (where s.status = 'overdue')::int as overdue_count,
  count(s.id) filter (where s.status = 'never')::int as never_count,
  (count(s.id) filter (where s.status in ('ok', 'soon')))::numeric / nullif(count(s.id), 0) as progress
from public.boat_categories c
left join public.checklist_item_status s on s.category_id = c.id
where c.is_active
group by c.id, c.boat_id, c.name, c.color, c.icon, c.sort_order;

-- 6.3 maintenance logs with their context
create or replace view public.maintenance_logs_view
with (security_invoker = true) as
select
  l.id,
  l.boat_id,
  l.title,
  l.category_id,
  cat.name as category_name,
  cat.color as category_color,
  cat.is_active as category_is_active,
  l.status,
  l.priority,
  l.performed_at,
  l.next_due_at,
  l.cost,
  l.currency,
  l.contact_id,
  ct.name as contact_name,
  l.haul_out_id,
  l.notes,
  l.needs_review,
  l.pending_engine_hours,
  l.external_ref,
  l.created_by,
  coalesce(p.full_name, p.email) as created_by_name,
  l.updated_by,
  l.created_at,
  l.updated_at,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('engine_id', r.engine_id, 'label', e.label, 'hours', r.hours) order by e.sort_order)
      from public.engine_hour_readings r
      join public.engines e on e.id = r.engine_id
      where r.maintenance_log_id = l.id
    ),
    '[]'::jsonb
  ) as engine_hours,
  (select count(*)::int from public.checklist_completions cc where cc.maintenance_log_id = l.id) as completions_count,
  (select count(*)::int from public.attachments a where a.entity_type = 'maintenance_log' and a.entity_id = l.id) as attachments_count,
  (select count(*)::int from public.purchases pu where pu.maintenance_log_id = l.id and pu.deleted_at is null) as purchases_count
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
left join public.contacts ct on ct.id = l.contact_id
left join public.profiles p on p.id = l.created_by
where l.deleted_at is null;

-- trash (30 days)
create or replace view public.maintenance_logs_trash_view
with (security_invoker = true) as
select
  l.id,
  l.boat_id,
  l.title,
  l.category_id,
  cat.name as category_name,
  cat.color as category_color,
  l.status,
  l.performed_at,
  l.cost,
  l.deleted_at,
  l.updated_by as deleted_by,
  coalesce(p.full_name, p.email) as deleted_by_name
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
left join public.profiles p on p.id = l.updated_by
where l.deleted_at is not null and l.deleted_at > now() - interval '30 days';

-- 6.4 invitations without the token
create or replace view public.boat_invitations_safe
with (security_invoker = true) as
select
  i.id,
  i.boat_id,
  i.email,
  i.role,
  i.invited_by,
  coalesce(p.full_name, p.email) as invited_by_name,
  i.expires_at,
  i.accepted_at,
  i.accepted_by,
  i.revoked_at,
  i.created_at,
  case
    when i.accepted_at is not null then 'accepted'
    when i.revoked_at is not null then 'revoked'
    when i.expires_at < now() then 'expired'
    else 'pending'
  end as status
from public.boat_invitations i
left join public.profiles p on p.id = i.invited_by;

-- 6.5 expenses: logs + purchases + haul-outs
create or replace view public.expenses_by_category
with (security_invoker = true) as
select
  l.boat_id,
  l.category_id,
  cat.name as category_name,
  cat.color as category_color,
  'log'::text as source,
  null::public.purchase_kind as purchase_kind,
  l.performed_at as date,
  l.cost as amount,
  l.currency,
  l.id as entity_id,
  l.title as label
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
where l.deleted_at is null and l.cost is not null
union all
select
  pu.boat_id,
  pu.category_id,
  cat.name,
  cat.color,
  'purchase',
  pu.kind,
  pu.purchased_at,
  pu.amount,
  pu.currency,
  pu.id,
  pu.designation
from public.purchases pu
left join public.boat_categories cat on cat.id = pu.category_id
where pu.deleted_at is null and pu.amount is not null
union all
select
  h.boat_id,
  null,
  null,
  null,
  'haul_out',
  null,
  h.started_at,
  h.cost,
  h.currency,
  h.id,
  coalesce(h.yard_name, h.works)
from public.haul_outs h
where h.deleted_at is null and h.cost is not null;

-- 6.6 dashboard stats per boat
create or replace view public.boat_dashboard_stats
with (security_invoker = true) as
select
  b.id as boat_id,
  (select count(*)::int from public.checklist_item_status s where s.boat_id = b.id and s.status = 'overdue') as overdue_items,
  (select count(*)::int from public.checklist_item_status s where s.boat_id = b.id and s.status = 'soon') as soon_items,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.status = 'planned') as planned_logs,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.status = 'in_progress') as in_progress_logs,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.status = 'urgent') as urgent_logs,
  coalesce((select sum(e.amount) from public.expenses_by_category e where e.boat_id = b.id and e.date >= date_trunc('year', current_date)::date), 0)::numeric(12,2) as ytd_expenses,
  (select max(h.started_at) from public.haul_outs h where h.boat_id = b.id and h.deleted_at is null) as last_haul_out_at,
  (
    select (extract(year from age(current_date, max(h.started_at))) * 12 + extract(month from age(current_date, max(h.started_at))))::int
    from public.haul_outs h where h.boat_id = b.id and h.deleted_at is null
  ) as months_since_haul_out,
  (select count(*)::int from public.parts pa where pa.boat_id = b.id and pa.min_quantity > 0 and pa.quantity <= pa.min_quantity) as low_stock_parts
from public.boats b;

-- ---------------------------------------------------------------------------------------------
-- Business triggers
-- ---------------------------------------------------------------------------------------------
-- engine_hours is mandatory when the item has an hour interval
create or replace function public.check_completion_hours()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_interval_hours int;
begin
  select i.interval_hours into v_interval_hours from public.checklist_items i where i.id = new.checklist_item_id;
  if v_interval_hours is not null and new.engine_hours is null then
    raise exception 'engine_hours_required' using errcode = '23514',
      detail = 'This checklist item has an interval in engine hours: engine_hours is required';
  end if;
  return new;
end;
$$;

create trigger check_completion_hours
  before insert or update on public.checklist_completions
  for each row execute function public.check_completion_hours();

-- a completion with hours (not linked to a log) creates/updates the engine reading.
-- security definer: the reading mirrors an already-authorized completion (also fired by the
-- `on delete set null` cascade when a log is deleted by someone else).
create or replace function public.sync_engine_hours_from_completion()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_engine_id uuid;
begin
  if new.engine_hours is null or new.maintenance_log_id is not null then
    return new;
  end if;
  select i.engine_id into v_engine_id from public.checklist_items i where i.id = new.checklist_item_id;
  if v_engine_id is null then
    return new;
  end if;
  insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, source, checklist_completion_id, created_by, updated_by)
  values (new.boat_id, v_engine_id, new.engine_hours, new.completed_at, 'checklist', new.id, new.created_by, coalesce(auth.uid(), new.updated_by))
  on conflict (checklist_completion_id) do update
    set hours = excluded.hours, read_at = excluded.read_at, updated_by = excluded.updated_by;
  return new;
end;
$$;

create trigger sync_engine_hours_from_completion
  after insert or update on public.checklist_completions
  for each row execute function public.sync_engine_hours_from_completion();

-- readings carried by a log follow its date
create or replace function public.sync_log_readings_date()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.engine_hour_readings
    set read_at = new.performed_at
    where maintenance_log_id = new.id and read_at <> new.performed_at;
  return new;
end;
$$;

create trigger sync_log_readings_date
  after update of performed_at on public.maintenance_logs
  for each row
  when (old.performed_at is distinct from new.performed_at)
  execute function public.sync_log_readings_date();

-- ---------------------------------------------------------------------------------------------
-- apply_checklist_template: instantiate (idempotently) a template on a boat
-- ---------------------------------------------------------------------------------------------
create or replace function public.apply_checklist_template(
  p_boat_id uuid,
  p_template_id uuid,
  p_engine_id uuid default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_cat record;
  v_item record;
  v_engine record;
  v_category_id uuid;
  v_engine_ref text;
begin
  if not public.can_write_boat(p_boat_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.checklist_templates t where t.id = p_template_id) then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;

  update public.boats set checklist_template_id = p_template_id, updated_by = v_user
    where id = p_boat_id and checklist_template_id is distinct from p_template_id;

  for v_cat in
    select * from public.checklist_template_categories tc where tc.template_id = p_template_id order by tc.sort_order
  loop
    -- categories keep the user's renames/colours: only link the template on conflict
    insert into public.boat_categories (boat_id, name, color, icon, sort_order, template_category_id, external_ref, created_by, updated_by)
    values (p_boat_id, v_cat.name, v_cat.color, v_cat.icon, v_cat.sort_order, v_cat.id, v_cat.external_ref, v_user, v_user)
    on conflict (boat_id, external_ref) do update set template_category_id = excluded.template_category_id
    returning id into v_category_id;

    for v_item in
      select * from public.checklist_template_items ti where ti.template_category_id = v_cat.id order by ti.sort_order
    loop
      if v_item.engine_scope = 'none' then
        if p_engine_id is null then
          insert into public.checklist_items (boat_id, category_id, label, description, interval_months, interval_hours, actions, source, template_item_id, sort_order, external_ref, created_by, updated_by)
          values (p_boat_id, v_category_id, v_item.label, v_item.description, v_item.interval_months, v_item.interval_hours, v_item.actions, 'template', v_item.id, v_item.sort_order, v_item.external_ref, v_user, v_user)
          on conflict (boat_id, external_ref) do nothing;
        end if;
      else
        for v_engine in
          select * from public.engines e
          where e.boat_id = p_boat_id and e.is_active
            and (p_engine_id is null or e.id = p_engine_id)
            and (
              v_item.engine_scope = 'all'
              or (v_item.engine_scope = 'inboard' and e.position in ('port', 'starboard', 'center'))
              or (v_item.engine_scope = 'outboard' and e.position = 'outboard')
            )
          order by e.sort_order
        loop
          v_engine_ref := coalesce(v_engine.external_ref, v_engine.id::text);
          insert into public.checklist_items (boat_id, category_id, label, description, interval_months, interval_hours, engine_id, actions, source, template_item_id, sort_order, external_ref, created_by, updated_by)
          values (p_boat_id, v_category_id, v_item.label || ' — ' || v_engine.label, v_item.description, v_item.interval_months, v_item.interval_hours, v_engine.id, v_item.actions, 'template', v_item.id, v_item.sort_order, v_item.external_ref || ':' || v_engine_ref, v_user, v_user)
          on conflict (boat_id, external_ref) do nothing;
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- mark_log_reviewed: validate an imported line and turn its pending hours into readings
-- ---------------------------------------------------------------------------------------------
create or replace function public.mark_log_reviewed(p_log_id uuid, p_hours_override jsonb default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_log public.maintenance_logs%rowtype;
  v_hours jsonb;
  v_key text;
  v_value text;
  v_engine_id uuid;
begin
  select * into v_log from public.maintenance_logs where id = p_log_id for update;
  if not found then
    raise exception 'log_not_found' using errcode = 'P0002';
  end if;
  if not public.can_write_boat(v_log.boat_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_hours_override is not null and jsonb_typeof(p_hours_override) <> 'object' then
    raise exception 'invalid_hours' using errcode = '22023';
  end if;

  v_hours := coalesce(p_hours_override, v_log.pending_engine_hours, '{}'::jsonb);

  for v_key, v_value in select key, value #>> '{}' from jsonb_each(v_hours)
  loop
    if v_value is null or v_value = '' then
      continue;
    end if;
    v_engine_id := v_key::uuid;
    if not exists (select 1 from public.engines e where e.id = v_engine_id and e.boat_id = v_log.boat_id) then
      raise exception 'engine_not_on_boat' using errcode = '23503', detail = v_key;
    end if;
    insert into public.engine_hour_readings (boat_id, engine_id, hours, read_at, source, maintenance_log_id, created_by, updated_by)
    values (v_log.boat_id, v_engine_id, v_value::numeric, v_log.performed_at, 'import', v_log.id, v_user, v_user)
    on conflict (maintenance_log_id, engine_id) do update
      set hours = excluded.hours, read_at = excluded.read_at, source = 'import', updated_by = excluded.updated_by;
  end loop;

  update public.maintenance_logs
    set needs_review = false, pending_engine_hours = null, updated_by = v_user
    where id = p_log_id;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- purge_trash: physical deletion after 30 days (service role / cron only)
-- ---------------------------------------------------------------------------------------------
create or replace function public.purge_trash()
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_count int := 0;
  v_n int;
begin
  delete from public.maintenance_logs where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.purchases where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.haul_outs where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  return v_count;
end;
$$;

revoke all on function public.checklist_compute_status(date, int, numeric, int, numeric, date) from public;
revoke all on function public.apply_checklist_template(uuid, uuid, uuid) from public;
revoke all on function public.mark_log_reviewed(uuid, jsonb) from public;
revoke all on function public.purge_trash() from public;
grant execute on function public.checklist_compute_status(date, int, numeric, int, numeric, date) to authenticated, service_role;
grant execute on function public.apply_checklist_template(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.mark_log_reviewed(uuid, jsonb) to authenticated, service_role;
grant execute on function public.purge_trash() to service_role;

-- daily purge with pg_cron when the extension is available (Supabase); otherwise a Server Action calls it
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('xaman-purge-trash', '15 3 * * *', 'select public.purge_trash()');
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Realtime: one channel per boat on these tables (client filter boat_id=eq.{id})
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  foreach t in array array[
    'maintenance_logs', 'checklist_items', 'checklist_completions', 'engine_hour_readings',
    'purchases', 'parts', 'haul_outs', 'contacts'
  ]
  loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
