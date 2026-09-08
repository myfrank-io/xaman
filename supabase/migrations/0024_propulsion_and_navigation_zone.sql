-- 0024_propulsion_and_navigation_zone.sql — a checklist that knows what kind of engine it has,
-- and how far the boat goes.
--
-- Two remarks from the first owner of a motor boat to look at the app (D83):
--
--   « quand je mets semi-rigide par exemple, que ce soit que des trucs liés au bateau à moteur »
--   « demander aussi si le bateau est côtier ou hauturier — la checklist d'un côtier c'est plus
--     simple »
--   « entre hors-bord, in-bord, jet, semi hors-bord… sur moteur t'as une tonne de trucs »
--
-- Until now the app knew two things about an engine: where it sits (`engines.position`) and,
-- through that, whether it was an outboard — `apply_checklist_template` matched `engine_scope`
-- on the position, `outboard` against `outboard` and everything else against `inboard`. That is
-- one bit for what is at least four kinds of machine: an in-bord on a shaft line has a stern
-- gland and an alignment to check, a saildrive has a boot and a leg anode, a Z-drive has bellows
-- and a gimbal bearing, a jet has a wear ring and an intake grate, an outboard has none of those
-- and its own list instead. And a semi-rigide got the motor boat's plan, whose « none »-scoped
-- points — shaft line, generator, air conditioning, water heater, toilets — have nothing to do
-- with a boat you tow on a trailer.
--
-- Three additions, no new table:
--
--   1. `engines.propulsion` — outboard | shaft | saildrive | sterndrive | jet. It is what the
--      template matches on from now on; `position` goes back to meaning only where the engine
--      sits. Backfilled from what the app already knew: an outboard position is an outboard, a
--      multihull's engines are saildrives (that is what every production catamaran carries, and
--      the one point it changes — the saildrive boot — was already on their list), everything
--      else a shaft line. Editable on the engine form.
--   2. `boats.navigation_zone` — coastal | offshore. Existing boats are offshore: nothing they
--      have is taken away. A template point can now say `zone_scope = 'offshore'` (liferaft,
--      EPIRB, AIS, watermaker…) and `apply_checklist_template` leaves it out of a coastal boat.
--   3. `engine_scope` learns the four propulsions on top of the coarse `inboard` / `outboard`,
--      which keep working: `inboard` means « any engine inside the hull », whatever drives it.
--
-- The matching lives in one SQL function, `engine_scope_matches`, so the plan applied at step 3
-- and « Générer les points de ce moteur » can never disagree. Nothing is deleted anywhere: a
-- point that no longer matches stays on the boats that already have it, exactly as before.

-- ---------------------------------------------------------------------------------------------
-- 1. What drives the engine
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'engine_propulsion') then
    create type public.engine_propulsion as enum ('outboard', 'shaft', 'saildrive', 'sterndrive', 'jet');
  end if;
end;
$$;

alter table public.engines
  add column if not exists propulsion public.engine_propulsion not null default 'shaft';

-- Backfilled once from the two things the app already knew. `default 'shaft'` stays for rows that
-- arrive without saying (the seed, an import): it is the assumption the old matching made.
update public.engines e
   set propulsion = case
         when e.position = 'outboard' then 'outboard'
         when b.type in ('catamaran', 'trimaran') then 'saildrive'
         else 'shaft'
       end::public.engine_propulsion
  from public.boats b
 where b.id = e.boat_id;

comment on column public.engines.propulsion is
  'outboard | shaft | saildrive | sterndrive | jet (D83). What apply_checklist_template matches '
  'engine_scope on; position only says where the engine sits.';

-- ---------------------------------------------------------------------------------------------
-- 2. How far the boat goes
-- ---------------------------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'navigation_zone') then
    create type public.navigation_zone as enum ('coastal', 'offshore');
  end if;
end;
$$;

alter table public.boats
  add column if not exists navigation_zone public.navigation_zone not null default 'offshore';

comment on column public.boats.navigation_zone is
  'coastal | offshore (D83). A template point with zone_scope = ''offshore'' is not applied to a '
  'coastal boat. Default offshore: an existing boat loses nothing.';

-- ---------------------------------------------------------------------------------------------
-- 3. Template points: finer engine scopes, and a zone
-- ---------------------------------------------------------------------------------------------
alter table public.checklist_template_items
  drop constraint if exists checklist_template_items_engine_scope_check;
alter table public.checklist_template_items
  add constraint checklist_template_items_engine_scope_check
  check (engine_scope in ('none', 'inboard', 'outboard', 'all', 'shaft', 'saildrive', 'sterndrive', 'jet'));

alter table public.checklist_template_items
  add column if not exists zone_scope text not null default 'all'
  check (zone_scope in ('all', 'offshore'));

