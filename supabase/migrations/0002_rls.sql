-- 0002_rls.sql — Row Level Security: helper functions, policies, column privileges,
-- last-owner guard, invitation functions and the private Storage bucket (docs/DATA-MODEL.md §4–§5).
-- RLS itself was enabled on every table in 0001_init.sql (deny-all until now).

-- ---------------------------------------------------------------------------------------------
-- Helper functions (security definer, search_path pinned, schema-qualified names)
-- ---------------------------------------------------------------------------------------------
create or replace function public.is_platform_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

-- Active member of the boat? The platform admin is a virtual member of every boat.
create or replace function public.is_boat_member(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.boat_members m
    where m.boat_id = p_boat_id
      and m.user_id = auth.uid()
      and (m.valid_until is null or m.valid_until >= current_date)
      and (m.valid_from is null or m.valid_from <= current_date)
  ) or public.is_platform_admin();
$$;

-- Role on the boat: 'owner' for the platform admin (virtual owner), else the membership role, else null.
create or replace function public.boat_role(p_boat_id uuid)
returns public.boat_role
language sql stable security definer
set search_path = ''
as $$
  select case
    when public.is_platform_admin() then 'owner'::public.boat_role
    else (
      select m.role
      from public.boat_members m
      where m.boat_id = p_boat_id
        and m.user_id = auth.uid()
        and (m.valid_until is null or m.valid_until >= current_date)
        and (m.valid_from is null or m.valid_from <= current_date)
    )
  end;
$$;

