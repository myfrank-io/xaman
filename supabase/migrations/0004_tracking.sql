-- 0004_tracking.sql — Tracking model corrections decided by the product audit (docs/AUDIT.md §3.1).
--
-- What this migration does (the numbered sections below appear in dependency order in the file:
-- the views are dropped first and rebuilt once the columns they read exist):
--   1. anchoring of due dates            (D1  — checklist_items.anchor_date / anchor_hours)
--   2. fixed expiry dates                (D11 — checklist_completions.next_due_at)
--   3. replaced hour counter             (D12 — engines.counter_reset_at / counter_reset_note)
--   4. per-equipment history             (maintenance_logs.equipment_id)
--   5. dead columns removed              (D6/D4 — maintenance_logs.priority, next_due_at)
--   6. editor invitations                (D28 — boat_invitations.valid_until + insert policy)
--   7. cancelling a completion           (D15 — delete policy + cascade on the derived reading)
--   8. engine deletion guard             (D14 — trigger)
--   9. trash keeps the hour readings     (D5  — readings parked in pending_engine_hours)
--  10. revised checklist_item_status     (audit annex A)
--  11. checklist_category_progress       (interval items only + never_recorded / punctual counts)
--  12. boat_todo_queue()                 (dashboard queue, audit §3.5 + UX §2.4)
--  13. boat_dashboard_stats              (12-month expenses, review backlog, engines without reading)
--  14. harmonised category colours       (DA) + the "haul-out" template item
--  15. no future dates on completions and readings (D17 — triggers, current_date is not immutable)
--
-- Written to be re-runnable (if exists / or replace / drop policy first) on a database that
-- already has 0001–0003 applied.

-- ---------------------------------------------------------------------------------------------
-- 0. Drop the objects that depend on the columns and on the status function rewritten below.
--    (`create or replace view` cannot change the column list, and the function signature changes.)
-- ---------------------------------------------------------------------------------------------
drop view if exists public.boat_dashboard_stats;
drop view if exists public.checklist_category_progress;
drop view if exists public.checklist_item_status;
drop view if exists public.expenses_by_category;
drop view if exists public.maintenance_logs_view;
drop view if exists public.maintenance_logs_trash_view;
drop view if exists public.boat_invitations_safe;
drop function if exists public.checklist_compute_status(date, int, numeric, int, numeric, date);

-- ---------------------------------------------------------------------------------------------
-- 1. Anchoring (D1): every item carries a reference date even when it has never been completed.
-- ---------------------------------------------------------------------------------------------
alter table public.checklist_items
  add column if not exists anchor_date  date not null default current_date,
  add column if not exists anchor_hours numeric(8,1);

comment on column public.checklist_items.anchor_date is
  'Reference date used until the item has a completion: due_at = coalesce(last completion, anchor_date) + interval_months. Set to current_date when the template is instantiated, editable in the start-up wizard.';
comment on column public.checklist_items.anchor_hours is
  'Engine hours at anchoring time (current reading of the linked engine, null when unknown).';

-- ---------------------------------------------------------------------------------------------
-- 2. Fixed expiry date (D11): "valid until" printed on the object wins over the interval.
-- ---------------------------------------------------------------------------------------------
alter table public.checklist_completions
  add column if not exists next_due_at date;

alter table public.checklist_completions
  drop constraint if exists checklist_completions_next_due_after_completed;
alter table public.checklist_completions
  add constraint checklist_completions_next_due_after_completed
  check (next_due_at is null or next_due_at > completed_at);

comment on column public.checklist_completions.next_due_at is
  'Optional "valid until" date (liferaft, flares, EPIRB battery, extinguishers, yard advice). Takes precedence over interval_months in checklist_item_status.';

-- ---------------------------------------------------------------------------------------------
-- 3. Replaced hour counter (D12).
-- ---------------------------------------------------------------------------------------------
alter table public.engines
  add column if not exists counter_reset_at   date,
  add column if not exists counter_reset_note text;

comment on column public.engines.counter_reset_at is
  'Date the hour counter was replaced / read on another display. Hour deadlines whose reference predates it are ignored until the next completion (audit §4.1).';