comment on column public.checklist_template_items.engine_scope is
  'none | inboard | outboard | all | shaft | saildrive | sterndrive | jet — apply_checklist_template '
  'duplicates the item per matching active engine (engine_scope_matches on engines.propulsion). '
  'inboard = any propulsion but outboard.';
comment on column public.checklist_template_items.zone_scope is
  'all | offshore — an offshore point is skipped on a coastal boat (boats.navigation_zone, D83).';

-- The one place the matching is written.
create or replace function public.engine_scope_matches(
  p_scope      text,
  p_propulsion public.engine_propulsion
)
returns boolean
language sql immutable
set search_path = ''
as $$
  select case p_scope
           when 'all'      then true
           when 'none'     then false
           when 'inboard'  then p_propulsion <> 'outboard'
           when 'outboard' then p_propulsion = 'outboard'
           else p_scope = p_propulsion::text
         end;
$$;

comment on function public.engine_scope_matches(text, public.engine_propulsion) is
  'Whether a template point of this engine_scope applies to an engine of this propulsion (D83). '
  'all → every engine; none → no engine; inboard → anything but an outboard; outboard → an outboard; '
  'shaft / saildrive / sterndrive / jet → that propulsion exactly.';

revoke all on function public.engine_scope_matches(text, public.engine_propulsion) from public, anon;
grant execute on function public.engine_scope_matches(text, public.engine_propulsion) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 4. apply_checklist_template — same contract as 0004, matching on propulsion and zone
-- ---------------------------------------------------------------------------------------------
create or replace function public.apply_checklist_template(
  p_boat_id uuid,
  p_template_id uuid,
  p_engine_id uuid default null
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_zone public.navigation_zone;
  v_cat record;
  v_item record;
  v_engine record;
  v_category_id uuid;
  v_engine_ref text;
  v_anchor_hours numeric(8,1);
begin
  if not public.can_write_boat(p_boat_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.checklist_templates t where t.id = p_template_id) then
    raise exception 'template_not_found' using errcode = 'P0002';
  end if;

  select b.navigation_zone into v_zone from public.boats b where b.id = p_boat_id;

  update public.boats set checklist_template_id = p_template_id, updated_by = v_user
    where id = p_boat_id and checklist_template_id is distinct from p_template_id;

  for v_cat in
    select * from public.checklist_template_categories tc where tc.template_id = p_template_id order by tc.sort_order
  loop
    -- categories keep the user's renames/colours: only link the template on conflict
    insert into public.boat_categories (boat_id, name, color, icon, sort_order, template_category_id, external_ref, created_by, updated_by)
    values (p_boat_id, v_cat.name, v_cat.color, v_cat.icon, v_cat.sort_order, v_cat.id, v_cat.external_ref, v_user, v_user)
    on conflict (boat_id, external_ref) do update set template_category_id = excluded.template_category_id
    returning id into v_category_id;

    for v_item in
      select * from public.checklist_template_items ti where ti.template_category_id = v_cat.id order by ti.sort_order
    loop
      -- A coastal boat does not carry the offshore points (D83). The category is still created
      -- above: a system exists even when this plan has nothing to put in it yet.
      if v_item.zone_scope = 'offshore' and v_zone = 'coastal' then
        continue;
      end if;

      if v_item.engine_scope = 'none' then
        if p_engine_id is null then
          insert into public.checklist_items (boat_id, category_id, label, description, interval_months, interval_hours, actions, source, template_item_id, sort_order, anchor_date, external_ref, created_by, updated_by)
          values (p_boat_id, v_category_id, v_item.label, v_item.description, v_item.interval_months, v_item.interval_hours, v_item.actions, 'template', v_item.id, v_item.sort_order, current_date, v_item.external_ref, v_user, v_user)
          on conflict (boat_id, external_ref) do nothing;
        end if;
      else
        for v_engine in
          select * from public.engines e
          where e.boat_id = p_boat_id and e.is_active
            and (p_engine_id is null or e.id = p_engine_id)
            and public.engine_scope_matches(v_item.engine_scope, e.propulsion)
          order by e.sort_order
        loop
          v_engine_ref := coalesce(v_engine.external_ref, v_engine.id::text);
          -- anchor hours = the engine's current reading, null when it has none yet
          select ech.hours into v_anchor_hours
            from public.engine_current_hours ech where ech.engine_id = v_engine.id;
          insert into public.checklist_items (boat_id, category_id, label, description, interval_months, interval_hours, engine_id, actions, source, template_item_id, sort_order, anchor_date, anchor_hours, external_ref, created_by, updated_by)
          values (p_boat_id, v_category_id, v_item.label || ' — ' || v_engine.label, v_item.description, v_item.interval_months, v_item.interval_hours, v_engine.id, v_item.actions, 'template', v_item.id, v_item.sort_order, current_date, v_anchor_hours, v_item.external_ref || ':' || v_engine_ref, v_user, v_user)
          on conflict (boat_id, external_ref) do nothing;
        end loop;
      end if;
    end loop;
  end loop;
end;
$$;

comment on function public.apply_checklist_template(uuid, uuid, uuid) is
  'Instantiates a template on a boat: categories upserted on (boat_id, external_ref), points inserted once (do nothing on conflict), engine-scoped points duplicated per active engine whose propulsion matches (engine_scope_matches), offshore points skipped on a coastal boat (D83), anchor_date stamped (D1). p_engine_id restricts to one engine (« Générer les points de ce moteur »).';

-- ---------------------------------------------------------------------------------------------
-- 5. create_boat — the zone, and the propulsion of each engine
-- ---------------------------------------------------------------------------------------------
create or replace function public.create_boat(
  p_boat_id         uuid,
  p_name            text,
  p_type            public.boat_type,
  p_builder         text default null,
  p_model           text default null,
  p_engines         jsonb default '[]'::jsonb,
  p_boat_model_id   uuid default null,
  p_navigation_zone public.navigation_zone default 'offshore'
)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user       uuid := auth.uid();
  v_template   uuid;
  v_engine     jsonb;
  v_label      text;
  v_position   text;
  v_propulsion text;
  v_index      int := 0;
  v_length     numeric(5,2);
  v_beam       numeric(5,2);
  v_draft      numeric(5,2);
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

  -- The one thing the catalogue contributes. Silent when the id is unknown or the row retired.
  if p_boat_model_id is not null then
    select bm.length_m, bm.beam_m, bm.draft_m into v_length, v_beam, v_draft
    from public.boat_models bm
    where bm.id = p_boat_model_id and bm.is_active;
  end if;

  -- No checklist_template_id: this boat has no maintenance plan yet, and says so.
  insert into public.boats (
    id, name, type, builder, model, length_m, beam_m, draft_m, navigation_zone, created_by, updated_by
  )
  values (
    p_boat_id,
    btrim(p_name),
    p_type,
    nullif(btrim(coalesce(p_builder, '')), ''),
    nullif(btrim(coalesce(p_model, '')), ''),
    v_length,
    v_beam,
    v_draft,
    coalesce(p_navigation_zone, 'offshore'),
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
    -- A client that says nothing about the propulsion gets what the old matching assumed.
    v_propulsion := coalesce(
      v_engine ->> 'propulsion',
      case when v_position = 'outboard' then 'outboard' else 'shaft' end
    );
    if v_label = '' or length(v_label) > 60
       or v_position is null or v_position not in ('port', 'starboard', 'center', 'outboard')
       or v_propulsion not in ('outboard', 'shaft', 'saildrive', 'sterndrive', 'jet') then
      raise exception 'invalid_engine' using errcode = '22023';
    end if;
    insert into public.engines (boat_id, label, position, propulsion, sort_order, created_by, updated_by)
    values (
      p_boat_id, v_label,
      v_position::public.engine_position,
      v_propulsion::public.engine_propulsion,
      v_index, v_user, v_user
    );
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

-- The 0021 signature is replaced, not overloaded: two ways to open a carnet is one too many, and
-- PostgREST would have to guess between them.
drop function if exists public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid);

comment on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid, public.navigation_zone) is
  'Onboarding (D65, D69, D83): creates a boat from its own identity — name, hull type, free-text builder and model, navigation zone — makes the caller its owner, creates its engines ([{label, position, propulsion?}], 6 max) and copies the systems of the matching generic model. p_boat_model_id, when it names an active catalogue row, contributes the dimensions and nothing else. No maintenance plan: checklist_template_id stays null until one is chosen in the app. Idempotent on p_boat_id for the caller.';

