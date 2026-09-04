-- 0017_identity_first_onboarding.sql — « je suis sur l'onboarding donc j'ai juste besoin des infos
-- du bateau pour créer le compte, l'entretien c'est après que ça intervient dans l'app. c'est 2
-- choses différentes ».
--
-- 0015 asked one question that was really two. « Modèle » picked a `checklist_template`, and from
-- it the boat took its builder, its model and its hull type — so choosing a maintenance plan and
-- declaring what the boat *is* were the same field. That conflation had two costs:
--
--   * someone whose boat has no published plan had to file it under « générique » at sign-up, and
--     a trimaran taking the catamaran plan was recorded as a catamaran;
--   * it capped the identity fields at the models we publish, when identity is exactly the part a
--     large external catalogue could one day fill (an 8 000-model directory is right for « quel
--     bateau », and says nothing about « quel entretien »).
--
-- D65 splits them. Creation now takes the boat's own identity — name, builder, model, hull type —
-- and no template at all. `builder` and `model` are free text, so any boat can be named exactly.
--
-- What creation still does, and must: it gives the boat **its systems**. `boat_categories` is not
-- checklist furniture — `checklist_items.category_id` is `not null on delete restrict`, and a
-- category is compulsory when noting an intervention (SPEC M3), so a boat with none has a Journal
-- and a Dépenses screen it cannot use. The eight systems are copied from the generic template of
-- the matching hull, which is where the art direction's colours and icons live; the person is
-- never shown the word « modèle de checklist » to get them.
--
-- `boats.checklist_template_id` therefore stays null, and that null is the honest marker the app
-- reads afterwards: « ce carnet n'a pas encore de plan d'entretien ». Choosing one is a step in
-- the app (`apply_checklist_template`, unchanged), and it merges cleanly because the categories
-- created here carry the very same `external_ref`s it upserts on.

-- ---------------------------------------------------------------------------------------------
-- 1. The systems of a boat, without a maintenance plan
-- ---------------------------------------------------------------------------------------------
create or replace function public.apply_template_categories(
  p_boat_id     uuid,
  p_template_id uuid
)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user  uuid := auth.uid();
  v_cat   record;
  v_count int := 0;
begin
  if not public.can_write_boat(p_boat_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  for v_cat in
    select * from public.checklist_template_categories tc
     where tc.template_id = p_template_id
     order by tc.sort_order
  loop
    -- Same key and the same do-update as `apply_checklist_template`, so a plan applied later
    -- links these rows instead of duplicating them, and a rename made in between survives.
    insert into public.boat_categories
      (boat_id, name, color, icon, sort_order, template_category_id, external_ref, created_by, updated_by)
    values
      (p_boat_id, v_cat.name, v_cat.color, v_cat.icon, v_cat.sort_order, v_cat.id, v_cat.external_ref, v_user, v_user)
    on conflict (boat_id, external_ref) do update
      set template_category_id = excluded.template_category_id;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

comment on function public.apply_template_categories(uuid, uuid) is
  'Copies only the categories of a template onto a boat (D65): the systems a boat needs to be usable, without committing it to a maintenance plan. Idempotent on (boat_id, external_ref), and merges with apply_checklist_template later.';

revoke all on function public.apply_template_categories(uuid, uuid) from public, anon;
grant execute on function public.apply_template_categories(uuid, uuid) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 2. Which generic template describes a given hull
-- ---------------------------------------------------------------------------------------------
-- A trimaran is rigged and driven like a catamaran; a rigid inflatable is a small motor boat;
-- « autre » gets the sailing monohull, the broadest of the three. The mapping lives here rather
-- than in the form so the systems a boat gets never depend on which client created it.
create or replace function public.generic_template_for_boat_type(p_type public.boat_type)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select t.id
    from public.checklist_templates t
   where t.external_ref = case p_type
           when 'catamaran'::public.boat_type     then 'generic-catamaran-v1'
           when 'trimaran'::public.boat_type      then 'generic-catamaran-v1'
           when 'motor'::public.boat_type         then 'generic-motor-v1'
           when 'rib'::public.boat_type           then 'generic-motor-v1'
           else 'generic-monohull-sail-v1'
         end
   limit 1;
$$;

comment on function public.generic_template_for_boat_type(public.boat_type) is
  'The generic model whose systems describe a given hull (D65). Used at creation to give a boat its categories; a trimaran maps to the catamaran model and a RIB to the motor one.';

revoke all on function public.generic_template_for_boat_type(public.boat_type) from public, anon;
grant execute on function public.generic_template_for_boat_type(public.boat_type) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 3. create_boat, identity-first
-- ---------------------------------------------------------------------------------------------
-- The 0015 signature took a template and is replaced, not overloaded: leaving both callable would
-- leave two ways to open a carnet, one of which silently commits the boat to a plan.
drop function if exists public.create_boat(uuid, text, uuid, jsonb);

create or replace function public.create_boat(
  p_boat_id uuid,
  p_name    text,
  p_type    public.boat_type,
  p_builder text default null,
  p_model   text default null,
  p_engines jsonb default '[]'::jsonb
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user     uuid := auth.uid();
  v_template uuid;
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
  if length(coalesce(btrim(p_builder), '')) > 80 or length(coalesce(btrim(p_model), '')) > 80 then
    raise exception 'invalid_name' using errcode = '22023';
  end if;

  if (
    select count(*) from public.boat_members m
    where m.user_id = v_user and m.role = 'owner'
  ) >= 20 then
    raise exception 'boat_limit' using errcode = 'P0001';
  end if;

  -- No checklist_template_id: this boat has no maintenance plan yet, and says so.
  insert into public.boats (id, name, type, builder, model, created_by, updated_by)
  values (
    p_boat_id,
    btrim(p_name),
    p_type,
    nullif(btrim(coalesce(p_builder, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
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

  -- The systems, so the boat is usable from its first second. Never fatal: a database whose
  -- generic models have not been loaded still opens a carnet, it just opens an emptier one.
  v_template := public.generic_template_for_boat_type(p_type);
  if v_template is not null then
    perform public.apply_template_categories(p_boat_id, v_template);
  end if;

  return p_boat_id;
end;
$$;

comment on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb) is
  'Onboarding (D65): creates a boat from its own identity — name, hull type, free-text builder and model — makes the caller its owner, creates its engines and copies the systems of the matching generic model. No maintenance plan: checklist_template_id stays null until one is chosen in the app. Idempotent on p_boat_id for the caller.';

revoke all on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb) from public, anon;
grant execute on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb) to authenticated, service_role;