-- ---------------------------------------------------------------------------------------------
-- 4. Per-equipment history: an intervention may target one piece of equipment.
-- ---------------------------------------------------------------------------------------------
alter table public.maintenance_logs
  add column if not exists equipment_id uuid references public.equipment (id) on delete set null;
create index if not exists maintenance_logs_equipment_idx
  on public.maintenance_logs (equipment_id) where equipment_id is not null;

-- Equipment is never deleted from the UI (BACKLOG E2-3): it is marked as removed and keeps its
-- history (the interventions above still point at it).
alter table public.equipment
  add column if not exists removed_at date;
comment on column public.equipment.removed_at is
  'Date the equipment was removed from the boat; kept for history, hidden from the active inventory.';

-- ---------------------------------------------------------------------------------------------
-- 5. Dead columns removed (D6 priority, D4 next_due_at): never read, and the "next due date"
--    now lives on the completion (see 2.).
-- ---------------------------------------------------------------------------------------------
alter table public.maintenance_logs
  drop column if exists priority,
  drop column if exists next_due_at;
drop type if exists public.log_priority;

-- ---------------------------------------------------------------------------------------------
-- 6. Invitations (D28): an editor may invite a pro or a viewer, time-limited (90 days max).
-- ---------------------------------------------------------------------------------------------
alter table public.boat_invitations
  add column if not exists valid_until date;
comment on column public.boat_invitations.valid_until is
  'Access end date carried by the invitation, copied into boat_members.valid_until on acceptance. Mandatory when an editor issues the invitation.';

-- the token stays unreadable; valid_until joins the columns authenticated may read
grant select (valid_until) on public.boat_invitations to authenticated;

drop policy if exists "boat_invitations_insert" on public.boat_invitations;
create policy "boat_invitations_insert" on public.boat_invitations for insert to authenticated
  with check (
    invited_by = auth.uid()
    and (
      public.is_boat_owner(boat_id)
      or (
        public.boat_role(boat_id) = 'editor'::public.boat_role
        and role in ('pro'::public.boat_role, 'viewer'::public.boat_role)
        and valid_until is not null
        and valid_until <= current_date + 90
      )
    )
  );

-- accept_invitation now carries valid_until over to the membership (never overwriting an
-- existing end date with null).
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv public.boat_invitations%rowtype;
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.boat_invitations where token = p_token for update;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation_accepted' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.boat_members (boat_id, user_id, role, valid_until, invited_by)
  values (v_inv.boat_id, v_user_id, v_inv.role, v_inv.valid_until, v_inv.invited_by)
  on conflict (boat_id, user_id) do update
    set role = excluded.role,
        valid_until = coalesce(excluded.valid_until, public.boat_members.valid_until)
    where public.boat_members.role <> 'owner'::public.boat_role;

  update public.boat_invitations
    set accepted_at = now(), accepted_by = v_user_id
    where id = v_inv.id;

  return v_inv.boat_id;
