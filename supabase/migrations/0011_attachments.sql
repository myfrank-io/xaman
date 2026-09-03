-- 0011_attachments.sql — E10-1: the paperwork of an intervention (invoice, quote, photos of the
-- work) and of a purchase. The `attachments` table, its RLS policies and the private
-- `boat-files` bucket already exist since 0001 / 0002; this migration turns them into a feature:
--   1. `caption` and `deleted_at` — a legend under the thumbnail, and the soft delete of rule 9
--      (the Storage object survives, so « Annuler » really restores the document);
--   2. `attachments_path_boat` — the storage path must resolve to the row's boat through the
--      helper the Storage policies already use: a row can never point at another boat's object;
--   3. `attachments_mime_allowed` — images and PDF only (SPEC S1);
--   4. `attachments_owner_guard()` — the polymorphic owner cannot be a foreign key, so a trigger
--      does the work of one: the owning row must exist *and* belong to the same boat. It runs
--      security invoker, so you may only hang a document off a row you can read;
--   5. `cleanup_attachments()` — a hard delete of the owner (purge_trash after 30 days, or a
--      cascade) takes its attachments with it, as announced in DATA-MODEL §4;
--   6. `maintenance_logs_view.attachments_count` stops counting the documents in the trash — it
--      is the paperclip of the journal list;
--   7. the bucket itself refuses more than 10 Mo and anything but an image or a PDF, so a broken
--      client cannot write what the table would reject.

-- ---------------------------------------------------------------------------------------------
-- 1-3. Columns and constraints
-- ---------------------------------------------------------------------------------------------
alter table public.attachments add column if not exists caption text;
alter table public.attachments add column if not exists deleted_at timestamptz;

comment on column public.attachments.caption is
  'Free legend shown under the thumbnail (E10-1); null = no legend.';
comment on column public.attachments.deleted_at is
  'Soft delete (rule 9): the row is hidden, the Storage object is kept so « Annuler » restores it.';

alter table public.attachments drop constraint if exists attachments_caption_length;
alter table public.attachments
  add constraint attachments_caption_length
  check (caption is null or char_length(caption) <= 200);

-- The path is what the Storage policies read: forcing it to resolve to this row's boat means a
-- readable row can never name an object the reader is not allowed to download.
-- `is not distinct from` and not `=`: a malformed path returns null, and a check constraint
-- accepts null — the loose « photo.jpg » would have slipped straight through.
alter table public.attachments drop constraint if exists attachments_path_boat;
alter table public.attachments
  add constraint attachments_path_boat
  check (public.boat_id_from_storage_path(storage_path) is not distinct from boat_id);

alter table public.attachments drop constraint if exists attachments_mime_allowed;
alter table public.attachments
  add constraint attachments_mime_allowed
  check (mime_type = 'application/pdf' or mime_type like 'image/%');

-- One row per object: a retried upload upserts on the id and rewrites the same path.
create unique index if not exists attachments_storage_path_key on public.attachments (storage_path);
-- The gallery of one owner, trashed rows excluded.
create index if not exists attachments_owner_live_idx
  on public.attachments (boat_id, entity_type, entity_id)
  where deleted_at is null;

-- ---------------------------------------------------------------------------------------------
-- 4. Polymorphic integrity: the owner must exist, and be on the same boat
-- ---------------------------------------------------------------------------------------------
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
  case new.entity_type
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

comment on function public.attachments_owner_guard() is
  'What a foreign key would do for a polymorphic owner: the (entity_type, entity_id) row must exist and carry the same boat_id.';

drop trigger if exists attachments_owner_guard on public.attachments;
create trigger attachments_owner_guard
  before insert or update of entity_type, entity_id, boat_id on public.attachments
  for each row execute function public.attachments_owner_guard();

-- ---------------------------------------------------------------------------------------------
-- 5. Hard delete of an owner takes its attachments with it (DATA-MODEL §4)
-- ---------------------------------------------------------------------------------------------
-- security definer: purge_trash() runs as postgres and a cascade may fire under any role; the
-- rows are already gone at that point, so there is nothing left to authorise.
create or replace function public.cleanup_attachments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.attachments a
   where a.entity_type = tg_argv[0]::public.attachment_entity
     and a.entity_id = old.id;
  return old;
end;
$$;

comment on function public.cleanup_attachments() is
  'after delete on an owning table: drops its attachment rows. The Storage objects are removed by the app before the purge.';

do $$
declare
  spec text[];
begin
  foreach spec slice 1 in array array[
    array['maintenance_logs', 'maintenance_log'],
    array['purchases', 'purchase'],
    array['equipment', 'equipment'],
    array['haul_outs', 'haul_out'],
    array['checklist_completions', 'checklist_completion']
  ]
  loop
    execute format('drop trigger if exists cleanup_attachments on public.%I', spec[1]);
    execute format(
      'create trigger cleanup_attachments after delete on public.%I for each row execute function public.cleanup_attachments(%L)',
      spec[1], spec[2]
    );
  end loop;
end;
$$;

-- Rule of 0009: no EXECUTE for PUBLIC / anon, and none for authenticated on a trigger function.
revoke execute on function public.attachments_owner_guard() from public, anon, authenticated;
revoke execute on function public.cleanup_attachments() from public, anon, authenticated;
grant execute on function public.attachments_owner_guard() to service_role;
grant execute on function public.cleanup_attachments() to service_role;

-- ---------------------------------------------------------------------------------------------
-- 5b. The update policy now that a soft delete exists
-- ---------------------------------------------------------------------------------------------
-- The policy written in 0002 predates `deleted_at`. Now that a document can be trashed, it is
-- rewritten to the exact shape of maintenance_logs_update: a pro edits their own rows (legend,
-- retry) but never moves anything to the trash — not even what they added themselves.
drop policy if exists "attachments_update" on public.attachments;
create policy "attachments_update" on public.attachments for update to authenticated
  using (
    public.can_write_boat(boat_id)
    or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid())
  )
  with check (
    public.can_write_boat(boat_id)
    or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid() and deleted_at is null)
  );

-- ---------------------------------------------------------------------------------------------
-- 6. The journal paperclip ignores the documents in the trash
-- ---------------------------------------------------------------------------------------------
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
  (
    select count(*)::int from public.attachments a
    where a.entity_type = 'maintenance_log' and a.entity_id = l.id and a.deleted_at is null
  ) as attachments_count,
  (select count(*)::int from public.purchases pu where pu.maintenance_log_id = l.id and pu.deleted_at is null) as purchases_count
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
left join public.contacts ct on ct.id = l.contact_id
left join public.equipment eq on eq.id = l.equipment_id
left join public.profiles p on p.id = l.created_by
where l.deleted_at is null;

-- ---------------------------------------------------------------------------------------------
-- 7. The bucket refuses what the table would reject
-- ---------------------------------------------------------------------------------------------
update storage.buckets
   set file_size_limit = 10 * 1024 * 1024,
       allowed_mime_types = array[
         'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'
       ]
 where id = 'boat-files';