create or replace function public.is_boat_owner(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.boat_role(p_boat_id) = 'owner'::public.boat_role;
$$;

create or replace function public.can_write_boat(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.boat_role(p_boat_id) in ('owner'::public.boat_role, 'editor'::public.boat_role);
$$;

create or replace function public.can_contribute_boat(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select public.boat_role(p_boat_id) in ('owner'::public.boat_role, 'editor'::public.boat_role, 'pro'::public.boat_role);
$$;

-- Does the current user share at least one boat with p_user_id? (profiles visibility)
create or replace function public.shares_boat_with(p_user_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.boat_members a
    join public.boat_members b on b.boat_id = a.boat_id
    where a.user_id = auth.uid() and b.user_id = p_user_id
  );
$$;

-- boat id from a Storage object name `boats/{boat_id}/…` (null when the path is malformed)
create or replace function public.boat_id_from_storage_path(p_name text)
returns uuid
language sql immutable
set search_path = ''
as $$
  select case
    when p_name ~ '^boats/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/'
      then split_part(p_name, '/', 2)::uuid
    else null
  end;
$$;

revoke all on function public.is_platform_admin() from public;
revoke all on function public.is_boat_member(uuid) from public;
revoke all on function public.boat_role(uuid) from public;
revoke all on function public.is_boat_owner(uuid) from public;
revoke all on function public.can_write_boat(uuid) from public;
revoke all on function public.can_contribute_boat(uuid) from public;
revoke all on function public.shares_boat_with(uuid) from public;
revoke all on function public.boat_id_from_storage_path(text) from public;
grant execute on function
  public.is_platform_admin(), public.is_boat_member(uuid), public.boat_role(uuid),
  public.is_boat_owner(uuid), public.can_write_boat(uuid), public.can_contribute_boat(uuid),
  public.shares_boat_with(uuid), public.boat_id_from_storage_path(text)
  to authenticated, service_role;
grant execute on function public.boat_id_from_storage_path(text) to anon;

-- ---------------------------------------------------------------------------------------------
-- Invitations
-- ---------------------------------------------------------------------------------------------
-- Preview for /invite/[token]; callable anonymously; exposes nothing but what the page shows.
create or replace function public.get_invitation_preview(p_token text)
returns table (
  boat_name text,
  inviter_name text,
  email text,
  role public.boat_role,
  status text
)
language sql stable security definer
set search_path = ''
as $$
  select
    b.name as boat_name,
    coalesce(p.full_name, p.email) as inviter_name,
    i.email,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end as status
  from public.boat_invitations i
  join public.boats b on b.id = i.boat_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;

-- Accept an invitation: the signed-in user's e-mail must match. Returns the boat id.
create or replace function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_inv public.boat_invitations%rowtype;
  v_user_id uuid := auth.uid();
  v_email text := lower(coalesce(auth.email(), ''));
begin
  if v_user_id is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  select * into v_inv from public.boat_invitations where token = p_token for update;
  if not found then
    raise exception 'invitation_not_found' using errcode = 'P0002';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'invitation_accepted' using errcode = 'P0001';
  end if;
  if v_inv.revoked_at is not null then
    raise exception 'invitation_revoked' using errcode = 'P0001';
  end if;
  if v_inv.expires_at < now() then
    raise exception 'invitation_expired' using errcode = 'P0001';
  end if;
  if v_inv.email <> v_email then
    raise exception 'invitation_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.boat_members (boat_id, user_id, role, invited_by)
  values (v_inv.boat_id, v_user_id, v_inv.role, v_inv.invited_by)
  on conflict (boat_id, user_id) do update
    set role = excluded.role
    where public.boat_members.role <> 'owner'::public.boat_role;

  update public.boat_invitations
    set accepted_at = now(), accepted_by = v_user_id
    where id = v_inv.id;

  return v_inv.boat_id;
end;
$$;

revoke all on function public.get_invitation_preview(text) from public;
revoke all on function public.accept_invitation(text) from public;
grant execute on function public.get_invitation_preview(text) to anon, authenticated, service_role;
grant execute on function public.accept_invitation(text) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- Last-owner guard on boat_members (cascade-aware)
-- ---------------------------------------------------------------------------------------------
create or replace function public.ensure_last_owner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_other_owners int;
begin
  -- Only when an owner row is removed or loses the owner role
  if old.role <> 'owner'::public.boat_role then
    return coalesce(new, old);
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner'::public.boat_role
     and new.boat_id = old.boat_id and new.user_id = old.user_id then
    return new;
  end if;
  -- Cascades (boat or account deletion) run at trigger depth > 0: let them through
  if pg_trigger_depth() > 1 then
    return coalesce(new, old);
  end if;
  if not exists (select 1 from public.boats b where b.id = old.boat_id) then
    return coalesce(new, old);
  end if;

  select count(*) into v_other_owners
  from public.boat_members m
  where m.boat_id = old.boat_id
    and m.role = 'owner'::public.boat_role
    and m.user_id <> old.user_id;

  if v_other_owners = 0 then
    raise exception 'last_owner'
      using errcode = 'P0001', detail = 'A boat must keep at least one owner';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger ensure_last_owner
  before update or delete on public.boat_members
  for each row execute function public.ensure_last_owner();

-- ---------------------------------------------------------------------------------------------
-- Column privileges (defense in depth, in addition to RLS)
-- ---------------------------------------------------------------------------------------------
-- profiles: the user may only edit their display data; email is synced from auth, is_platform_admin is SQL-only
revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url, locale) on public.profiles to authenticated;
revoke insert, delete on public.profiles from authenticated;

-- boat_invitations: the token is never readable through the API; owners revoke by setting revoked_at
revoke select, update on public.boat_invitations from authenticated;
grant select (id, boat_id, email, role, invited_by, expires_at, accepted_at, accepted_by, revoked_at, created_at, updated_at)
  on public.boat_invitations to authenticated;
grant update (revoked_at) on public.boat_invitations to authenticated;
revoke delete on public.boat_invitations from authenticated;

-- anon never touches tables directly (functions above are the only entry points)
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------------------------
-- Policies
-- ---------------------------------------------------------------------------------------------
-- profiles
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_platform_admin() or public.shares_boat_with(id));
create policy "profiles_update" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- organizations (V2: platform admin only)
create policy "organizations_admin" on public.organizations for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "organization_members_admin" on public.organization_members for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- checklist templates: public templates readable by any signed-in user; writes by the platform admin
create policy "checklist_templates_select" on public.checklist_templates for select to authenticated
  using (is_public or public.is_platform_admin());
create policy "checklist_templates_write" on public.checklist_templates for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "checklist_template_categories_select" on public.checklist_template_categories for select to authenticated
  using (exists (
    select 1 from public.checklist_templates t
    where t.id = template_id and (t.is_public or public.is_platform_admin())
  ));
create policy "checklist_template_categories_write" on public.checklist_template_categories for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "checklist_template_items_select" on public.checklist_template_items for select to authenticated
  using (exists (
    select 1
    from public.checklist_template_categories c
    join public.checklist_templates t on t.id = c.template_id
    where c.id = template_category_id and (t.is_public or public.is_platform_admin())
  ));
create policy "checklist_template_items_write" on public.checklist_template_items for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- boats
create policy "boats_select" on public.boats for select to authenticated
  using (public.is_boat_member(id));
create policy "boats_insert" on public.boats for insert to authenticated
  with check (public.is_platform_admin());
create policy "boats_update" on public.boats for update to authenticated
  using (public.can_write_boat(id)) with check (public.can_write_boat(id));
create policy "boats_delete" on public.boats for delete to authenticated
  using (public.is_boat_owner(id));

-- boat_members
create policy "boat_members_select" on public.boat_members for select to authenticated
  using (public.can_write_boat(boat_id) or user_id = auth.uid());
create policy "boat_members_insert" on public.boat_members for insert to authenticated
  with check (public.is_boat_owner(boat_id));
create policy "boat_members_update" on public.boat_members for update to authenticated
  using (public.is_boat_owner(boat_id)) with check (public.is_boat_owner(boat_id));
create policy "boat_members_delete" on public.boat_members for delete to authenticated
  using (public.is_boat_owner(boat_id));

-- boat_invitations (owner only; column privileges above hide the token)
create policy "boat_invitations_select" on public.boat_invitations for select to authenticated
  using (public.is_boat_owner(boat_id));
create policy "boat_invitations_insert" on public.boat_invitations for insert to authenticated
  with check (public.is_boat_owner(boat_id) and invited_by = auth.uid());
create policy "boat_invitations_update" on public.boat_invitations for update to authenticated
  using (public.is_boat_owner(boat_id)) with check (public.is_boat_owner(boat_id));

-- Tables written by owner/editor only: select member, write can_write_boat
do $$
declare
  t text;
begin
  foreach t in array array[
    'engines', 'boat_categories', 'equipment', 'contacts', 'haul_outs', 'parts', 'purchases', 'checklist_items'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_boat_member(boat_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_write_boat(boat_id))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.can_write_boat(boat_id)) with check (public.can_write_boat(boat_id))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_boat(boat_id))', t || '_delete', t);
  end loop;