end;
$$;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.accept_invitation(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 7. Cancelling a completion (D15): owner/editor always, the pro author within 24 h.
--    The derived hour reading disappears with it, otherwise the counter stays wrong.
-- ---------------------------------------------------------------------------------------------
drop policy if exists "checklist_completions_delete" on public.checklist_completions;
create policy "checklist_completions_delete" on public.checklist_completions for delete to authenticated
  using (
    public.can_write_boat(boat_id)
    or (created_by = auth.uid() and created_at > now() - interval '24 hours')
  );

alter table public.engine_hour_readings
  drop constraint if exists engine_hour_readings_checklist_completion_id_fkey;
alter table public.engine_hour_readings
  add constraint engine_hour_readings_checklist_completion_id_fkey
  foreign key (checklist_completion_id) references public.checklist_completions (id) on delete cascade;

-- ---------------------------------------------------------------------------------------------
-- 8. Engine deletion guard (D14): only deactivation is offered in the UI; the rule lives in the
--    database. A boat (or account) cascade runs at trigger depth > 1 and is let through.
-- ---------------------------------------------------------------------------------------------
create or replace function public.prevent_engine_delete_in_use()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then
    return old;
  end if;
  if exists (select 1 from public.engine_hour_readings r where r.engine_id = old.id)
     or exists (select 1 from public.checklist_items i where i.engine_id = old.id) then
    raise exception 'engine_in_use'
      using errcode = 'P0001',
            detail = 'This engine carries hour readings or checklist items: deactivate it instead';
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_engine_delete_in_use on public.engines;
create trigger prevent_engine_delete_in_use
  before delete on public.engines
  for each row execute function public.prevent_engine_delete_in_use();

-- ---------------------------------------------------------------------------------------------
-- 9. Trash and hour readings (D5, audit §4.13): moving a log to the trash parks its readings in
--    pending_engine_hours and deletes them, restoring recreates them. Without this the engine
--    counter changed twice: once at trashing, once again 30 days later when purge_trash() ran.
--    security definer: the readings mirror an already-authorized soft delete.
-- ---------------------------------------------------------------------------------------------
create or replace function public.sync_log_readings_trash()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_hours jsonb;
begin
  if old.deleted_at is null and new.deleted_at is not null then
    -- to the trash: park the readings on the log itself, then remove them
    select coalesce(jsonb_object_agg(r.engine_id::text, r.hours), '{}'::jsonb)
      into v_hours
      from public.engine_hour_readings r
     where r.maintenance_log_id = new.id;

    if v_hours <> '{}'::jsonb then
      update public.maintenance_logs
         set pending_engine_hours = coalesce(pending_engine_hours, '{}'::jsonb) || v_hours
       where id = new.id;
      delete from public.engine_hour_readings where maintenance_log_id = new.id;
    end if;

  elsif old.deleted_at is not null and new.deleted_at is null
        and not new.needs_review and new.pending_engine_hours is not null then
    -- restored: rebuild the readings from the parked values, then clear the column.
    -- A log still flagged needs_review keeps them for mark_log_reviewed().
    insert into public.engine_hour_readings
      (boat_id, engine_id, hours, read_at, source, maintenance_log_id, created_by, updated_by)
    select new.boat_id, e.id, (h.value #>> '{}')::numeric, new.performed_at,
           'maintenance_log'::public.hour_reading_source, new.id,
           new.created_by, coalesce(auth.uid(), new.updated_by)
      from jsonb_each(new.pending_engine_hours) h
      join public.engines e on e.id::text = h.key and e.boat_id = new.boat_id
     where (h.value #>> '{}') ~ '^[0-9]+(\.[0-9]+)?$'
    on conflict (maintenance_log_id, engine_id) do update
      set hours = excluded.hours, read_at = excluded.read_at;

    update public.maintenance_logs set pending_engine_hours = null where id = new.id;
  end if;

  return null;
end;
$$;

-- The inner UPDATE only touches pending_engine_hours, so `update of deleted_at` does not re-fire.
drop trigger if exists sync_log_readings_trash on public.maintenance_logs;
create trigger sync_log_readings_trash
  after update of deleted_at on public.maintenance_logs
  for each row
  when (old.deleted_at is distinct from new.deleted_at)
  execute function public.sync_log_readings_trash();

-- ---------------------------------------------------------------------------------------------
-- 15. No future dates (D17): `check (completed_at <= current_date)` is impossible (current_date
--     is not immutable), so the rule is a trigger. Same error code as a check constraint.
--     One day of tolerance: the database runs in UTC while the boat does not, so a reading typed
--     at 00:30 in Paris (22:30 UTC the day before) is dated "tomorrow" here and must pass.
--     Mirrors pastOrTodayDate in src/lib/schemas/common.ts.
-- ---------------------------------------------------------------------------------------------
create or replace function public.reject_future_date()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_column text := tg_argv[0];
  v_value date := (to_jsonb(new) ->> v_column)::date;
begin
  if v_value is not null and v_value > current_date + 1 then
    raise exception 'date_in_future'
      using errcode = '23514',
            detail = format('%I.%I must not be in the future (%s)', tg_table_name, v_column, v_value);
  end if;
  return new;
end;
$$;

drop trigger if exists reject_future_completed_at on public.checklist_completions;
create trigger reject_future_completed_at
  before insert or update on public.checklist_completions
  for each row execute function public.reject_future_date('completed_at');

drop trigger if exists reject_future_read_at on public.engine_hour_readings;
create trigger reject_future_read_at
  before insert or update on public.engine_hour_readings
  for each row execute function public.reject_future_date('read_at');

-- ---------------------------------------------------------------------------------------------
-- 10. Checklist status: the pure function, revised (audit annex A).
--     Arguments are already resolved by the caller: reference date/hours (completion or anchor),
--     the fixed due date of the last completion, and whether a completion exists at all.
--     Mirrored by src/lib/checklist-status.ts (tests/fixtures/checklist-status-cases.json).
-- ---------------------------------------------------------------------------------------------
create or replace function public.checklist_compute_status(
  p_reference_at date,
  p_interval_months int,
  p_reference_hours numeric,
  p_interval_hours int,
  p_current_hours numeric,
  p_has_completion boolean default false,
  p_fixed_due_at date default null,
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
  -- a fixed "valid until" date always wins over the interval (D11)
  if p_fixed_due_at is not null then
    due_at := p_fixed_due_at;
  elsif p_interval_months is not null and p_reference_at is not null then
    due_at := (p_reference_at + make_interval(months => p_interval_months))::date;
  end if;
  if due_at is not null then
    days_remaining := due_at - p_today;
  end if;

  -- hour deadline: needs an hour interval AND an hour reference (neutralised by the caller when
  -- the counter was replaced after the reference date — see checklist_item_status)
  if p_interval_hours is not null and p_reference_hours is not null then
    due_hours := p_reference_hours + p_interval_hours;
    if p_current_hours is not null then
      hours_remaining := due_hours - p_current_hours;
    end if;
  end if;

  if coalesce(days_remaining < 0, false) or coalesce(hours_remaining < 0, false) then
    status := 'overdue';
  elsif coalesce(days_remaining <= 30, false) or coalesce(hours_remaining <= 25, false) then
    status := 'soon';
  elsif p_interval_months is null and p_interval_hours is null
        and not coalesce(p_has_completion, false) then
    -- one-off check never done: information only, never in the dashboard queue
    status := 'never';
  else
    status := 'ok';
  end if;
end;
$$;

-- 6.2 status of every active item of an active category (engines included)
create view public.checklist_item_status
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
    i.interval_hours,
    i.engine_id,
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
  s.status
from base b
cross join lateral public.checklist_compute_status(
  b.reference_at, b.interval_months, b.reference_hours, b.interval_hours,
  b.current_hours, b.has_completion, b.fixed_due_at, current_date
) s;

comment on view public.checklist_item_status is
  'Status of every active checklist item (audit annex A): reference = last completion or anchor, a fixed next_due_at wins over the interval, hour deadlines neutralised after a counter reset, items of an inactive engine excluded.';

-- ---------------------------------------------------------------------------------------------
-- 11. Progress per active category: only items WITH an interval count towards the ratio.
--     never_recorded_count = interval items never completed; punctual_count = items without
--     interval. overdue_count is deliberately not filtered: a one-off check carrying a fixed
--     "valid until" date is a real deadline.
-- ---------------------------------------------------------------------------------------------
create view public.checklist_category_progress
with (security_invoker = true) as
select
  c.id as category_id,
  c.boat_id,
  c.name,
  c.color,
  c.icon,
  c.sort_order,
  count(s.id) filter (where s.interval_months is not null or s.interval_hours is not null)::int as total,
  count(s.id) filter (where s.status = 'ok' and (s.interval_months is not null or s.interval_hours is not null))::int as ok_count,
  count(s.id) filter (where s.status = 'soon' and (s.interval_months is not null or s.interval_hours is not null))::int as soon_count,
  count(s.id) filter (where s.status = 'overdue')::int as overdue_count,
  count(s.id) filter (where s.status = 'never')::int as never_count,
  count(s.id) filter (where not s.has_completion and (s.interval_months is not null or s.interval_hours is not null))::int as never_recorded_count,
  count(s.id) filter (where s.interval_months is null and s.interval_hours is null)::int as punctual_count,
  (count(s.id) filter (where s.status in ('ok', 'soon') and (s.interval_months is not null or s.interval_hours is not null)))::numeric
    / nullif(count(s.id) filter (where s.interval_months is not null or s.interval_hours is not null), 0) as progress
from public.boat_categories c
left join public.checklist_item_status s on s.category_id = c.id
where c.is_active
group by c.id, c.boat_id, c.name, c.color, c.icon, c.sort_order;

-- ---------------------------------------------------------------------------------------------
-- Views rebuilt without priority / next_due_at (and with the equipment link)
-- ---------------------------------------------------------------------------------------------
create view public.maintenance_logs_view
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
  l.performed_at,
  l.cost,
  l.currency,
  l.contact_id,
  ct.name as contact_name,
  l.equipment_id,
  eq.name as equipment_name,
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
left join public.equipment eq on eq.id = l.equipment_id
left join public.profiles p on p.id = l.created_by
where l.deleted_at is null;

create view public.maintenance_logs_trash_view
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
  l.pending_engine_hours,
  l.deleted_at,
  l.updated_by as deleted_by,
  coalesce(p.full_name, p.email) as deleted_by_name
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
left join public.profiles p on p.id = l.updated_by
where l.deleted_at is not null and l.deleted_at > now() - interval '30 days';

create view public.boat_invitations_safe
with (security_invoker = true) as
select
  i.id,
  i.boat_id,
  i.email,
  i.role,
  i.invited_by,
  coalesce(p.full_name, p.email) as invited_by_name,
  i.expires_at,
  i.valid_until,
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

create view public.expenses_by_category
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

-- ---------------------------------------------------------------------------------------------
-- 13. Dashboard stats: rolling 12 months (a calendar year means nothing for a Mediterranean
--     season), the "never recorded" backlog, the review backlog and engines without a reading.
-- ---------------------------------------------------------------------------------------------
create view public.boat_dashboard_stats
with (security_invoker = true) as
select
  b.id as boat_id,
  (select count(*)::int from public.checklist_item_status s where s.boat_id = b.id and s.status = 'overdue') as overdue_items,
  (select count(*)::int from public.checklist_item_status s where s.boat_id = b.id and s.status = 'soon') as soon_items,
  (
    select count(*)::int from public.checklist_item_status s
    where s.boat_id = b.id and not s.has_completion
      and (s.interval_months is not null or s.interval_hours is not null)
  ) as never_recorded_items,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.status = 'planned') as planned_logs,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.status = 'in_progress') as in_progress_logs,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.status = 'urgent') as urgent_logs,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.needs_review) as review_pending_logs,
  (select count(*)::int from public.purchases pu where pu.boat_id = b.id and pu.deleted_at is null and pu.needs_review) as review_pending_purchases,
  coalesce((select sum(e.amount) from public.expenses_by_category e where e.boat_id = b.id and e.date >= date_trunc('year', current_date)::date), 0)::numeric(12,2) as ytd_expenses,
  coalesce((select sum(e.amount) from public.expenses_by_category e where e.boat_id = b.id and e.date > current_date - interval '12 months'), 0)::numeric(12,2) as expenses_12m,
  (select max(h.started_at) from public.haul_outs h where h.boat_id = b.id and h.deleted_at is null) as last_haul_out_at,
  (
    select (extract(year from age(current_date, max(h.started_at))) * 12 + extract(month from age(current_date, max(h.started_at))))::int
    from public.haul_outs h where h.boat_id = b.id and h.deleted_at is null
  ) as months_since_haul_out,
  (select count(*)::int from public.parts pa where pa.boat_id = b.id and pa.min_quantity > 0 and pa.quantity <= pa.min_quantity) as low_stock_parts,
  (
    select count(*)::int from public.engines en
    where en.boat_id = b.id and en.is_active
      and not exists (select 1 from public.engine_current_hours ech where ech.engine_id = en.id)
  ) as engines_without_reading
