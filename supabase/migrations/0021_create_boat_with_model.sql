-- 0021_create_boat_with_model.sql — the dimensions come with the model.
--
-- The creation screen asks five things (D65) and must keep asking five things. But once someone
-- has tapped « Lagoon 42 » in the suggestions, the catalogue already knows the boat is 12.80 m by
-- 7.70 m, and making them type it again on the Bateau screen would be the app forgetting what it
-- just told them.
--
-- So `create_boat` gains the id of the model that was tapped, and copies its dimensions — length,
-- beam, draft — into the new boat. Only those three. Name, hull type, builder and model stay what
-- the form shows, because those are the fields the person can see and correct; a function that
-- also overwrote them from the catalogue would silently undo an edit made two seconds earlier.
--
-- The id is read server-side rather than trusted: the client sends a reference, not measurements.
-- An unknown or deactivated id is ignored, not an error — the catalogue is a convenience, and a
-- boat must open whatever happens to it.
--
-- A dimension the catalogue left null stays null here. « Oceanis 40 » covers hulls from 11.80 m to
-- 12.15 m, and most models ship in two keel versions; where the catalogue would have had to guess,
-- it says nothing and the owner fills in what they measured.

create or replace function public.create_boat(
  p_boat_id       uuid,
  p_name          text,
  p_type          public.boat_type,
  p_builder       text default null,
  p_model         text default null,
  p_engines       jsonb default '[]'::jsonb,
  p_boat_model_id uuid default null
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
  v_length   numeric(5,2);
  v_beam     numeric(5,2);
  v_draft    numeric(5,2);
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
    id, name, type, builder, model, length_m, beam_m, draft_m, created_by, updated_by
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

-- The 0017 signature is replaced, not overloaded: two ways to open a carnet is one too many, and
-- PostgREST would have to guess between them.
drop function if exists public.create_boat(uuid, text, public.boat_type, text, text, jsonb);

comment on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid) is
  'Onboarding (D65, D66): creates a boat from its own identity — name, hull type, free-text builder and model — makes the caller its owner, creates its engines and copies the systems of the matching generic model. p_boat_model_id, when it names an active catalogue row, contributes the dimensions and nothing else. No maintenance plan: checklist_template_id stays null until one is chosen in the app. Idempotent on p_boat_id for the caller.';

revoke all on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid) from public, anon;
grant execute on function public.create_boat(uuid, text, public.boat_type, text, text, jsonb, uuid) to authenticated, service_role;
