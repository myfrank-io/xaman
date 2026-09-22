-- E4-14 / D150: one checklist point, several systems and supporting documents.
create table public.checklist_item_categories (
  item_id uuid not null references public.checklist_items(id) on delete cascade,
  category_id uuid not null references public.boat_categories(id) on delete cascade,
  boat_id uuid not null references public.boats(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_id, category_id)
);
create index checklist_item_categories_boat_idx on public.checklist_item_categories(boat_id, category_id);
alter table public.checklist_item_categories enable row level security;
create policy checklist_item_categories_select on public.checklist_item_categories
  for select to authenticated using (public.is_boat_member(boat_id));
create policy checklist_item_categories_insert on public.checklist_item_categories
  for insert to authenticated with check (public.can_write_boat(boat_id));
create policy checklist_item_categories_delete on public.checklist_item_categories
  for delete to authenticated using (public.can_write_boat(boat_id));
grant select, insert, delete on public.checklist_item_categories to authenticated;
grant all on public.checklist_item_categories to service_role;
revoke all on public.checklist_item_categories from anon;

create function public.checklist_item_categories_check_boat()
returns trigger language plpgsql set search_path = '' as $$
begin
  if not exists (select 1 from public.checklist_items where id = new.item_id and boat_id = new.boat_id)
     or not exists (select 1 from public.boat_categories where id = new.category_id and boat_id = new.boat_id) then
    raise exception 'checklist_item_categories: boat mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger checklist_item_categories_boat before insert or update on public.checklist_item_categories
for each row execute function public.checklist_item_categories_check_boat();
revoke all on function public.checklist_item_categories_check_boat() from public, anon, authenticated;
grant execute on function public.checklist_item_categories_check_boat() to service_role;

-- The primary system always remains readable, even for seed/import writers that know only it.
-- Secondary systems are replaced together with the item; RLS applies throughout this RPC.
create function public.save_checklist_item(p_item jsonb, p_category_ids uuid[], p_expected_updated_at timestamptz default null)
returns timestamptz language plpgsql security invoker set search_path = '' as $$
declare
  v public.checklist_items;
  existing public.checklist_items;
  stamp timestamptz;