from public.boats b;

-- ---------------------------------------------------------------------------------------------
-- 12. boat_todo_queue: the single dashboard queue mixing interventions and checklist items
--     (audit §3.5, UX §2.4). security invoker: the caller's RLS decides what it sees.
--     sort_key is always "smaller first" inside a rank; title breaks ties so the list never jumps.
--     Hour/day conversion: the "soon" threshold is 30 days OR 25 hours, so 1 engine hour ≈ 1.2 day.
-- ---------------------------------------------------------------------------------------------
create or replace function public.boat_todo_queue(p_boat_id uuid, p_limit int default 10)
returns table (
  rank int,
  kind text,
  id uuid,
  title text,
  category_id uuid,
  category_name text,
  category_color text,
  engine_id uuid,
  engine_label text,
  status text,
  due_at date,
  due_hours numeric,
  days_remaining int,
  hours_remaining numeric,
  severity numeric,
  sort_key numeric
)
language sql stable
set search_path = ''
as $$
  with queue as (
    -- rank 0: urgent interventions, oldest first
    select
      0 as rank,
      'log'::text as kind,
      l.id,
      l.title,
      l.category_id,
      l.category_name,
      l.category_color,
      null::uuid as engine_id,
      null::text as engine_label,
      l.status::text as status,
      l.performed_at as due_at,
      null::numeric as due_hours,
      (l.performed_at - current_date) as days_remaining,
      null::numeric as hours_remaining,
      null::numeric as severity,
      (l.performed_at - date '1970-01-01')::numeric as sort_key
    from public.maintenance_logs_view l
    where l.boat_id = p_boat_id and l.status = 'urgent'

    union all

    -- rank 1: overdue checklist items, worst RELATIVE overdue first
    -- (1.0 = one whole interval late, so a 6-month item beats a 24-month one at equal delay)
    select
      1,
      'item',
      s.id,
      s.label,
      s.category_id,
      cat.name,
      cat.color,
      s.engine_id,
      e.label,
      s.status::text,
      s.due_at,
      s.due_hours,
      s.days_remaining,
      s.hours_remaining,
      greatest(
        coalesce((current_date - s.due_at)::numeric / greatest(coalesce(s.interval_months, 1) * 30, 30), 0),
        coalesce((s.current_hours - s.due_hours) / greatest(s.interval_hours, 25), 0)
      ),
      -greatest(
        coalesce((current_date - s.due_at)::numeric / greatest(coalesce(s.interval_months, 1) * 30, 30), 0),
        coalesce((s.current_hours - s.due_hours) / greatest(s.interval_hours, 25), 0)
      )
    from public.checklist_item_status s
    join public.boat_categories cat on cat.id = s.category_id
    left join public.engines e on e.id = s.engine_id
    where s.boat_id = p_boat_id and s.status = 'overdue'

    union all

    -- rank 2: interventions in progress, then planned within 30 days, by date
    select
      2,
      'log',
      l.id,
      l.title,
      l.category_id,
      l.category_name,
      l.category_color,
      null,
      null,
      l.status::text,
      l.performed_at,
      null,
      (l.performed_at - current_date),
      null,
      null,
      case when l.status = 'in_progress' then 0 else 1000000 end
        + (l.performed_at - date '1970-01-01')::numeric
    from public.maintenance_logs_view l
    where l.boat_id = p_boat_id
      and l.status in ('in_progress', 'planned')
      and l.performed_at <= current_date + 30

    union all

    -- rank 3: items due soon, closest deadline first (hours converted to days)
    select
      3,
      'item',
      s.id,
      s.label,
      s.category_id,
      cat.name,
      cat.color,
      s.engine_id,
      e.label,
      s.status::text,
      s.due_at,
      s.due_hours,
      s.days_remaining,
      s.hours_remaining,
      0::numeric,
      least(coalesce(s.days_remaining::numeric, 9999), coalesce(s.hours_remaining, 9999) * 1.2)
    from public.checklist_item_status s
    join public.boat_categories cat on cat.id = s.category_id
    left join public.engines e on e.id = s.engine_id
    where s.boat_id = p_boat_id and s.status = 'soon'
  )
  select
    q.rank, q.kind, q.id, q.title, q.category_id, q.category_name, q.category_color,
    q.engine_id, q.engine_label, q.status, q.due_at, q.due_hours,
    q.days_remaining, q.hours_remaining, q.severity, q.sort_key
  from queue q
  order by q.rank, q.sort_key, q.title
  limit greatest(coalesce(p_limit, 10), 0);
