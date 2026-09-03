-- 0014_equipment_trash.sql — « on ne peut supprimer aucun équipement ».
--
-- Reported from the boat: a piece of equipment created by mistake (a « Test ») could not be
-- deleted. The equipment sheet only offered « Déposer » — set `removed_at`, which takes the
-- piece off the boat but keeps its sheet in the inventory for its history. There was no way to
-- undo a mistaken creation.
--
-- The trash of D40/D41 covered every other object the app can remove — interventions, achats,
-- sorties de l'eau, pièces de stock, intervenants, documents — but deliberately left equipment
-- out, on the reasoning that a piece of equipment is archived (déposé), not deleted. That reads
-- well for a real fitting; it leaves no exit for a typo. Parts made exactly this move in 0012
-- (« an object aboard, not a scratch note ») — equipment gets the same treatment now, and keeps
-- « Déposer » alongside for the real case. D61.
--
-- `deleted_at` (the trash) is a different column from `removed_at` (déposé le): a piece can be
-- removed from the boat and later deleted, and the two dates mean different things.

alter table public.equipment add column if not exists deleted_at timestamptz;
comment on column public.equipment.deleted_at is
  'Trash (D61): soft delete for a mistaken creation, purged after 30 days. Distinct from removed_at (physically taken off the boat, kept for history).';

-- The active inventory excludes both the trashed and — as before — is ordered by sort_order.
create index if not exists equipment_active_idx
  on public.equipment (boat_id, category_id, sort_order)
  where deleted_at is null;
-- The trash screen lists the recently deleted, newest first.
create index if not exists equipment_trash_idx
  on public.equipment (boat_id, deleted_at desc)
  where deleted_at is not null;

-- Join the nightly purge, in the same order the function already reads.
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
  delete from public.equipment where deleted_at < now() - interval '30 days';
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  return v_count;
end;
$$;

comment on function public.purge_trash() is
  'Nightly hard delete of everything trashed more than 30 days ago (rule 9, D40): attachments, interventions, purchases, haul-outs, parts, contacts, equipment.';
