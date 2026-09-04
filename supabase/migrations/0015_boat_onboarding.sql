-- 0015_boat_onboarding.sql — « quand je crée un compte sans avoir été invité, évidemment que je
-- dois ajouter mon bateau ».
--
-- Until now a boat could only be born from the seed script: `boats_insert` is
-- `with check (public.is_platform_admin())` (0002), so someone who signed up without an
-- invitation reached `/boats`, read « Vous n'avez pas encore de bateau. Demandez une invitation
-- au propriétaire » and had nowhere to go. That was a deliberate V1 restriction
-- (DECISIONS 2026-09-02, SPEC §4.3) taken when there was one boat and one owner; it is now the
-- first wall a new user hits. D64 opens it.
--
-- The restriction is lifted **without** opening the table: `boats_insert` stays admin-only and
-- creation goes through this one security-definer entry point. Three things follow from that,
-- and they are the reason for the function rather than a looser policy:
--
--   * a boat is never born without an owner — the `boats` row and the `boat_members` row are
--     written in the same statement, so the « au moins un owner » rule of DATA-MODEL §3.5 holds
--     from the first millisecond and `ensure_last_owner` has something to guard;
--   * a boat is never born empty — the template is required, and the audit's « ne pas faire :
--     création libre de bateaux sans modèle » (§2) is enforced in the database, not in a form.
--     The categories, the checklist and its anchors arrive with the boat;
--   * the engines are created **before** the template is applied, because
--     `apply_checklist_template` only duplicates an engine-scoped point for engines that
--     already exist — and those carry every hour-based interval. A boat instantiated without
--     its engines has no « Vidange huile ».
--
-- The cap on owned boats replaces the abuse guard that « only the admin creates boats » used to
-- provide for free.

create or replace function public.create_boat(
  p_boat_id     uuid,
  p_name        text,
  p_template_id uuid,
  p_engines     jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_template record;
  v_engine   jsonb;
  v_label    text;
  v_position text;
  v_index    int := 0;
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;

  -- Idempotent (rule 11, D18): the form draws the id when it opens, so a double tap replays this
  -- call. A replay on a boat the caller already owns returns it untouched; any other existing id
  -- is someone else's boat and must not even be confirmed to exist.
  if exists (select 1 from public.boats b where b.id = p_boat_id) then
    if exists (
      select 1 from public.boat_members m
      where m.boat_id = p_boat_id and m.user_id = v_user and m.role = 'owner'
    ) then
      return p_boat_id;
    end if;
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if coalesce(length(btrim(p_name)), 0) = 0 or length(btrim(p_name)) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if (
    select count(*) from public.boat_members m
    where m.user_id = v_user and m.role = 'owner'
  ) >= 20 then
    raise exception 'boat_limit' using errcode = 'P0001';
  end if;

  -- A model is not optional: it is what makes the boat arrive already filled. A private template
  -- belongs to someone else, so only public ones (and the platform admin) can be instantiated.
  select t.* into v_template
    from public.checklist_templates t
   where t.id = p_template_id and (t.is_public or public.is_platform_admin());
  if not found then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;

  -- The model already knows what kind of boat this is and who built it: asking again would be a
  -- field the person has to fill for nothing. Identity stays editable on the Bateau screen.
  insert into public.boats (id, name, type, builder, model, checklist_template_id, created_by, updated_by)
  values (
    p_boat_id,
    btrim(p_name),
    coalesce(v_template.boat_type, 'monohull_sail'::public.boat_type),
    v_template.builder,
    v_template.model,
    v_template.id,
    v_user,
    v_user
  );

  insert into public.boat_members (boat_id, user_id, role, invited_by)
  values (p_boat_id, v_user, 'owner', v_user);

  if jsonb_typeof(coalesce(p_engines, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_engines, '[]'::jsonb)) > 6 then
    raise exception 'invalid_engine' using errcode = '22023';
  end if;

  for v_engine in select * from jsonb_array_elements(coalesce(p_engines, '[]'::jsonb))
  loop
    v_label := btrim(coalesce(v_engine ->> 'label', ''));
    v_position := v_engine ->> 'position';
    if v_label = '' or length(v_label) > 60
       or v_position is null or v_position not in ('port', 'starboard', 'center', 'outboard') then
      raise exception 'invalid_engine' using errcode = '22023';
    end if;
    insert into public.engines (boat_id, label, position, sort_order, created_by, updated_by)
    values (p_boat_id, v_label, v_position::public.engine_position, v_index, v_user, v_user);
    v_index := v_index + 1;
  end loop;

  -- Runs as the caller (auth.uid() is a JWT claim, not the definer): the boat_members row
  -- inserted above is what makes its own `can_write_boat` gate pass.
  perform public.apply_checklist_template(p_boat_id, p_template_id);

  return p_boat_id;
end;
$$;

comment on function public.create_boat(uuid, text, uuid, jsonb) is
  'Onboarding (D64): creates a boat, makes the caller its owner, creates its engines and instantiates the chosen public template — atomically. The only way an ordinary user gets a boat; boats_insert stays admin-only. Idempotent on p_boat_id for the caller.';

revoke all on function public.create_boat(uuid, text, uuid, jsonb) from public, anon;
grant execute on function public.create_boat(uuid, text, uuid, jsonb) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- The model registry, read side
-- ---------------------------------------------------------------------------------------------
-- `checklist_templates` is already readable by any signed-in user (0002 `checklist_templates_select`
-- on `is_public or is_platform_admin()`), but the picker also needs to say what each model is
-- worth — « 8 systèmes · 93 points » — and counting through `checklist_template_items` from the
-- client means two more round trips and a join the RLS has to re-check per row.
create or replace view public.checklist_template_catalog
with (security_invoker = true) as
select
  t.id,
  t.name,
  t.builder,
  t.model,
  t.boat_type,
  t.version,
  t.external_ref,
  (select count(*) from public.checklist_template_categories c where c.template_id = t.id)
    as category_count,
  (select count(*)
     from public.checklist_template_categories c
     join public.checklist_template_items i on i.template_category_id = c.id
    where c.template_id = t.id) as item_count
from public.checklist_templates t;

comment on view public.checklist_template_catalog is
  'The model registry as the boat-creation picker reads it (D64): one row per readable template with its category and point counts. security_invoker, so checklist_templates_select decides what is visible.';

grant select on public.checklist_template_catalog to authenticated, service_role;
