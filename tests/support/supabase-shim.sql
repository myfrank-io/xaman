-- Minimal Supabase-compatible environment for a *vanilla* Postgres.
-- Lets the migrations and the RLS tests run without Docker (e.g. a sandbox where `supabase start`
-- cannot pull images). CI and local development use the real stack (`supabase start`), which
-- already provides everything below. Idempotent.
--
-- Mirrors: API roles, schemas auth / extensions / storage, auth.uid()/email()/role()/jwt(),
-- a subset of auth.users, storage.buckets/objects + helpers, the supabase_realtime publication
-- and the default privileges Supabase grants on the public schema.

create schema if not exists extensions;
create schema if not exists auth;
create schema if not exists storage;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    create role supabase_auth_admin nologin noinherit;
  end if;
end;
$$;

grant usage on schema public, extensions, auth, storage to anon, authenticated, service_role;
grant all on schema public to postgres;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema extensions grant all on functions to anon, authenticated, service_role;
alter default privileges in schema storage grant all on tables to anon, authenticated, service_role;
alter default privileges in schema storage grant all on functions to anon, authenticated, service_role;

-- auth.users (subset of the real table)
create table if not exists auth.users (
  id                     uuid primary key default gen_random_uuid(),
  instance_id            uuid,
  aud                    text,
  role                   text,
  email                  text unique,
  encrypted_password     text,
  email_confirmed_at     timestamptz,
  last_sign_in_at        timestamptz,
  raw_user_meta_data     jsonb not null default '{}'::jsonb,
  raw_app_meta_data      jsonb not null default '{}'::jsonb,
  confirmation_token     text,
  recovery_token         text,
  email_change_token_new text,
  email_change           text,
  is_sso_user            boolean not null default false,
  is_anonymous           boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
grant all on auth.users to supabase_auth_admin, service_role;

-- Same definitions as the Supabase image (claims injected by PostgREST via request.jwt.claims)
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'sub')
    ),
    ''
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.role', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'role')
    ),
    ''
  )::text
$$;

create or replace function auth.email() returns text
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.email', true),
      (current_setting('request.jwt.claims', true)::jsonb ->> 'email')
    ),
    ''
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on function auth.uid(), auth.role(), auth.email(), auth.jwt() to anon, authenticated, service_role;

-- storage (subset)
create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null unique,
  owner              uuid,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[],
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists storage.objects (
  id               uuid primary key default gen_random_uuid(),
  bucket_id        text references storage.buckets (id),
  name             text,
  owner            uuid,
  owner_id         text,
  metadata         jsonb,
  version          text,
  path_tokens      text[] generated always as (string_to_array(name, '/')) stored,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);
alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;
grant all on storage.buckets, storage.objects to anon, authenticated, service_role;

create or replace function storage.foldername(name text) returns text[]
language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[1 : array_length(_parts, 1) - 1];
end;
$$;

create or replace function storage.filename(name text) returns text
language plpgsql immutable as $$
declare
  _parts text[];
begin
  select string_to_array(name, '/') into _parts;
  return _parts[array_length(_parts, 1)];
end;
$$;

create or replace function storage.extension(name text) returns text
language plpgsql immutable as $$
declare
  _parts text[];
  _filename text;
begin
  select string_to_array(name, '/') into _parts;
  select _parts[array_length(_parts, 1)] into _filename;
  return reverse(split_part(reverse(_filename), '.', 1));
end;
$$;

-- realtime publication (migrations add tables to it)
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

-- Storage migration 0055 (prevent direct deletes): statement triggers that refuse deletes on
-- storage.buckets / storage.objects unless the Storage API's GUC is set in the transaction.
create or replace function storage.protect_delete() returns trigger
language plpgsql as $$
begin
  if coalesce(current_setting('storage.allow_delete_query', true), 'false') <> 'true' then
    raise exception 'Direct deletion from storage tables is not allowed. Use the Storage API instead.'
      using hint = 'This prevents accidental data loss from orphaned objects.', errcode = '42501';
  end if;
  return null;
end;
$$;
drop trigger if exists protect_buckets_delete on storage.buckets;
create trigger protect_buckets_delete before delete on storage.buckets
  for each statement execute function storage.protect_delete();
drop trigger if exists protect_objects_delete on storage.objects;
create trigger protect_objects_delete before delete on storage.objects
  for each statement execute function storage.protect_delete();