$$;

comment on function public.boat_todo_queue(uuid, int) is
  'Dashboard queue: urgent logs (0), overdue items by relative delay (1), in-progress then planned logs within 30 days (2), items due soon (3). Items with status never are excluded on purpose (audit §3.5).';

-- ---------------------------------------------------------------------------------------------
-- apply_checklist_template: stamp the anchor on every item it creates (D1)
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
  v_anchor_hours numeric(8,1);
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
          insert into public.checklist_items (boat_id, category_id, label, description, interval_months, interval_hours, actions, source, template_item_id, sort_order, anchor_date, external_ref, created_by, updated_by)
          values (p_boat_id, v_category_id, v_item.label, v_item.description, v_item.interval_months, v_item.interval_hours, v_item.actions, 'template', v_item.id, v_item.sort_order, current_date, v_item.external_ref, v_user, v_user)
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
          -- anchor hours = the engine's current reading, null when it has none yet
          select ech.hours into v_anchor_hours
            from public.engine_current_hours ech where ech.engine_id = v_engine.id;
          insert into public.checklist_items (boat_id, category_id, label, description, interval_months, interval_hours, engine_id, actions, source, template_item_id, sort_order, anchor_date, anchor_hours, external_ref, created_by, updated_by)
          values (p_boat_id, v_category_id, v_item.label || ' — ' || v_engine.label, v_item.description, v_item.interval_months, v_item.interval_hours, v_engine.id, v_item.actions, 'template', v_item.id, v_item.sort_order, current_date, v_anchor_hours, v_item.external_ref || ':' || v_engine_ref, v_user, v_user)
          on conflict (boat_id, external_ref) do nothing;
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 14. Harmonised category colours (art direction): only rows still carrying the exact former
--     colour are updated, so a user's own choice is never overwritten.
-- ---------------------------------------------------------------------------------------------
with harmonised (external_ref, old_color, new_color) as (
  values
    ('daggerboards_rudders', '#0EA5E9', '#0284C7'),
    ('sails_rigging',        '#7C3AED', '#A21CAF'),
    ('hull_deck',            '#64748B', '#52606F'),
    ('electronics_nav',      '#2563EB', '#1D4ED8'),
    ('energy',               '#EAB308', '#A16207'),
    ('plumbing_systems',     '#0D9488', '#0F766E'),
    ('safety',               '#DC2626', '#C81E2B')
)
update public.checklist_template_categories c
   set color = h.new_color
  from harmonised h
 where c.external_ref = h.external_ref and upper(c.color) = upper(h.old_color);