begin
  v := jsonb_populate_record(null::public.checklist_items, p_item);
  if auth.uid() is null or not public.can_write_boat(v.boat_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if cardinality(p_category_ids) is null or cardinality(p_category_ids) < 1 or cardinality(p_category_ids) > 16
     or exists (select 1 from unnest(p_category_ids) c where c is null)
     or (select count(distinct c) from unnest(p_category_ids) c) <> cardinality(p_category_ids)
     or (select count(*) from public.boat_categories where id = any(p_category_ids) and boat_id = v.boat_id) <> cardinality(p_category_ids) then
    raise exception 'invalid checklist categories' using errcode = '23514';
  end if;
  select * into existing from public.checklist_items where id = v.id and boat_id = v.boat_id for update;
  if existing.id is not null and p_expected_updated_at is not null and existing.updated_at <> p_expected_updated_at then
    raise exception 'conflict' using errcode = 'P0001';
  end if;
  insert into public.checklist_items (
    id, boat_id, category_id, label, description, interval_months, interval_hours,
    engine_id, actions, source, anchor_date, sort_order, created_by, updated_by
  ) values (
    v.id, v.boat_id, p_category_ids[1], v.label, v.description, v.interval_months, v.interval_hours,
    v.engine_id, v.actions, 'custom', coalesce(v.anchor_date, existing.anchor_date, current_date),
    coalesce(existing.sort_order, (select count(*) from public.checklist_items where boat_id = v.boat_id)),
    coalesce(existing.created_by, auth.uid()), auth.uid()
  ) on conflict (id) do update set
    category_id = excluded.category_id, label = excluded.label, description = excluded.description,
    interval_months = excluded.interval_months, interval_hours = excluded.interval_hours,
    engine_id = excluded.engine_id, actions = excluded.actions, anchor_date = excluded.anchor_date,
    updated_by = auth.uid()
  where checklist_items.boat_id = v.boat_id
  returning updated_at into stamp;
  if stamp is null then raise exception 'forbidden' using errcode = '42501'; end if;
  delete from public.checklist_item_categories where item_id = v.id and boat_id = v.boat_id;
  insert into public.checklist_item_categories(item_id, category_id, boat_id)
    select v.id, id, v.boat_id from unnest(p_category_ids) id;
  return stamp;
end;
$$;
revoke all on function public.save_checklist_item(jsonb, uuid[], timestamptz) from public, anon;
grant execute on function public.save_checklist_item(jsonb, uuid[], timestamptz) to authenticated, service_role;

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
    c.next_due_at,
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
    -- an hour deadline needs a meter: without one it is not a deadline, it is a wish (D73)
    case when i.engine_id is not null and not coalesce(e.tracks_hours, true)
         then null::int
         else i.interval_hours
    end as interval_hours,
    i.engine_id,
    coalesce(e.tracks_hours, true) as engine_tracks_hours,
    i.actions,
    i.source,
    i.template_item_id,
    i.sort_order,
    i.anchor_date,
    i.anchor_hours,
    e.counter_reset_at,
    lc.completion_id as last_completion_id,
    lc.completed_at as last_completed_at,
    lc.completed_by as last_completed_by,
    coalesce(lc.completed_by_name, p.full_name, p.email) as last_completed_by_name,
    lc.engine_hours as last_engine_hours,
    lc.note as last_note,
    lc.next_due_at as fixed_due_at,
    (lc.completed_at is not null) as has_completion,
    coalesce(lc.completed_at, i.anchor_date) as reference_at,
    -- hour reference, neutralised when the counter was replaced after it (audit §4.1)
    case
      when e.counter_reset_at is not null
           and coalesce(lc.completed_at, i.anchor_date) < e.counter_reset_at then null
      else coalesce(lc.engine_hours, i.anchor_hours)
    end as reference_hours,
    ech.hours as current_hours
  from public.checklist_items i
  join public.boat_categories cat on cat.id = i.category_id
  left join public.engines e on e.id = i.engine_id
  left join last_completion lc on lc.checklist_item_id = i.id
  left join public.profiles p on p.id = lc.completed_by
  left join public.engine_current_hours ech on ech.engine_id = i.engine_id
  where i.is_active
    and cat.is_active
    and (i.engine_id is null or e.is_active)
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
  b.anchor_date,
  b.anchor_hours,
  b.counter_reset_at,
  b.last_completion_id,
  b.last_completed_at,
  b.last_completed_by,
  b.last_completed_by_name,
  b.last_engine_hours,
  b.last_note,
  b.fixed_due_at,
  b.has_completion,
  (not b.has_completion) as is_estimated,
  b.reference_at,
  b.reference_hours,
  b.current_hours,
  s.due_at,
  s.due_hours,
  s.days_remaining,
  s.hours_remaining,
  s.status,
  b.engine_tracks_hours,
  -- D140 / D141: the intervention someone has in hand for this point, if any. The most pressing
  -- first (urgent, in progress, then planned), the earliest date first among equals.
  ol.id as open_log_id,
  ol.status as open_log_status,
  ol.performed_at as open_log_at,
  ol.contact_name as open_log_contact_name,
  array[b.category_id] || array(
    select ic.category_id from public.checklist_item_categories ic
    where ic.item_id = b.id and ic.boat_id = b.boat_id and ic.category_id <> b.category_id
    order by ic.category_id
  ) as category_ids
from base b
cross join lateral public.checklist_compute_status(
  b.reference_at, b.interval_months, b.reference_hours, b.interval_hours,
  b.current_hours, b.has_completion, b.fixed_due_at, current_date
) s
left join lateral (
  select l.id, l.status, l.performed_at, c.name as contact_name
    from public.maintenance_logs l
    left join public.contacts c on c.id = l.contact_id
   where l.checklist_item_id = b.id
     and l.deleted_at is null
     and l.status <> 'done'
   order by case l.status when 'urgent' then 0 when 'in_progress' then 1 else 2 end,
            l.performed_at, l.created_at
   limit 1
) ol on true;


create or replace view public.checklist_category_progress
with (security_invoker = true) as
with per_category as (
  -- Une seule passe sur les points. C'est tout le sujet de cette migration : le regroupement
  -- par `category_id` remplace les sept relectures que la jointure directe provoquait.
  select
    systems.category_id,
    s.boat_id,
    count(s.id) filter (where s.interval_months is not null or s.interval_hours is not null)::int as total,
    count(s.id) filter (where s.status = 'ok' and (s.interval_months is not null or s.interval_hours is not null))::int as ok_count,
    count(s.id) filter (where s.status = 'soon' and (s.interval_months is not null or s.interval_hours is not null))::int as soon_count,
    count(s.id) filter (where s.status = 'overdue')::int as overdue_count,
    count(s.id) filter (where s.status = 'never')::int as never_count,
    count(s.id) filter (where not s.has_completion and (s.interval_months is not null or s.interval_hours is not null))::int as never_recorded_count,
    count(s.id) filter (where s.interval_months is null and s.interval_hours is null)::int as punctual_count,
    (count(s.id) filter (where s.status in ('ok', 'soon') and (s.interval_months is not null or s.interval_hours is not null)))::numeric
      / nullif(count(s.id) filter (where s.interval_months is not null or s.interval_hours is not null), 0) as progress
  from public.checklist_item_status s
  cross join lateral unnest(s.category_ids) systems(category_id)
  group by systems.category_id, s.boat_id
)
select
  c.id as category_id,
  c.boat_id,
  c.name,
  c.color,
  c.icon,
  c.sort_order,
  -- Une catégorie sans point n'a pas de ligne dans `per_category` ; la jointure externe rendait
  -- déjà 0 par `count()` sur zéro ligne, le `coalesce` tient la même promesse.
  coalesce(a.total, 0) as total,
  coalesce(a.ok_count, 0) as ok_count,
  coalesce(a.soon_count, 0) as soon_count,
  coalesce(a.overdue_count, 0) as overdue_count,
  coalesce(a.never_count, 0) as never_count,
  coalesce(a.never_recorded_count, 0) as never_recorded_count,
  coalesce(a.punctual_count, 0) as punctual_count,
  -- `progress` reste nul quand il n'y a rien à mesurer : sans point à intervalle, le `nullif`
  -- de la CTE rend nul, et une catégorie absente de la CTE rend nul elle aussi. Pas de
  -- `coalesce` ici — 0 % et « rien à mesurer » ne sont pas la même chose à l'écran.
  a.progress
from public.boat_categories c
left join per_category a
  on a.category_id = c.id
 and a.boat_id = c.boat_id
where c.is_active;

-- `drop view` emporte les privilèges : on les repose à l'identique (règle 2).
grant select on public.checklist_category_progress to authenticated, service_role;
revoke all on public.checklist_category_progress from anon;

-- Documents are attached to the point, independently of any completion.
alter type public.attachment_entity add value if not exists 'checklist_item';
create or replace function public.attachments_owner_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_boat uuid;
begin
  -- security invoker on purpose: RLS applies to these lookups, so a document can only be hung
  -- off a row the writer is allowed to read.
  case new.entity_type::text
    when 'maintenance_log' then
      select l.boat_id into v_boat from public.maintenance_logs l where l.id = new.entity_id;
    when 'purchase' then
      select p.boat_id into v_boat from public.purchases p where p.id = new.entity_id;
    when 'equipment' then
      select e.boat_id into v_boat from public.equipment e where e.id = new.entity_id;
    when 'haul_out' then
      select h.boat_id into v_boat from public.haul_outs h where h.id = new.entity_id;
    when 'checklist_completion' then
      select c.boat_id into v_boat from public.checklist_completions c where c.id = new.entity_id;
    when 'checklist_item' then
      select i.boat_id into v_boat from public.checklist_items i where i.id = new.entity_id;
    when 'boat' then
      select b.id into v_boat from public.boats b where b.id = new.entity_id;
  end case;

  if v_boat is null then
    raise exception 'attachment_owner_not_found' using errcode = 'P0002';
  end if;
  if v_boat <> new.boat_id then
    raise exception 'attachment_owner_mismatch' using errcode = '23514';
  end if;
  return new;
end;
$$;


create trigger cleanup_attachments after delete on public.checklist_items
for each row execute function public.cleanup_attachments('checklist_item');

create or replace function public.suggest_checklist_items(
  p_boat_id uuid,
  p_category_id uuid,
  p_title text
)
returns table (
  id uuid,
  label text,
  category_id uuid,
  engine_id uuid,
  engine_label text,
  interval_months int,
  interval_hours int,
  status public.checklist_state,
  due_at date,
  due_hours numeric,
  days_remaining int,
  hours_remaining numeric,
  last_completed_at date,
  last_engine_hours numeric,
  current_hours numeric,
  score real
)
language sql stable
set search_path = ''
as $$
  select
    s.id,
    s.label,
    s.category_id,
    s.engine_id,
    e.label as engine_label,
    s.interval_months,
    s.interval_hours,
    s.status,
    s.due_at,
    s.due_hours,
    s.days_remaining,
    s.hours_remaining,
    s.last_completed_at,
    s.last_engine_hours,
    s.current_hours,
    c.score
  from public.checklist_item_status s
  left join public.engines e on e.id = s.engine_id
  cross join lateral (
    select case
      when e.label is not null
       and right(s.label, char_length(e.label) + 3) = ' — ' || e.label
      then left(s.label, char_length(s.label) - char_length(e.label) - 3)
      else s.label
    end as core
  ) l
  cross join lateral (
    select greatest(
      extensions.similarity(public.text_fold(l.core), public.text_fold(p_title)),
      extensions.strict_word_similarity(public.text_fold(p_title), public.text_fold(l.core))
    ) as score
  ) c
  where s.boat_id = p_boat_id
    and p_category_id = any(s.category_ids)
    and char_length(coalesce(p_title, '')) >= 3
    and c.score > 0.5
  order by c.score desc, s.sort_order, s.label
  limit 5;
$$;

