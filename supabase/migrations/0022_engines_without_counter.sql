-- 0022_engines_without_counter.sql — an engine may simply have no hour meter.
--
-- Signalled in use, on the Moteurs tab: « Annexe (hors-bord) · compteur inconnu ». The dinghy's
-- outboard is an engine like any other (D68) and deserves its own servicing points, but nobody
-- will ever read hours off it — there is no meter on the casing. The app was asking anyway: a
-- « compteur inconnu » on the card, an amber « à mettre à jour » it can never satisfy, a chip in
-- the dashboard band, a line in « moteurs sans relevé », and an hour field in every intervention.
--
-- `engines.tracks_hours` says whether the engine has a meter at all. Default true: every engine
-- that exists today has one until someone says otherwise, and the column changes nothing for
-- them.
--
-- What follows from `false`:
--   * the engine is not counted as « sans relevé » (boat_dashboard_stats),
--   * its checklist points lose their hour deadline (checklist_item_status.interval_hours), so a
--     « toutes les 100 h » inherited from a template stops pretending to be a deadline nothing
--     can ever compute,
--   * and ticking such a point no longer demands hours (check_completion_hours), which was a
--     dead end: the trigger refused the completion and no counter could ever be read.
--
-- Nothing is erased. `checklist_items.interval_hours` keeps its value, the readings history keeps
-- its rows: the day a meter is fitted, the box is unticked and every hour deadline comes back.

alter table public.engines
  add column if not exists tracks_hours boolean not null default true;

comment on column public.engines.tracks_hours is
  'false when the engine has no hour meter (a dinghy outboard, D71): no reading is asked for, and '
  'its checklist points lose their hour deadline. The stored interval_hours is kept, not erased.';

-- ---------------------------------------------------------------------------------------------
-- 1. Ticking a point of a meterless engine no longer demands hours.
--    An item carrying interval_hours on such an engine is a template leftover, not a deadline.
-- ---------------------------------------------------------------------------------------------
create or replace function public.check_completion_hours()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_interval_hours int;
begin
  select i.interval_hours into v_interval_hours
    from public.checklist_items i
    left join public.engines e on e.id = i.engine_id
    where i.id = new.checklist_item_id
      and coalesce(e.tracks_hours, true);
  if v_interval_hours is not null and new.engine_hours is null then
    raise exception 'engine_hours_required' using errcode = '23514',
      detail = 'This checklist item has an interval in engine hours: engine_hours is required';
  end if;
  return new;
end;
$$;

comment on function public.check_completion_hours() is
  'engine_hours is mandatory when the item counts engine hours — unless its engine has no meter '
  '(engines.tracks_hours = false, D71), where no counter can ever be read.';

-- ---------------------------------------------------------------------------------------------
-- 2. checklist_item_status: same columns as 0004 in the same order (create or replace keeps the
--    grants and the dependent boat_dashboard_stats), with the hour interval neutralised for a
--    meterless engine and `engine_tracks_hours` appended at the end for the screens.
-- ---------------------------------------------------------------------------------------------
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
    -- an hour deadline needs a meter: without one it is not a deadline, it is a wish (D71)
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
  b.engine_tracks_hours
from base b
cross join lateral public.checklist_compute_status(
  b.reference_at, b.interval_months, b.reference_hours, b.interval_hours,
  b.current_hours, b.has_completion, b.fixed_due_at, current_date
) s;

comment on view public.checklist_item_status is
  'Status of every active checklist item (audit annex A): reference = last completion or anchor, '
  'a fixed next_due_at wins over the interval, hour deadlines neutralised after a counter reset '
  'and on an engine without a meter (D71), items of an inactive engine excluded.';

-- ---------------------------------------------------------------------------------------------
-- 3. « Moteurs sans relevé » stops counting the engines that will never have one.
--    Same column list as 0012, so `create or replace` keeps the grants and the security_invoker.
-- ---------------------------------------------------------------------------------------------
create or replace view public.boat_dashboard_stats
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
  (
    select count(*)::int from public.parts pa
    where pa.boat_id = b.id and pa.deleted_at is null
      and pa.min_quantity > 0 and pa.quantity <= pa.min_quantity
  ) as low_stock_parts,
  (
    select count(*)::int from public.engines en
    where en.boat_id = b.id and en.is_active and en.tracks_hours
      and not exists (select 1 from public.engine_current_hours ech where ech.engine_id = en.id)
  ) as engines_without_reading
from public.boats b;