revoke all on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid, public.navigation_zone) from public, anon;
grant execute on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid, public.navigation_zone) to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- 6. A semi-rigide gets its own generic model (0025), no longer the motor boat's
-- ---------------------------------------------------------------------------------------------
-- The motor model stays the fallback for a database where 0025 has not landed yet, so that a
-- semi-rigide still opens with systems rather than with none.
create or replace function public.generic_template_for_boat_type(p_type public.boat_type)
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select t.id from public.checklist_templates t
      where t.external_ref = case p_type
              when 'catamaran'::public.boat_type then 'generic-catamaran-v1'
              when 'trimaran'::public.boat_type  then 'generic-catamaran-v1'
              when 'motor'::public.boat_type     then 'generic-motor-v1'
              when 'rib'::public.boat_type       then 'generic-rib-v1'
              else 'generic-monohull-sail-v1'
            end
      limit 1),
    (select t.id from public.checklist_templates t
      where p_type = 'rib'::public.boat_type and t.external_ref = 'generic-motor-v1'
      limit 1)
  );
$$;

comment on function public.generic_template_for_boat_type(public.boat_type) is
  'The generic model whose systems describe a given hull (D65, D83). A trimaran maps to the catamaran model, a semi-rigide to its own (falling back to the motor one), « autre » to the sailing monohull.';
