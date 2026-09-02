-- 0001_init.sql — Xaman initial schema (docs/DATA-MODEL.md §2–§4).
-- Scope (BACKLOG E0-3): extensions, enums, all tables, constraints, indexes, technical triggers.
-- RLS policies, views and business functions come in later migrations (0002_rls.sql, …).
-- Every table has RLS ENABLED here with no policy (deny-all for anon/authenticated) so that no
-- window exists where data is exposed; 0002_rls.sql adds the policies (CLAUDE.md rule 2).

-- ---------------------------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------------------------
-- Enumerations (§2)
-- ---------------------------------------------------------------------------------------------
create type public.organization_type as enum ('private', 'charter', 'club', 'builder', 'yard', 'pro');
create type public.boat_role as enum ('owner', 'editor', 'pro', 'viewer', 'renter');
create type public.boat_type as enum ('catamaran', 'trimaran', 'monohull_sail', 'motor', 'rib', 'other');
create type public.engine_position as enum ('port', 'starboard', 'center', 'outboard');
create type public.log_status as enum ('planned', 'in_progress', 'done', 'urgent');
create type public.log_priority as enum ('low', 'normal', 'high');
create type public.purchase_kind as enum ('gas', 'part', 'consumable', 'service', 'other');
create type public.hour_reading_source as enum ('manual', 'maintenance_log', 'checklist', 'import');
create type public.attachment_entity as enum ('maintenance_log', 'equipment', 'haul_out', 'purchase', 'boat', 'checklist_completion');
create type public.checklist_item_source as enum ('template', 'custom');

-- ---------------------------------------------------------------------------------------------
-- Technical trigger functions (§4)
-- ---------------------------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Mirror auth.users into public.profiles (created on sign-up / admin invite).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

-- Keep profiles.email in sync when the auth e-mail changes.
create or replace function public.handle_user_email_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3.1 profiles
-- ---------------------------------------------------------------------------------------------
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null unique,
  full_name         text,
  avatar_url        text,
  locale            text not null default 'fr',
  is_platform_admin boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
comment on table public.profiles is 'Public mirror of auth.users, created by trigger on_auth_user_created.';
comment on column public.profiles.is_platform_admin is 'Platform admin (virtual owner of every boat). Only settable via SQL / service key.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.handle_user_email_updated();

-- ---------------------------------------------------------------------------------------------
-- 3.2 / 3.3 organizations (V2 — created now, no UI in V1)
-- ---------------------------------------------------------------------------------------------
create table public.organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  type       public.organization_type not null default 'private',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  role            text not null default 'member' check (role in ('admin', 'member')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (organization_id, user_id)
);

