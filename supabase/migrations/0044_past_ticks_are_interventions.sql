-- 0044_past_ticks_are_interventions.sql — E20-5 / D142.
--
-- 0042 made a tick write an intervention (D140). It said nothing about the ticks that came
-- before it: each of those left a `checklist_completions` row and nothing in the journal, so the
-- carnet still told two stories depending on the screen you opened — « fait le 17/08 » on the
-- point, and nothing at all in the interventions. This migration writes the missing half.
--
-- For every past tick it writes the line the same tick would write today — the point's label as
-- title, its system (column and D118 link), the day, the note, the counter read — then hands the
-- completion to it, then names the point on the line. From that last step on, the completion is
-- derived by `sync_log_completion()` like any other: the same row, now owned by the intervention.
--
-- The intervention takes the completion's own id. That is not a coincidence: `completeChecklistItem`
-- already uses a completion's id as its line's id when it replays a tick queued before D140
-- (`drawnLogId = logId ?? id ?? randomUUID()`), so an entry still waiting in an offline queue
-- lands on the very row written here instead of writing a second one.
--
-- What the derivation would change, it does not: the upsert keeps the frozen name (D31) and the
-- author of a completion it did not write, and rewrites only date and hours — which are the ones
-- taken from that completion. Two shapes are left exactly as they are rather than risk them:
--   * hours recorded on a point that has no engine — an intervention has nowhere to carry them,
--     and the derivation, finding none, would drop them;
--   * a completion whose id is already a line's id — impossible in practice, fatal if assumed.
-- Both stay ordinary completions, and the feed goes on telling them itself.
--
-- Re-runnable: `maintenance_log_id is null` is the marker, and the last step clears it.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The ticks that have no intervention behind them
-- ---------------------------------------------------------------------------------------------
create temporary table backfill_ticks as
select cc.id as completion_id
  from public.checklist_completions cc
  join public.checklist_items i
    on i.id = cc.checklist_item_id and i.boat_id = cc.boat_id
 where cc.maintenance_log_id is null
   and (cc.engine_hours is null or i.engine_id is not null)
   and not exists (select 1 from public.maintenance_logs l where l.id = cc.id);

-- ---------------------------------------------------------------------------------------------
-- 2. The intervention each of them is
-- ---------------------------------------------------------------------------------------------
-- `checklist_item_id` is deliberately left null here: the point is named in step 6, once the
-- line carries everything the derivation reads. Named now, `sync_log_completion()` would write a
-- second completion beside the one being rescued.
--
-- « Réalisé par » (D32): the completion carries a frozen name (D31), the intervention a provider.
-- When the boat's directory holds exactly one contact by that name, the line names them — the
-- feed then reads as it did. When it holds none, or several, the line stays in the name of
-- whoever wrote it and the frozen name stays on the completion, which is what a tick does today.
insert into public.maintenance_logs
  (id, boat_id, title, category_id, status, performed_at, notes, contact_id,
   created_by, updated_by, created_at, updated_at)
with named_contacts as (
  select c.boat_id, lower(btrim(c.name)) as name_key, (array_agg(c.id))[1] as contact_id
    from public.contacts c
   where c.deleted_at is null and btrim(coalesce(c.name, '')) <> ''
   group by c.boat_id, lower(btrim(c.name))
  having count(*) = 1
)
select cc.id,
       cc.boat_id,
       -- A label longer than a title is truncated rather than refused (title is capped at 160).
       left(i.label, 160),
       i.category_id,
       'done',
       cc.completed_at,
       cc.note,
       nc.contact_id,
       cc.created_by,
       coalesce(cc.updated_by, cc.created_by),
       -- The day the fact was recorded, not today: `boat_activity` reads it, and a carnet's
       -- history must not resurface as this week's activity.
       cc.created_at,
       cc.updated_at
  from backfill_ticks t
  join public.checklist_completions cc on cc.id = t.completion_id
  join public.checklist_items i on i.id = cc.checklist_item_id
  left join named_contacts nc
    on nc.boat_id = cc.boat_id
   and nc.name_key = lower(btrim(cc.completed_by_name));

-- ---------------------------------------------------------------------------------------------
-- 3. Its system, in the link table too (D118)
-- ---------------------------------------------------------------------------------------------
insert into public.maintenance_log_categories (log_id, category_id, boat_id, created_by)
select cc.id, i.category_id, cc.boat_id, cc.created_by
  from backfill_ticks t
  join public.checklist_completions cc on cc.id = t.completion_id
  join public.checklist_items i on i.id = cc.checklist_item_id
 where i.category_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------------------------
-- 4. The counter read the tick carried becomes the intervention's
-- ---------------------------------------------------------------------------------------------
-- `sync_engine_hours_from_completion()` wrote one reading per tick with hours; it is the same
-- fact, so it moves rather than doubles — the engine's history keeps one line, at the same date,
-- and `sync_log_completion()` finds the hours where it looks for them (log + engine).
update public.engine_hour_readings r
   set maintenance_log_id = t.completion_id,
       source = 'maintenance_log'
  from backfill_ticks t
 where r.checklist_completion_id = t.completion_id
   and r.maintenance_log_id is null;

-- A tick whose reading never made it (an import, a reading deleted since) gets one from the
-- completion itself, so an hour-based point is not un-ticked by the derivation.
insert into public.engine_hour_readings
  (boat_id, engine_id, hours, read_at, source, maintenance_log_id,
   created_by, updated_by, created_at, updated_at)
select cc.boat_id, i.engine_id, cc.engine_hours, cc.completed_at, 'maintenance_log', cc.id,
       cc.created_by, coalesce(cc.updated_by, cc.created_by), cc.created_at, cc.updated_at
  from backfill_ticks t
  join public.checklist_completions cc on cc.id = t.completion_id
  join public.checklist_items i on i.id = cc.checklist_item_id
 where cc.engine_hours is not null
   and i.engine_id is not null
   and not exists (
     select 1 from public.engine_hour_readings r
      where r.maintenance_log_id = cc.id and r.engine_id = i.engine_id
   );

-- ---------------------------------------------------------------------------------------------
-- 5. The completion belongs to the intervention
-- ---------------------------------------------------------------------------------------------
update public.checklist_completions cc
   set maintenance_log_id = cc.id
  from backfill_ticks t
 where cc.id = t.completion_id;

-- ---------------------------------------------------------------------------------------------
-- 6. The point the intervention is the doing of — and the database takes over
-- ---------------------------------------------------------------------------------------------
update public.maintenance_logs l
   set checklist_item_id = cc.checklist_item_id
  from backfill_ticks t
  join public.checklist_completions cc on cc.id = t.completion_id
 where l.id = t.completion_id;

-- ---------------------------------------------------------------------------------------------
-- 7. Nothing was lost on the way
-- ---------------------------------------------------------------------------------------------
-- The derivation deletes a completion it cannot account for (D140). If one of the rescued ticks
-- went that way, the whole migration goes back rather than a tick.
do $$
declare
  v_lost int;
begin
  select count(*) into v_lost
    from backfill_ticks t
   where not exists (
     select 1 from public.checklist_completions cc
      where cc.id = t.completion_id and cc.maintenance_log_id = t.completion_id
   );
  if v_lost > 0 then
    raise exception 'backfill would lose % completion(s)', v_lost
      using errcode = 'data_exception';
  end if;
end;
$$;

drop table backfill_ticks;

commit;
