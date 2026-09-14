-- 0035_plan_from_equipment.sql — the plan composes itself from what is aboard (E17-5).
--
-- What this is for
-- ----------------
-- `0032` named what a piece of equipment is, `0033` said what has to be done to each family.
-- Neither touched a boat. This one closes the loop: the two layers of `docs/AUTOPILOT.md §4`
-- become one plan —
--
--     points du modèle de coque  +  règles des équipements présents
--
-- — recomposed when an equipment enters (added by hand, validated from a document) and when it
-- leaves (« déposé le … », or put in the trash).
--
-- What a point now knows
-- ----------------------
-- `checklist_items.equipment_id`: **what it maintains**. Until today a point knew its engine and
-- nothing else, so a rule-born point had no subject and nothing could tell it apart from a hull
-- point. `rule_id` says which rule produced it — the exact sibling of `template_item_id` — which
-- is what lets E17-7 move the twelve branded points of `orc50-v1` into the library without
-- guessing what came from where.
--
-- A point is **never deleted** when its equipment goes. `checklist_completions` cascades from
-- `checklist_items`: deleting a point would take the record of the work done with it. So an
-- equipment leaving deactivates its points, an equipment coming back reactivates them, and a
-- purged equipment leaves them behind with `equipment_id` set to null — a carnet that still says
-- the turbine was changed in 2024, which is the whole purpose of the thing.
--
-- Why a trigger and not the Server Actions
-- ----------------------------------------
-- Equipment enters by more than one door: the form, the validated document (D91), the seed, the
-- import. A trigger catches all of them and cannot be forgotten by the next one — and rule 8 puts
-- checklist logic in the database. Its authority is not extra: to fire it at all, the caller must
-- already have passed `equipment`'s own policies, which are `can_write_boat` — exactly what the
-- `checklist_items` policies ask.

-- ---------------------------------------------------------------------------------------------
-- 1. What a point carries
-- ---------------------------------------------------------------------------------------------

-- A third origin next to `template` and `custom`. Adding the value and *using* it in the same
-- transaction would be refused by Postgres; nothing below executes it — the function bodies that
-- name it are only parsed here, never run — so this is safe in one migration.
alter type public.checklist_item_source add value if not exists 'rule';

alter table public.checklist_items
  -- `set null`, never `cascade`: see above — the completions of a purged equipment are history.
  add column equipment_id uuid references public.equipment (id) on delete set null,
  add column rule_id      uuid references public.maintenance_rules (id) on delete set null;

comment on column public.checklist_items.equipment_id is
  'What this point maintains (E17-5). Null on a hull-template point and on a point whose equipment '
  'was purged — the point and its completions survive it.';

comment on column public.checklist_items.rule_id is
  'The maintenance_rules row that produced this point (E17-5), sibling of template_item_id.';

-- The two reads the sync makes: a boat's points for one equipment, and the plan of one boat.
create index checklist_items_equipment_idx on public.checklist_items (equipment_id)
  where equipment_id is not null;

-- ---------------------------------------------------------------------------------------------
-- 2. Comparing what people write
-- ---------------------------------------------------------------------------------------------
-- A rule may narrow to a brand (« Wallas ») or a model. `docs/DATA-MODEL.md §3.10 ter` promises
-- those are compared without case or accents rather than as written, and this is that promise.
-- It is the twin of `normaliseForMatch` (`src/lib/equipment-kinds.ts`) and has to stay at parity
-- with it — `tests/unit/plan-composition.test.ts` runs both over the same strings, the way rule 8
-- already makes `checklist-status.ts` answer to the view.
create function public.normalise_for_match(p_value text)
returns text
language sql immutable
set search_path = ''
as $$
  select trim(
    regexp_replace(
      lower(
        translate(
          coalesce(p_value, ''),
          'ÀÁÂÃÄÅÇÈÉÊËÌÍÎÏÑÒÓÔÕÖÙÚÛÜÝàáâãäåçèéêëìíîïñòóôõöùúûüýÿ',
          'AAAAAACEEEEIIIINOOOOOUUUUYaaaaaaceeeeiiiinooooouuuuyy'
        )
      ),
      '[^a-z0-9&]+', ' ', 'g'
    )
  );
$$;

comment on function public.normalise_for_match(text) is
  'Lower-case, unaccented, punctuation to spaces — the SQL twin of normaliseForMatch in '
  'src/lib/equipment-kinds.ts (E17-5). Kept at parity by tests/unit/plan-composition.test.ts.';

-- ---------------------------------------------------------------------------------------------
-- 3. Composing
-- ---------------------------------------------------------------------------------------------
-- No permission check here on purpose: this is the body the trigger runs, and the trigger already
-- fired on an `equipment` row the caller was allowed to write. `apply_maintenance_rules` below is
-- the door for everyone else, and it checks. EXECUTE is revoked at the end of the file.
create function public.compose_maintenance_rules(p_boat_id uuid, p_equipment_id uuid default null)
returns int
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user        uuid := auth.uid();
  v_zone        public.navigation_zone;
  v_eq          record;
  v_rule        record;
  v_engine      record;
  v_category_id uuid;
  v_eq_ref      text;
  v_engine_ref  text;
  v_anchor      numeric(8,1);
  v_added       int := 0;