-- ---------------------------------------------------------------------------------------------
-- 3.13 checklist templates (global, instantiated per boat)
-- ---------------------------------------------------------------------------------------------
create table public.checklist_templates (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  builder               text,
  model                 text,
  boat_type             public.boat_type,
  version               int not null default 1,
  is_public             boolean not null default true,
  owner_organization_id uuid references public.organizations (id) on delete set null,
  external_ref          text unique,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table public.checklist_template_categories (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.checklist_templates (id) on delete cascade,
  name         text not null,
  color        text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon         text,
  sort_order   int not null default 0,
  external_ref text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (template_id, external_ref)
);

create table public.checklist_template_items (
  id                   uuid primary key default gen_random_uuid(),
  template_category_id uuid not null references public.checklist_template_categories (id) on delete cascade,
  label                text not null,
  description          text,
  interval_months      int check (interval_months > 0),
  interval_hours       int check (interval_hours > 0),
  engine_scope         text not null default 'none' check (engine_scope in ('none', 'inboard', 'outboard', 'all')),
  actions              jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  source               text check (source in ('briefing', 'proposal', 'builder')),
  sort_order           int not null default 0,
  external_ref         text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (template_category_id, external_ref),
  -- an interval in engine hours requires an engine
  constraint checklist_template_items_hours_need_engine check (interval_hours is null or engine_scope <> 'none')
);
comment on column public.checklist_template_items.engine_scope is 'none | inboard | outboard | all — apply_checklist_template duplicates the item per matching active engine.';

-- ---------------------------------------------------------------------------------------------
-- 3.4 boats
-- ---------------------------------------------------------------------------------------------
create table public.boats (
  id                    uuid primary key default gen_random_uuid(),
  organization_id       uuid references public.organizations (id) on delete set null,
  name                  text not null,
  builder               text,
  model                 text,
  hull_number           text,
  year                  int,
  type                  public.boat_type not null default 'monohull_sail',
  flag                  text,
  home_port             text,
  sail_number           text,
  length_m              numeric(5,2),
  beam_m                numeric(5,2),
  draft_m               numeric(5,2),
  photo_path            text,
  notes                 text,
  checklist_template_id uuid references public.checklist_templates (id) on delete set null,
  external_ref          text unique,
  created_by            uuid references public.profiles (id) on delete set null,
  updated_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ---------------------------------------------------------------------------------------------
-- 3.5 boat_members
-- ---------------------------------------------------------------------------------------------
create table public.boat_members (
  boat_id     uuid not null references public.boats (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.boat_role not null,
  valid_from  date,
  valid_until date,
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (boat_id, user_id),
  constraint boat_members_validity check (valid_from is null or valid_until is null or valid_until >= valid_from)
);
create index boat_members_user_id_idx on public.boat_members (user_id);

-- ---------------------------------------------------------------------------------------------
-- 3.6 boat_invitations
-- ---------------------------------------------------------------------------------------------
create table public.boat_invitations (
  id          uuid primary key default gen_random_uuid(),
  boat_id     uuid not null references public.boats (id) on delete cascade,
  email       text not null check (email = lower(email)),
  role        public.boat_role not null,
  token       text not null unique,
  invited_by  uuid references public.profiles (id) on delete set null,
  expires_at  timestamptz not null default now() + interval '14 days',
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index boat_invitations_boat_id_idx on public.boat_invitations (boat_id);
create index boat_invitations_email_idx on public.boat_invitations (email);

-- ---------------------------------------------------------------------------------------------
-- 3.7 engines
-- ---------------------------------------------------------------------------------------------
create table public.engines (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats (id) on delete cascade,
  label        text not null,
  position     public.engine_position not null,
  brand        text,
  model        text,
  serial       text,
  installed_at date,
  is_active    boolean not null default true,
  sort_order   int not null default 0,
  notes        text,
  external_ref text,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index engines_boat_id_idx on public.engines (boat_id, sort_order);

-- ---------------------------------------------------------------------------------------------
-- 3.9 boat_categories (the boat's "systems")
-- ---------------------------------------------------------------------------------------------
create table public.boat_categories (
  id                   uuid primary key default gen_random_uuid(),
  boat_id              uuid not null references public.boats (id) on delete cascade,
  name                 text not null,
  color                text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon                 text,
  sort_order           int not null default 0,
  template_category_id uuid references public.checklist_template_categories (id) on delete set null,
  is_active            boolean not null default true,
  external_ref         text,
  created_by           uuid references public.profiles (id) on delete set null,
  updated_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index boat_categories_boat_id_idx on public.boat_categories (boat_id, sort_order);

-- ---------------------------------------------------------------------------------------------
-- 3.10 equipment
-- ---------------------------------------------------------------------------------------------
create table public.equipment (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats (id) on delete cascade,
  category_id  uuid references public.boat_categories (id) on delete set null,
  name         text not null,
  brand        text,
  model        text,
  serial       text,
  quantity     int not null default 1 check (quantity >= 0),
  installed_at date,
  specs        jsonb not null default '{}'::jsonb check (jsonb_typeof(specs) = 'object'),
  notes        text,
  sort_order   int not null default 0,
  external_ref text,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index equipment_boat_id_idx on public.equipment (boat_id, category_id, sort_order);

-- ---------------------------------------------------------------------------------------------
-- 3.11 contacts (service providers directory, per boat in V1)
-- ---------------------------------------------------------------------------------------------
create table public.contacts (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats (id) on delete cascade,
  name         text not null,
  company      text,
  specialty    text not null,
  phone        text,
  email        text,
  address      text,
  notes        text,
  external_ref text,
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index contacts_boat_id_idx on public.contacts (boat_id, specialty);

-- ---------------------------------------------------------------------------------------------
-- 3.18 haul_outs (created before maintenance_logs, which references it)
-- ---------------------------------------------------------------------------------------------
create table public.haul_outs (
  id              uuid primary key default gen_random_uuid(),
  boat_id         uuid not null references public.boats (id) on delete cascade,
  started_at      date not null,
  ended_at        date check (ended_at is null or ended_at >= started_at),
  yard_contact_id uuid references public.contacts (id) on delete set null,
  yard_name       text,
  works           text,
  cost            numeric(10,2) check (cost is null or cost >= 0),
  currency        char(3) not null default 'EUR',
  notes           text,
  external_ref    text,
  deleted_at      timestamptz,
  created_by      uuid references public.profiles (id) on delete set null,
  updated_by      uuid references public.profiles (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index haul_outs_boat_id_idx on public.haul_outs (boat_id, started_at desc);

-- ---------------------------------------------------------------------------------------------
-- 3.12 maintenance_logs (journal des interventions)
-- ---------------------------------------------------------------------------------------------
create table public.maintenance_logs (
  id                   uuid primary key default gen_random_uuid(),
  boat_id              uuid not null references public.boats (id) on delete cascade,
  title                text not null check (char_length(title) between 1 and 160),
  category_id          uuid references public.boat_categories (id) on delete set null,
  status               public.log_status not null default 'done',
  priority             public.log_priority not null default 'normal',
  performed_at         date not null,
  next_due_at          date,
  cost                 numeric(10,2) check (cost is null or cost >= 0),
  currency             char(3) not null default 'EUR',
  contact_id           uuid references public.contacts (id) on delete set null,
  haul_out_id          uuid references public.haul_outs (id) on delete set null,
  notes                text,
  needs_review         boolean not null default false,
  pending_engine_hours jsonb check (pending_engine_hours is null or jsonb_typeof(pending_engine_hours) = 'object'),
  external_ref         text,
  deleted_at           timestamptz,
  created_by           uuid references public.profiles (id) on delete set null,
  updated_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (boat_id, external_ref)
);
comment on column public.maintenance_logs.pending_engine_hours is '{ "<engine_id>": <hours> } imported hours awaiting review; consumed by mark_log_reviewed.';
create index maintenance_logs_boat_performed_idx on public.maintenance_logs (boat_id, performed_at desc);
create index maintenance_logs_boat_status_idx on public.maintenance_logs (boat_id, status);
create index maintenance_logs_boat_category_idx on public.maintenance_logs (boat_id, category_id);
create index maintenance_logs_haul_out_idx on public.maintenance_logs (haul_out_id) where haul_out_id is not null;
create index maintenance_logs_search_idx on public.maintenance_logs
  using gin ((title || ' ' || coalesce(notes, '')) extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- 3.14 checklist_items
-- ---------------------------------------------------------------------------------------------
create table public.checklist_items (
  id               uuid primary key default gen_random_uuid(),
  boat_id          uuid not null references public.boats (id) on delete cascade,
  category_id      uuid not null references public.boat_categories (id) on delete restrict,
  label            text not null,
  description      text,
  interval_months  int check (interval_months > 0),
  interval_hours   int check (interval_hours > 0),
  engine_id        uuid references public.engines (id) on delete set null,
  actions          jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  source           public.checklist_item_source not null default 'custom',
  template_item_id uuid references public.checklist_template_items (id) on delete set null,
  is_active        boolean not null default true,
  sort_order       int not null default 0,
  external_ref     text,
  created_by       uuid references public.profiles (id) on delete set null,
  updated_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (boat_id, external_ref),
  constraint checklist_items_hours_need_engine check (interval_hours is null or engine_id is not null)
);
create index checklist_items_boat_category_idx on public.checklist_items (boat_id, category_id, sort_order);
create index checklist_items_engine_idx on public.checklist_items (engine_id) where engine_id is not null;

-- ---------------------------------------------------------------------------------------------
-- 3.15 checklist_completions
-- ---------------------------------------------------------------------------------------------
create table public.checklist_completions (
  id                 uuid primary key default gen_random_uuid(),
  boat_id            uuid not null references public.boats (id) on delete cascade,
  checklist_item_id  uuid not null references public.checklist_items (id) on delete cascade,
  completed_at       date not null default current_date,
  completed_by       uuid references public.profiles (id) on delete set null,
  completed_by_name  text,
  engine_hours       numeric(8,1) check (engine_hours is null or engine_hours >= 0),
  note               text,
  maintenance_log_id uuid references public.maintenance_logs (id) on delete set null,
  created_by         uuid references public.profiles (id) on delete set null,
  updated_by         uuid references public.profiles (id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index checklist_completions_item_idx on public.checklist_completions (checklist_item_id, completed_at desc);
create index checklist_completions_boat_idx on public.checklist_completions (boat_id);
create index checklist_completions_log_idx on public.checklist_completions (maintenance_log_id) where maintenance_log_id is not null;

-- ---------------------------------------------------------------------------------------------
-- 3.8 engine_hour_readings
-- ---------------------------------------------------------------------------------------------
create table public.engine_hour_readings (
  id                      uuid primary key default gen_random_uuid(),
  boat_id                 uuid not null references public.boats (id) on delete cascade,
  engine_id               uuid not null references public.engines (id) on delete cascade,
  hours                   numeric(8,1) not null check (hours >= 0),
  read_at                 date not null default current_date,
  source                  public.hour_reading_source not null default 'manual',
  maintenance_log_id      uuid references public.maintenance_logs (id) on delete set null,
  checklist_completion_id uuid references public.checklist_completions (id) on delete set null,
  note                    text,
  created_by              uuid references public.profiles (id) on delete set null,
  updated_by              uuid references public.profiles (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  unique (maintenance_log_id, engine_id),
  unique (checklist_completion_id)
);
create index engine_hour_readings_engine_idx on public.engine_hour_readings (engine_id, read_at desc, created_at desc);
create index engine_hour_readings_boat_idx on public.engine_hour_readings (boat_id);

-- ---------------------------------------------------------------------------------------------
-- 3.17 parts (spare parts stock)
-- ---------------------------------------------------------------------------------------------
create table public.parts (
  id                  uuid primary key default gen_random_uuid(),
  boat_id             uuid not null references public.boats (id) on delete cascade,
  name                text not null,
  reference           text,
  category_id         uuid references public.boat_categories (id) on delete set null,
  quantity            numeric(8,2) not null default 0 check (quantity >= 0),
  min_quantity        numeric(8,2) not null default 0 check (min_quantity >= 0),
  unit                text not null default 'pc',
  location            text,
  supplier_contact_id uuid references public.contacts (id) on delete set null,
  notes               text,
  external_ref        text,
  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index parts_boat_id_idx on public.parts (boat_id, category_id);

-- ---------------------------------------------------------------------------------------------
-- 3.16 purchases (achats, gaz, consommables)
-- ---------------------------------------------------------------------------------------------
create table public.purchases (
  id                  uuid primary key default gen_random_uuid(),
  boat_id             uuid not null references public.boats (id) on delete cascade,
  purchased_at        date not null,
  kind                public.purchase_kind not null default 'other',
  designation         text not null,
  amount              numeric(10,2) check (amount is null or amount >= 0),
  currency            char(3) not null default 'EUR',
  quantity            numeric(8,2) not null default 1,
  supplier_contact_id uuid references public.contacts (id) on delete set null,
  supplier_name       text,
  category_id         uuid references public.boat_categories (id) on delete set null,
  bottle_type         text,
  maintenance_log_id  uuid references public.maintenance_logs (id) on delete set null,
  part_id             uuid references public.parts (id) on delete set null,
  notes               text,
  needs_review        boolean not null default false,
  external_ref        text,
  deleted_at          timestamptz,
  created_by          uuid references public.profiles (id) on delete set null,
  updated_by          uuid references public.profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (boat_id, external_ref)
);
create index purchases_boat_purchased_idx on public.purchases (boat_id, purchased_at desc);
create index purchases_boat_kind_idx on public.purchases (boat_id, kind);
create index purchases_log_idx on public.purchases (maintenance_log_id) where maintenance_log_id is not null;

-- ---------------------------------------------------------------------------------------------
-- 3.19 attachments (polymorphic, Should)
-- ---------------------------------------------------------------------------------------------
create table public.attachments (
  id           uuid primary key default gen_random_uuid(),
  boat_id      uuid not null references public.boats (id) on delete cascade,
  entity_type  public.attachment_entity not null,
  entity_id    uuid not null,
  storage_path text not null,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   int not null check (size_bytes > 0 and size_bytes <= 10 * 1024 * 1024),
  created_by   uuid references public.profiles (id) on delete set null,
  updated_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index attachments_entity_idx on public.attachments (boat_id, entity_type, entity_id);

-- ---------------------------------------------------------------------------------------------
-- updated_at triggers on every public table carrying the column
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select c.table_name
    from information_schema.columns c
    join information_schema.tables tb
      on tb.table_schema = c.table_schema and tb.table_name = c.table_name
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
      and tb.table_type = 'BASE TABLE'
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t
    );
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- RLS enabled everywhere (no policy yet = deny-all for anon/authenticated). Policies: 0002_rls.sql.
-- ---------------------------------------------------------------------------------------------
do $$
declare
  t text;
begin
  for t in
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end;
$$;
