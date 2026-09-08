-- 0026_inbox.sql — documents that arrive on their own, and become interventions once someone
-- has looked at them (D91).
--
-- « Je prends en photo mon ticket de caisse, ça l'analyse et ça crée automatiquement la facture
-- adéquate » ; « chaque bateau a une adresse e-mail dédiée : un fichier envoyé en pièce jointe
-- arrive pré-rempli, il faut juste vérifier les infos pour valider ».
--
-- Two doors, one table. A photo taken in the app and an attachment mailed to the boat's own
-- address both land in `inbox_items`: the file is in the bucket, the analysis (a Claude reading
-- of the document) is in `suggestion`, and the row waits for an owner or editor to validate it.
-- Validation writes the real intervention or purchase — through the very same Server Actions
-- the forms use — and links the document to it as an attachment. Nothing is ever written to
-- `maintenance_logs` or `purchases` by a machine alone: the row this table holds is a proposal,
-- and the person's tap is what turns it into a fact.
--
-- Security stays in the database (rule 2). Members read their boat's inbox; contributors add to
-- it (a pro photographing their own invoice is the nominal case); owners and editors validate or
-- dismiss. The webhook writes with the service key — it has no session — and the storage policies
-- already scope the object by the boat segment of its path.
--
-- The address is a random token, not the boat's name: `xaman-3f9a1c2b7d4e@…`. The name in front
-- is decoration for the reader; the app matches on the token alone, so a renamed boat keeps its
-- address and a guessed name opens nothing.

-- ---------------------------------------------------------------------------------------------
-- 1. The boat's own address
-- ---------------------------------------------------------------------------------------------
alter table public.boats
  add column if not exists inbox_token text not null
    default lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

create unique index if not exists boats_inbox_token_key on public.boats (inbox_token);

comment on column public.boats.inbox_token is
  'The random part of the boat''s inbound address (D91): <slug>-<token>@<INBOUND_EMAIL_DOMAIN>. '
  'The app matches an incoming mail on this token alone.';

-- ---------------------------------------------------------------------------------------------
-- 2. The inbox
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'inbox_source') then
    create type public.inbox_source as enum ('email', 'upload');
  end if;
  if not exists (select 1 from pg_type where typname = 'inbox_status') then
    create type public.inbox_status as enum ('received', 'analysing', 'ready', 'validated', 'dismissed');
  end if;
end;
$$;

create table if not exists public.inbox_items (
  id               uuid primary key default gen_random_uuid(),
  boat_id          uuid not null references public.boats (id) on delete cascade,
  source           public.inbox_source not null,
  status           public.inbox_status not null default 'received',
  received_at      timestamptz not null default now(),
  -- who sent it (e-mail only): shown on the card, never trusted for anything else
  sender_email     text,
  sender_name      text,
  subject          text,
  -- the document, in the bucket
  file_name        text not null,
  mime_type        text not null check (mime_type = 'application/pdf' or mime_type like 'image/%'),
  size_bytes       int not null check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),
  storage_path     text not null unique,
  -- what the analysis proposed, as the model returned it (validated again when read)
  suggestion       jsonb,
  -- why there is no suggestion: unsupported format, analysis failed, no key configured…
  error_key        text,
  -- what validation produced
  log_id           uuid references public.maintenance_logs (id) on delete set null,
  purchase_id      uuid references public.purchases (id) on delete set null,
  attachment_id    uuid references public.attachments (id) on delete set null,
  validated_by     uuid references public.profiles (id) on delete set null,
  validated_at     timestamptz,
  -- idempotency of the webhook: one row per (mail, attachment)
  external_ref     text,
  created_by       uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint inbox_items_path_boat
    check (public.boat_id_from_storage_path(storage_path) is not distinct from boat_id),
  constraint inbox_items_external_ref_key unique (boat_id, external_ref)
);

comment on table public.inbox_items is
  'Documents received by mail or photographed in the app, with the intervention or purchase the analysis proposes (D91). A row is a proposal until an owner or editor validates it.';

create index if not exists inbox_items_boat_status_idx on public.inbox_items (boat_id, status, received_at desc);

create trigger set_updated_at before update on public.inbox_items
  for each row execute function public.set_updated_at();

alter table public.inbox_items enable row level security;

create policy "inbox_items_select" on public.inbox_items for select to authenticated
  using (public.is_boat_member(boat_id));

-- A pro photographs the invoice of their own work: contribute, not write.
create policy "inbox_items_insert" on public.inbox_items for insert to authenticated
  with check (public.can_contribute_boat(boat_id) and created_by = auth.uid());

-- Validating and dismissing write the carnet: owner / editor.
create policy "inbox_items_update" on public.inbox_items for update to authenticated
  using (public.can_write_boat(boat_id))
  with check (public.can_write_boat(boat_id));

-- No delete policy: a dismissed document is a status, and its object stays in the bucket.

grant select, insert, update on public.inbox_items to authenticated;
grant all on public.inbox_items to service_role;
