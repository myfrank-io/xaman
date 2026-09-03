-- 0012_trash_for_everything.sql — « update la corbeille pour qu'il y ait tout dedans » (D40, D41).
--
-- Rule 9 used to name three tables — interventions, purchases, haul-outs. Everything else the UI
-- could remove was either archived (a system, a checklist point, an engine, a piece of equipment,
-- all already reversible) or destroyed on the spot with no way back. Two things fell in the second
-- group and hold real data: the spare-parts stock and the boat's directory of providers.
--
--   1. `parts.deleted_at` — reverses D10. A part is an object aboard, not a scratch note: a named
--      confirmation is not the same thing as being unrecoverable.
--   2. `contacts.deleted_at` — a hard delete fired `on delete set null` on every intervention,
--      purchase, part and haul-out that named the provider. Trashing keeps those links intact and
--      only severs them if the row is really purged 30 days later.
--   3. Both natural keys become *partial*: `unique (boat_id, external_ref)` counted trashed rows,
--      so re-importing a sheet after trashing one of its lines raised 23505 on a row nobody could
--      see. The same trap on logs and purchases is recorded in DECISIONS (still open).
--   4. `adjust_part_quantity()` stops at trashed rows — the + / − of the stock list must not
--      move a quantity on a line that is in the trash.
--   5. `boat_dashboard_stats.low_stock_parts` stops counting them, or the dashboard would send you
--      shopping for a part you removed.
--   6. `purge_trash()` gains parts, contacts *and* attachments. Attachments have carried
--      `deleted_at` since 0011 but no purge ever named them: a trashed document stayed forever.
--
-- RLS needs no new policy: `parts` and `contacts` are owner/editor tables (0002) whose update
-- policy is already `can_write_boat` on both sides, so a soft delete is a write a pro or a viewer
-- cannot perform. tests/unit/rls.test.ts pins that down for the new column.

-- ---------------------------------------------------------------------------------------------
-- 1. The two new columns
-- ---------------------------------------------------------------------------------------------
alter table public.parts add column if not exists deleted_at timestamptz;
comment on column public.parts.deleted_at is
  'Soft delete (rule 9, D40): the line is in the trash, restorable for 30 days.';

alter table public.contacts add column if not exists deleted_at timestamptz;
comment on column public.contacts.deleted_at is
  'Soft delete (rule 9, D41): trashing keeps every link to the rows naming this provider; purging severs them.';

-- ---------------------------------------------------------------------------------------------
-- 2. Indexes: the lists read « the live rows of this boat », and the natural key ignores the trash
-- ---------------------------------------------------------------------------------------------
-- The stock list reads the live parts of one boat and filters them by system; the trash screen
-- reads the other side of the same column, newest first.
drop index if exists public.parts_boat_id_idx;
create index if not exists parts_boat_live_idx
  on public.parts (boat_id, category_id)
  where deleted_at is null;
create index if not exists parts_trash_idx
  on public.parts (boat_id, deleted_at desc)
  where deleted_at is not null;

drop index if exists public.contacts_boat_id_idx;
create index if not exists contacts_boat_live_idx
  on public.contacts (boat_id, specialty)
  where deleted_at is null;
create index if not exists contacts_trash_idx
  on public.contacts (boat_id, deleted_at desc)
  where deleted_at is not null;

-- A trashed row must not hold the reference of a row someone re-creates or re-imports.
alter table public.parts drop constraint if exists parts_boat_id_external_ref_key;
create unique index if not exists parts_boat_external_ref_live_key
  on public.parts (boat_id, external_ref)
  where deleted_at is null;

alter table public.contacts drop constraint if exists contacts_boat_id_external_ref_key;
create unique index if not exists contacts_boat_external_ref_live_key
  on public.contacts (boat_id, external_ref)
  where deleted_at is null;

-- ---------------------------------------------------------------------------------------------
-- 3. The + / − of the stock list ignores a trashed line
-- ---------------------------------------------------------------------------------------------
create or replace function public.adjust_part_quantity(p_part_id uuid, p_delta numeric)
returns numeric
language plpgsql
set search_path = ''
as $$
declare
  v_quantity numeric;
begin
  if p_delta is null or p_delta = 0 then
    raise exception 'invalid_delta' using errcode = '22023';
  end if;
  update public.parts
    set quantity = greatest(0, quantity + p_delta),
        checked_at = current_date,
        updated_by = auth.uid()
    where id = p_part_id
      and deleted_at is null
    returning quantity into v_quantity;
  if not found then
    raise exception 'part_not_found' using errcode = 'P0002';
  end if;
  return v_quantity;
end;
$$;

comment on function public.adjust_part_quantity(uuid, numeric) is
  'Atomic +/− on a live part of the stock (floored at 0), the line counting as checked today; a trashed line raises part_not_found.';

revoke all on function public.adjust_part_quantity(uuid, numeric) from public, anon;
grant execute on function public.adjust_part_quantity(uuid, numeric) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. The dashboard no longer counts a trashed part as missing from the stock.
--    Same column list as 0004, so `create or replace` keeps the grants and the security_invoker.
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
    where en.boat_id = b.id and en.is_active
      and not exists (select 1 from public.engine_current_hours ech where ech.engine_id = en.id)
  ) as engines_without_reading
from public.boats b;

-- ---------------------------------------------------------------------------------------------
-- 5. The nightly purge covers every table that has a trash.
--    Attachments first: a document trashed on its own has no owner to cascade from, and the ones
--    hanging off a purged intervention are dropped by the cleanup_attachments() trigger anyway.
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
  delete from public.attachments where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.maintenance_logs where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.purchases where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.haul_outs where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.parts where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  delete from public.contacts where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  return v_count;
end;
$$;

comment on function public.purge_trash() is
  'Nightly hard delete of everything trashed more than 30 days ago (rule 9, D40): attachments, interventions, purchases, haul-outs, parts, contacts.';

revoke all on function public.purge_trash() from public, anon, authenticated;
grant execute on function public.purge_trash() to service_role;