with harmonised (external_ref, old_color, new_color) as (
  values
    ('daggerboards_rudders', '#0EA5E9', '#0284C7'),
    ('sails_rigging',        '#7C3AED', '#A21CAF'),
    ('hull_deck',            '#64748B', '#52606F'),
    ('electronics_nav',      '#2563EB', '#1D4ED8'),
    ('energy',               '#EAB308', '#A16207'),
    ('plumbing_systems',     '#0D9488', '#0F766E'),
    ('safety',               '#DC2626', '#C81E2B')
)
update public.boat_categories c
   set color = h.new_color
  from harmonised h
 where c.external_ref = h.external_ref and upper(c.color) = upper(h.old_color);

-- ---------------------------------------------------------------------------------------------
-- Privileges (the new objects follow the rules of 0002/0003: nothing for anon)
-- ---------------------------------------------------------------------------------------------
revoke all on function public.checklist_compute_status(date, int, numeric, int, numeric, boolean, date, date) from public;
revoke all on function public.boat_todo_queue(uuid, int) from public;
revoke all on function public.apply_checklist_template(uuid, uuid, uuid) from public;
revoke all on function public.prevent_engine_delete_in_use() from public;
revoke all on function public.sync_log_readings_trash() from public;
revoke all on function public.reject_future_date() from public;
grant execute on function public.checklist_compute_status(date, int, numeric, int, numeric, boolean, date, date) to authenticated, service_role;
grant execute on function public.boat_todo_queue(uuid, int) to authenticated, service_role;
grant execute on function public.apply_checklist_template(uuid, uuid, uuid) to authenticated, service_role;

grant select on
  public.checklist_item_status, public.checklist_category_progress, public.maintenance_logs_view,
  public.maintenance_logs_trash_view, public.boat_invitations_safe, public.expenses_by_category,
  public.boat_dashboard_stats
  to authenticated, service_role;
revoke all on
  public.checklist_item_status, public.checklist_category_progress, public.maintenance_logs_view,
  public.maintenance_logs_trash_view, public.boat_invitations_safe, public.expenses_by_category,
  public.boat_dashboard_stats
  from anon;