end;
$$;

-- Tables a pro may contribute to (own rows): maintenance_logs, checklist_completions,
-- engine_hour_readings, attachments
do $$
declare
  t text;
begin
  foreach t in array array['checklist_completions', 'engine_hour_readings', 'attachments']
  loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_boat_member(boat_id))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.can_contribute_boat(boat_id) and created_by = auth.uid())', t || '_insert', t);
    execute format($p$
      create policy %I on public.%I for update to authenticated
        using (public.can_write_boat(boat_id) or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid()))
        with check (public.can_write_boat(boat_id) or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid()))
    $p$, t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.can_write_boat(boat_id))', t || '_delete', t);
  end loop;
end;
$$;

create policy "maintenance_logs_select" on public.maintenance_logs for select to authenticated
  using (public.is_boat_member(boat_id));
create policy "maintenance_logs_insert" on public.maintenance_logs for insert to authenticated
  with check (public.can_contribute_boat(boat_id) and created_by = auth.uid());
-- a pro edits their own rows but cannot move them to the trash (soft delete = update)
create policy "maintenance_logs_update" on public.maintenance_logs for update to authenticated
  using (public.can_write_boat(boat_id) or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid()))
  with check (
    public.can_write_boat(boat_id)
    or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid() and deleted_at is null)
  );
create policy "maintenance_logs_delete" on public.maintenance_logs for delete to authenticated
  using (public.can_write_boat(boat_id));

-- ---------------------------------------------------------------------------------------------
-- Storage: private bucket boat-files, objects under boats/{boat_id}/…
-- ---------------------------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('boat-files', 'boat-files', false)
on conflict (id) do nothing;

create policy "boat_files_select" on storage.objects for select to authenticated
  using (bucket_id = 'boat-files' and public.is_boat_member(public.boat_id_from_storage_path(name)));
create policy "boat_files_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'boat-files' and public.can_contribute_boat(public.boat_id_from_storage_path(name)));
create policy "boat_files_update" on storage.objects for update to authenticated
  using (bucket_id = 'boat-files' and public.can_write_boat(public.boat_id_from_storage_path(name)))
  with check (bucket_id = 'boat-files' and public.can_write_boat(public.boat_id_from_storage_path(name)));
create policy "boat_files_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'boat-files' and public.can_write_boat(public.boat_id_from_storage_path(name)));
