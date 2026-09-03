-- 0013_completion_idempotency_and_realtime.sql — close two write-path gaps found in the
-- September audit.
--
--   1. checklist_completions had no uniqueness per (maintenance_log_id, checklist_item_id).
--      Both "En faire un entretien récurrent" (createRecurringFromLog) and the completion sync
--      in saveLog plain-inserted, so a double-tap or a retried Server Action wrote a duplicate
--      acknowledgement of the same point on the same intervention (violates D18). A unique index
--      on the pair lets those writes upsert: the second one becomes a no-op. maintenance_log_id
--      is nullable and NULLs are distinct in a unique index, so completions created straight from
--      the "Fait" dialog (no linked intervention) are unaffected and may still repeat. Any
--      duplicate already written is collapsed to its earliest row first so the index can build.
--
--   2. checklist_item_status reads engines (counter_reset_at D12, is_active D14) and
--      boat_categories (is_active), but neither table was published on supabase_realtime, so a
--      lone counter reset, engine disable or category toggle never reached a second device live.
--      Both are added to the publication (mirrors src/lib/realtime/use-boat-realtime.ts).

begin;

-- 1. Collapse any pre-existing log-linked duplicate completions to the earliest row, then enforce
--    uniqueness. Only rows carrying a maintenance_log_id can duplicate meaningfully.
delete from public.checklist_completions c
using public.checklist_completions keep
where c.maintenance_log_id is not null
  and c.maintenance_log_id = keep.maintenance_log_id
  and c.checklist_item_id = keep.checklist_item_id
  and (keep.created_at, keep.id) < (c.created_at, c.id);

create unique index if not exists checklist_completions_log_item_key
  on public.checklist_completions (maintenance_log_id, checklist_item_id);

-- 2. Publish engines and boat_categories so D12/D14 status changes propagate live.
do $$
declare
  t text;
begin
  foreach t in array array['engines', 'boat_categories']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

commit;