begin
  select b.navigation_zone into v_zone from public.boats b where b.id = p_boat_id;
  if v_zone is null then
    return 0;
  end if;

  for v_eq in
    select e.id, e.name, e.brand, e.model, e.category_id, e.external_ref, e.kind_id, e.sort_order,
           k.category_ref
    from public.equipment e
    join public.equipment_kinds k on k.id = e.kind_id
    where e.boat_id = p_boat_id
      and e.removed_at is null
      and e.deleted_at is null
      and (p_equipment_id is null or e.id = p_equipment_id)
    order by e.sort_order, e.name
  loop
    -- The system the point lives in: the one the crew filed the equipment under, else the one the
    -- family usually belongs to. A point cannot exist without a system, and putting the heater's
    -- service under whichever system came first would be worse than not proposing it — so an
    -- equipment that resolves to neither is skipped rather than guessed at.
    select coalesce(
             v_eq.category_id,
             (select bc.id from public.boat_categories bc
               where bc.boat_id = p_boat_id
                 and bc.external_ref = v_eq.category_ref
                 and bc.is_active
               limit 1)
           )
      into v_category_id;
    if v_category_id is null then
      continue;
    end if;

    v_eq_ref := coalesce(v_eq.external_ref, v_eq.id::text);

    for v_rule in
      select r.*
      from public.maintenance_rules r
      where r.kind_id = v_eq.kind_id
        and r.is_active
        -- Null narrows nothing: the rule is for the whole family.
        and (r.brand is null
             or public.normalise_for_match(r.brand) = public.normalise_for_match(v_eq.brand))
        and (r.model is null
             or public.normalise_for_match(r.model) = public.normalise_for_match(v_eq.model))
      order by r.sort_order, r.label
    loop
      -- A coastal boat does not carry the offshore rules (D90), same as on a template point.
      if v_rule.zone_scope = 'offshore' and v_zone = 'coastal' then
        continue;
      end if;

      if v_rule.engine_scope = 'none' then
        -- The equipment is the subject, so it names the point: two heaters aboard must not give
        -- two lines nobody can tell apart.
        insert into public.checklist_items
          (boat_id, category_id, label, description, interval_months, interval_hours,
           actions, source, rule_id, equipment_id, sort_order, anchor_date, external_ref,
           created_by, updated_by)
        values
          (p_boat_id, v_category_id, v_rule.label || ' — ' || v_eq.name, v_rule.description,
           v_rule.interval_months, v_rule.interval_hours, v_rule.actions, 'rule',
           v_rule.id, v_eq.id, v_rule.sort_order, current_date,
           'rule:' || v_rule.external_ref || ':' || v_eq_ref, v_user, v_user)
        on conflict (boat_id, external_ref) do nothing;
        if found then
          v_added := v_added + 1;
        end if;
      else
        -- An hour interval is read off an engine, so here the engine is the subject and names the
        -- point — exactly as `apply_checklist_template` does (D90).
        for v_engine in
          select e.* from public.engines e
          where e.boat_id = p_boat_id and e.is_active
            and public.engine_scope_matches(v_rule.engine_scope, e.propulsion)
          order by e.sort_order
        loop
          v_engine_ref := coalesce(v_engine.external_ref, v_engine.id::text);
          select ech.hours into v_anchor
            from public.engine_current_hours ech where ech.engine_id = v_engine.id;
          insert into public.checklist_items
            (boat_id, category_id, label, description, interval_months, interval_hours,
             engine_id, actions, source, rule_id, equipment_id, sort_order, anchor_date,
             anchor_hours, external_ref, created_by, updated_by)
          values
            (p_boat_id, v_category_id, v_rule.label || ' — ' || v_engine.label, v_rule.description,
             v_rule.interval_months, v_rule.interval_hours, v_engine.id, v_rule.actions, 'rule',
             v_rule.id, v_eq.id, v_rule.sort_order, current_date, v_anchor,
             'rule:' || v_rule.external_ref || ':' || v_eq_ref || ':' || v_engine_ref,
             v_user, v_user)
          on conflict (boat_id, external_ref) do nothing;
          if found then
            v_added := v_added + 1;
          end if;
        end loop;
      end if;
    end loop;
  end loop;

  return v_added;
end;
$$;

comment on function public.compose_maintenance_rules(uuid, uuid) is
  'Writes the checklist points the library owes a boat''s equipment (E17-5), and returns how many '
  'it added. No permission check: called by the equipment trigger, which already fired on a row '
  'the caller was allowed to write. Use apply_maintenance_rules from anywhere else.';

-- The door for everything that is not the trigger: a Server Action recomposing a plan, the
-- backfill of E17-7. Same contract as `apply_checklist_template`.
create function public.apply_maintenance_rules(p_boat_id uuid, p_equipment_id uuid default null)
returns int
language plpgsql security definer
set search_path = ''
as $$
begin
  if not public.can_write_boat(p_boat_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.boats b where b.id = p_boat_id) then
    raise exception 'boat_not_found' using errcode = 'P0002';
  end if;
  return public.compose_maintenance_rules(p_boat_id, p_equipment_id);
