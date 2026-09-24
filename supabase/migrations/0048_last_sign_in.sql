-- 0048_last_sign_in.sql — D152: distinguish "created the account" from "actually connected".
-- The Membres screen needs to know whether an invited member has ever signed in. auth.users has
-- last_sign_in_at, but that schema is never queryable by authenticated (no grants) — so it is
-- mirrored onto profiles the same way profiles.email already mirrors auth.users.email
-- (0001_init.sql: handle_new_user / on_auth_user_email_updated), via a new trigger on auth.users.

alter table public.profiles add column last_sign_in_at timestamptz;
comment on column public.profiles.last_sign_in_at is
  'Mirrors auth.users.last_sign_in_at (D152): null means the account was created but never used '
  'to sign in. Kept in sync by trigger on_auth_user_sign_in.';

create or replace function public.handle_user_sign_in()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set last_sign_in_at = new.last_sign_in_at where id = new.id;
  return new;
end;
$$;

create trigger on_auth_user_sign_in
  after update of last_sign_in_at on auth.users
  for each row
  when (old.last_sign_in_at is distinct from new.last_sign_in_at)
  execute function public.handle_user_sign_in();

-- Column privileges: readable like the rest of profiles (RLS already scopes rows to self and
-- co-members), never writable by authenticated — the grant list in 0002_rls.sql already omits it.