end;
$$;

comment on function public.apply_maintenance_rules(uuid, uuid) is
  'Composes the equipment layer of a boat''s plan (E17-5, AUTOPILOT.md §4) and returns how many '
  'points it added. Idempotent: upserts on (boat_id, external_ref), so running it twice adds '
  'nothing the second time.';

-- ---------------------------------------------------------------------------------------------
-- 4. Keeping it in step with what is aboard
-- ---------------------------------------------------------------------------------------------
create function public.equipment_plan_sync()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Gone — taken off the boat, or a mistaken line put in the trash. Its points stop asking for
  -- anything; they are never deleted, because their completions are what the carnet is for.
  if new.removed_at is not null or new.deleted_at is not null then
    update public.checklist_items
      set is_active = false
      where equipment_id = new.id and is_active;
    return new;
  end if;

  -- Back aboard, or restored from the trash: it gets its plan back.
  if tg_op = 'UPDATE' and (old.removed_at is not null or old.deleted_at is not null) then
    update public.checklist_items
      set is_active = true
      where equipment_id = new.id and not is_active;
  end if;

  -- And whatever the library owes it that it does not have yet — which is everything on the day
  -- someone first files it under a family, and nothing on any later save.
  if new.kind_id is not null then
    perform public.compose_maintenance_rules(new.boat_id, new.id);
  end if;

  return new;
end;
$$;

comment on function public.equipment_plan_sync() is
  'Keeps a boat''s plan in step with what it carries (E17-5): compose on the way in, deactivate on '
  '« déposé le … » or trash, reactivate on the way back. Never deletes a point.';

-- `after`, so the row is settled; the column list keeps an unrelated save (a note, a serial) from
-- doing the work for nothing.
create trigger equipment_plan_sync
  after insert or update of kind_id, brand, model, category_id, removed_at, deleted_at
  on public.equipment
  for each row execute function public.equipment_plan_sync();

-- ---------------------------------------------------------------------------------------------
-- 5. Privileges (`0009`, advisors 0028 / 0029)
-- ---------------------------------------------------------------------------------------------
-- Supabase grants EXECUTE to anon / authenticated / service_role on creation; 0009 takes it back
-- for every function that existed then. These are newer, so they say it themselves.
revoke execute on function public.normalise_for_match(text) from public, anon;
revoke execute on function public.compose_maintenance_rules(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.equipment_plan_sync() from public, anon, authenticated;
revoke execute on function public.apply_maintenance_rules(uuid, uuid) from public, anon;
grant execute on function public.apply_maintenance_rules(uuid, uuid) to authenticated, service_role;

-- `0033` created this one after `0009` ran and never said it: a pure jsonb validator, harmless,
-- but anon has no business holding EXECUTE on anything here.
revoke execute on function public.maintenance_rule_consumables_valid(jsonb) from public, anon;

-- ---------------------------------------------------------------------------------------------
-- 6. A guard that was never firing for a stranger
-- ---------------------------------------------------------------------------------------------
-- Found while testing §3, and older than this ticket. `can_write_boat` reads
--
--     select public.boat_role(p_boat_id) in ('owner', 'editor');
--
-- and `boat_role` is **null** for someone who is not a member at all. `null in (…)` is null, so
-- `can_write_boat` answers null, and every plpgsql guard written as
--
--     if not public.can_write_boat(p_boat_id) then raise exception 'forbidden' …
--
-- evaluates `not null` → null, does not take the branch, and lets the caller straight through.
-- There are six such guards in the repo — `apply_checklist_template` among them — and they are all
-- `security definer`, so RLS is not there to catch what the guard let past: a signed-in stranger
-- reaching one with someone else's boat id writes to that boat.
--
-- The policies were never exposed: a null `using` clause is false to RLS. It is only these
-- hand-written guards that read a null as « not forbidden ».
--
-- The fix belongs at the root rather than in six branches. Null never meant « allowed », so
-- answering false changes nothing for anyone who was legitimately getting through.
-- `is_boat_member` already says false — it is written with `exists` — which is why the hole shows
-- up only on the three role helpers.
create or replace function public.can_write_boat(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    public.boat_role(p_boat_id) in ('owner'::public.boat_role, 'editor'::public.boat_role),
    false
  );
$$;

create or replace function public.can_contribute_boat(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    public.boat_role(p_boat_id) in ('owner'::public.boat_role, 'editor'::public.boat_role, 'pro'::public.boat_role),
    false
  );
$$;

create or replace function public.is_boat_owner(p_boat_id uuid)
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(public.boat_role(p_boat_id) = 'owner'::public.boat_role, false);
$$;

comment on function public.can_write_boat(uuid) is
  'Owner or editor of this boat. Never null: a stranger gets false, so the plpgsql guards written '
  'as « if not can_write_boat(…) then raise » actually fire for one (E17-5).';
