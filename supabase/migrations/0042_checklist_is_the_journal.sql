-- 0042_checklist_is_the_journal.sql — E20-4 / D140 and E19-11 / D141.
--
-- The checklist and the journal were two ways of saying « c'est fait » that never met: a tick
-- wrote a `checklist_completions` row nobody saw in the journal, and an intervention only
-- touched the checklist if someone re-ticked the points in the form. D140 makes them one thing:
--
--   « Un point de checklist est une intervention qui revient ;
--     une intervention est un point de checklist qui a eu lieu. »
--
--   1. `maintenance_logs.checklist_item_id` — the point an intervention is the doing of. A tick
--      now writes an intervention that carries it; « Confier au chantier » (D141) writes a
--      *planned* one that carries it too, so the plan and the record are the same row.
--   2. `sync_log_completion()` — the completion is DERIVED from the intervention, in the
--      database (rule 8): done → the point is ticked at the intervention's date and hours; not
--      done, or in the trash → it is not; restored → it is again; the date follows the row.
--      The trigger also listens to the readings the intervention carries, because on an
--      hour-based point the database refuses a completion without hours
--      (`check_completion_hours`) and `saveLog` writes the row before its readings.
--   3. A pro may take back their own line within 24 h — the mirror of D15, which already let
--      them cancel their own completion in that window. Without it, « Annuler » after a tick
--      would work for the owner and silently fail for the mechanic.
--   4. `checklist_item_status` gains the open intervention of a point (planned, in progress or
--      urgent), so the line can say « Confié à Marsaudon · prévu le 12/10 » instead of showing a
--      red delay nobody is doing anything about.
--   5. `boat_todo_queue` shows a point once: a planned intervention whose point is already in
--      the queue is carried by the point's own line.
--   6. `boat_activity` says a fact once: a completion that has an intervention is told by it.
--
-- Re-runnable: every object is created or replaced, every policy dropped before it is recreated.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The point an intervention is the doing of
-- ---------------------------------------------------------------------------------------------
alter table public.maintenance_logs
  add column if not exists checklist_item_id uuid references public.checklist_items (id) on delete set null;

create index if not exists maintenance_logs_checklist_item_idx
  on public.maintenance_logs (checklist_item_id)
  where checklist_item_id is not null;

comment on column public.maintenance_logs.checklist_item_id is
  'The checklist point this intervention is the doing of (D140). Done → the point is ticked by '
  'sync_log_completion(); planned → the point shows it as handed over (D141). Null on a line that '
  'is not the doing of one point (the form may still tick several through checklist_completions).';

-- The point must be a point of the same boat (rule 4). The check reads `checklist_items` under
-- the caller's RLS, which is what we want: a point one cannot see is a point one cannot link.
create or replace function public.maintenance_logs_check_item_boat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.checklist_item_id is not null and not exists (
    select 1 from public.checklist_items i
    where i.id = new.checklist_item_id and i.boat_id = new.boat_id
  ) then
    raise exception 'checklist_item_boat_mismatch' using errcode = '23514',
      detail = 'maintenance_logs.checklist_item_id must name a point of the same boat';
  end if;
  return new;
end;
$$;

drop trigger if exists maintenance_logs_item_boat on public.maintenance_logs;
create trigger maintenance_logs_item_boat
  before insert or update of checklist_item_id, boat_id on public.maintenance_logs
  for each row execute function public.maintenance_logs_check_item_boat();

-- ---------------------------------------------------------------------------------------------
-- 2. The completion an intervention writes
-- ---------------------------------------------------------------------------------------------
-- security definer: the completion mirrors an intervention the caller was already allowed to
-- write (the same reason `sync_engine_hours_from_completion` is definer). A pro's tick therefore
-- writes the completion a pro could have written themselves, and nothing more.
create or replace function public.sync_log_completion(p_log_id uuid)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  l record;
  i record;
  v_hours numeric;
  v_by_name text;
begin
  select id, boat_id, status, performed_at, deleted_at, checklist_item_id, contact_id,
         created_by, updated_by
    into l
    from public.maintenance_logs
   where id = p_log_id;
  if not found or l.checklist_item_id is null then
    return;
  end if;

  -- Not done, or in the trash: the point is not ticked by this line. A restore comes back here
  -- with deleted_at null and writes it again.
  if l.status <> 'done' or l.deleted_at is not null then
    delete from public.checklist_completions
     where maintenance_log_id = l.id and checklist_item_id = l.checklist_item_id;
    return;
  end if;

  select ci.engine_id, ci.interval_hours, coalesce(e.tracks_hours, true) as tracks_hours
    into i
    from public.checklist_items ci
    left join public.engines e on e.id = ci.engine_id
   where ci.id = l.checklist_item_id;
  if not found then
    return;
  end if;

  if i.engine_id is not null then
    select r.hours into v_hours
      from public.engine_hour_readings r
     where r.maintenance_log_id = l.id and r.engine_id = i.engine_id;
  end if;

  -- The database refuses a completion without hours on an hour-based point
  -- (check_completion_hours, D73 aside). The reading is written right after the row by every
  -- writer of the app, and this function is called again when it lands; until then — and if it
  -- is ever removed — the point is not ticked rather than ticked with hours it does not have.
  if i.interval_hours is not null and i.tracks_hours and v_hours is null then
    delete from public.checklist_completions
     where maintenance_log_id = l.id and checklist_item_id = l.checklist_item_id;
    return;
  end if;

  -- « Réalisé par » (D32): the provider of the intervention when it has one, else whoever wrote
  -- the line. The frozen name survives the deletion of the account (D31) like any other.
  select c.name into v_by_name from public.contacts c where c.id = l.contact_id;

  insert into public.checklist_completions (
    boat_id, checklist_item_id, completed_at, completed_by, completed_by_name, engine_hours,
    maintenance_log_id, created_by, updated_by
  )
  values (
    l.boat_id, l.checklist_item_id, l.performed_at, coalesce(l.updated_by, l.created_by),
    v_by_name, v_hours, l.id, l.created_by, coalesce(l.updated_by, l.created_by)
  )
  on conflict (maintenance_log_id, checklist_item_id) do update
    set completed_at = excluded.completed_at,
        engine_hours = excluded.engine_hours,
        -- A name typed by hand on the tick (« quelqu'un d'autre ») is kept while the line has
        -- no provider; a provider named on the line wins over it.
        completed_by_name = coalesce(excluded.completed_by_name, public.checklist_completions.completed_by_name),
        completed_by = coalesce(public.checklist_completions.completed_by, excluded.completed_by),
        updated_by = excluded.updated_by;
end;
$$;

comment on function public.sync_log_completion(uuid) is
  'D140: derives the checklist completion of an intervention that is the doing of a point. Done and alive → upsert at its date, hours and provider; otherwise → none. Called by triggers on maintenance_logs and on the readings it carries.';

create or replace function public.sync_log_completion_from_log()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  -- Re-pointed to another point: what the old one had from this line goes.
  if tg_op = 'UPDATE'
     and old.checklist_item_id is not null
     and old.checklist_item_id is distinct from new.checklist_item_id then
    delete from public.checklist_completions
     where maintenance_log_id = new.id and checklist_item_id = old.checklist_item_id;
  end if;
  perform public.sync_log_completion(new.id);
  return new;
end;
$$;

drop trigger if exists sync_log_completion on public.maintenance_logs;
create trigger sync_log_completion
  after insert or update of status, performed_at, deleted_at, checklist_item_id, contact_id, updated_by
  on public.maintenance_logs
  for each row execute function public.sync_log_completion_from_log();

create or replace function public.sync_log_completion_from_reading()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_log uuid;
begin
  v_log := case when tg_op = 'DELETE' then old.maintenance_log_id else new.maintenance_log_id end;
  if v_log is not null then
    perform public.sync_log_completion(v_log);
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_log_completion_from_reading on public.engine_hour_readings;
create trigger sync_log_completion_from_reading
  after insert or update or delete on public.engine_hour_readings
  for each row execute function public.sync_log_completion_from_reading();

revoke all on function public.sync_log_completion(uuid) from public;
revoke all on function public.sync_log_completion_from_log() from public;
revoke all on function public.sync_log_completion_from_reading() from public;
revoke all on function public.maintenance_logs_check_item_boat() from public;

-- ---------------------------------------------------------------------------------------------
-- 3. A pro may take back their own line within 24 hours (mirror of D15)
-- ---------------------------------------------------------------------------------------------
-- The rule « un pro ne met rien à la corbeille » protected the owner's record from a mechanic
-- erasing history. A line one wrote a minute ago by mistake is not history yet: D15 already lets
-- a pro cancel their own completion for 24 hours, and a tick is now an intervention.
drop policy if exists "maintenance_logs_update" on public.maintenance_logs;
create policy "maintenance_logs_update" on public.maintenance_logs for update to authenticated
  using (
    public.can_write_boat(boat_id)
    or (public.boat_role(boat_id) = 'pro' and created_by = auth.uid())
  )
  with check (
    public.can_write_boat(boat_id)
    or (
      public.boat_role(boat_id) = 'pro'
      and created_by = auth.uid()
      and (deleted_at is null or created_at > now() - interval '24 hours')
    )
  );

-- ---------------------------------------------------------------------------------------------
-- 4. checklist_item_status: the open intervention of a point
-- ---------------------------------------------------------------------------------------------
-- Same view as 0022, four columns appended (CREATE OR REPLACE VIEW allows exactly that). The
-- state logic does not move: `checklist_compute_status` is untouched and the TS mirror stays at
-- parity. What is added is what the line needs to say who has the point in hand.
create or replace view public.checklist_item_status
with (security_invoker = true) as
with last_completion as (
  select distinct on (c.checklist_item_id)
    c.checklist_item_id,
    c.id as completion_id,
    c.completed_at,
    c.completed_by,
    c.completed_by_name,
    c.engine_hours,
    c.next_due_at,
    c.note
  from public.checklist_completions c
  order by c.checklist_item_id, c.completed_at desc, c.created_at desc
),
base as (
  select
    i.id,
    i.boat_id,
    i.category_id,
    i.label,
    i.description,
    i.interval_months,
    -- an hour deadline needs a meter: without one it is not a deadline, it is a wish (D73)
    case when i.engine_id is not null and not coalesce(e.tracks_hours, true)
         then null::int
         else i.interval_hours
    end as interval_hours,
    i.engine_id,
    coalesce(e.tracks_hours, true) as engine_tracks_hours,
    i.actions,
    i.source,
    i.template_item_id,
    i.sort_order,
    i.anchor_date,
    i.anchor_hours,
    e.counter_reset_at,
    lc.completion_id as last_completion_id,
    lc.completed_at as last_completed_at,
    lc.completed_by as last_completed_by,
    coalesce(lc.completed_by_name, p.full_name, p.email) as last_completed_by_name,
    lc.engine_hours as last_engine_hours,
    lc.note as last_note,
    lc.next_due_at as fixed_due_at,
    (lc.completed_at is not null) as has_completion,
    coalesce(lc.completed_at, i.anchor_date) as reference_at,
    -- hour reference, neutralised when the counter was replaced after it (audit §4.1)
    case
      when e.counter_reset_at is not null
           and coalesce(lc.completed_at, i.anchor_date) < e.counter_reset_at then null
      else coalesce(lc.engine_hours, i.anchor_hours)
    end as reference_hours,
    ech.hours as current_hours
  from public.checklist_items i
  join public.boat_categories cat on cat.id = i.category_id
  left join public.engines e on e.id = i.engine_id
  left join last_completion lc on lc.checklist_item_id = i.id
  left join public.profiles p on p.id = lc.completed_by
  left join public.engine_current_hours ech on ech.engine_id = i.engine_id
  where i.is_active
    and cat.is_active
    and (i.engine_id is null or e.is_active)
)
select
  b.id,
  b.boat_id,
  b.category_id,
  b.label,
  b.description,
  b.interval_months,
  b.interval_hours,
  b.engine_id,
  b.actions,
  b.source,
  b.template_item_id,
  b.sort_order,
  b.anchor_date,
  b.anchor_hours,
  b.counter_reset_at,
  b.last_completion_id,
  b.last_completed_at,
  b.last_completed_by,
  b.last_completed_by_name,
  b.last_engine_hours,
  b.last_note,
  b.fixed_due_at,
  b.has_completion,
  (not b.has_completion) as is_estimated,
  b.reference_at,
  b.reference_hours,
  b.current_hours,
  s.due_at,
  s.due_hours,
  s.days_remaining,
  s.hours_remaining,
  s.status,
  b.engine_tracks_hours,
  -- D140 / D141: the intervention someone has in hand for this point, if any. The most pressing
  -- first (urgent, in progress, then planned), the earliest date first among equals.
  ol.id as open_log_id,
  ol.status as open_log_status,
  ol.performed_at as open_log_at,
  ol.contact_name as open_log_contact_name
from base b
cross join lateral public.checklist_compute_status(
  b.reference_at, b.interval_months, b.reference_hours, b.interval_hours,
  b.current_hours, b.has_completion, b.fixed_due_at, current_date
) s
left join lateral (
  select l.id, l.status, l.performed_at, c.name as contact_name
    from public.maintenance_logs l
    left join public.contacts c on c.id = l.contact_id
   where l.checklist_item_id = b.id
     and l.deleted_at is null
     and l.status <> 'done'
   order by case l.status when 'urgent' then 0 when 'in_progress' then 1 else 2 end,
            l.performed_at, l.created_at
   limit 1
) ol on true;

-- ---------------------------------------------------------------------------------------------
-- 5. maintenance_logs_view: the point an intervention is the doing of
-- ---------------------------------------------------------------------------------------------
create or replace view public.maintenance_logs_view
with (security_invoker = true) as
select
  l.id,
  l.boat_id,
  l.title,
  l.category_id,
  cat.name as category_name,
  cat.color as category_color,
  cat.is_active as category_is_active,
  l.status,
  l.performed_at,
  l.cost,
  l.currency,
  l.contact_id,
  ct.name as contact_name,
  l.equipment_id,
  eq.name as equipment_name,
  l.haul_out_id,
  l.notes,
  l.needs_review,
  l.pending_engine_hours,
  l.external_ref,
  l.created_by,
  coalesce(p.full_name, p.email) as created_by_name,
  l.updated_by,
  l.created_at,
  l.updated_at,
  coalesce(
    (
      select jsonb_agg(jsonb_build_object('engine_id', r.engine_id, 'label', e.label, 'hours', r.hours) order by e.sort_order)
      from public.engine_hour_readings r
      join public.engines e on e.id = r.engine_id
      where r.maintenance_log_id = l.id
    ),
    '[]'::jsonb
  ) as engine_hours,
  (select count(*)::int from public.checklist_completions cc where cc.maintenance_log_id = l.id) as completions_count,
  (
    select count(*)::int from public.attachments a
    where a.entity_type = 'maintenance_log' and a.entity_id = l.id and a.deleted_at is null
  ) as attachments_count,
  (select count(*)::int from public.purchases pu where pu.maintenance_log_id = l.id and pu.deleted_at is null) as purchases_count,
  -- Tous les systèmes, principal compris, dans l'ordre du bateau. Une ligne sans liaison —
  -- un import, une ligne d'avant cette migration — retombe sur sa seule colonne.
  coalesce(
    (
      select array_agg(c.id order by c.sort_order, c.name)
        from public.maintenance_log_categories lc
        join public.boat_categories c on c.id = lc.category_id
       where lc.log_id = l.id
    ),
    array_remove(array[l.category_id], null)
  ) as category_ids,
  -- D140: the point this line is the doing of, and its label as the detail prints it.
  l.checklist_item_id,
  ci.label as checklist_item_label
from public.maintenance_logs l
left join public.boat_categories cat on cat.id = l.category_id
left join public.contacts ct on ct.id = l.contact_id
left join public.equipment eq on eq.id = l.equipment_id
left join public.profiles p on p.id = l.created_by
left join public.checklist_items ci on ci.id = l.checklist_item_id
where l.deleted_at is null;

-- ---------------------------------------------------------------------------------------------
-- 6. boat_todo_queue: a point shows once
-- ---------------------------------------------------------------------------------------------
-- Same six ranks as 0037. Rank 3 (in progress, then planned within 30 days) no longer lists an
-- intervention whose point is itself in the queue (overdue or soon): the point's line carries
-- the plan — « Confié à … · prévu le … » — and a second line for the same job was the exact
-- duplication D121 removed from the screen. An urgent intervention (rank 0) is always listed:
-- urgency is the person's own word, it is not deduced.
create or replace function public.boat_todo_queue(p_boat_id uuid, p_limit int default 10)
returns table (
  rank int,
  kind text,
  id uuid,
  title text,
  category_id uuid,
  category_name text,
  category_color text,
  engine_id uuid,
  engine_label text,
  status text,
  due_at date,
  due_hours numeric,
  days_remaining int,
  hours_remaining numeric,
  severity numeric,
  sort_key numeric
)
language sql stable
set search_path = ''
as $$
  with queue as (
    -- rank 0: urgent interventions, oldest first
    select
      0 as rank,
      'log'::text as kind,
      l.id,
      l.title,
      l.category_id,
      l.category_name,
      l.category_color,
      null::uuid as engine_id,
      null::text as engine_label,
      l.status::text as status,
      l.performed_at as due_at,
      null::numeric as due_hours,
      (l.performed_at - current_date) as days_remaining,
      null::numeric as hours_remaining,
      null::numeric as severity,
      (l.performed_at - date '1970-01-01')::numeric as sort_key
    from public.maintenance_logs_view l
    where l.boat_id = p_boat_id and l.status = 'urgent'

    union all

    -- rank 1: overdue checklist items, worst RELATIVE overdue first
    -- (1.0 = one whole interval late, so a 6-month item beats a 24-month one at equal delay)
    select
      1,
      'item',
      s.id,
      s.label,
      s.category_id,
      cat.name,
      cat.color,
      s.engine_id,
      e.label,
      s.status::text,
      s.due_at,
      s.due_hours,
      s.days_remaining,
      s.hours_remaining,
      greatest(
        coalesce((current_date - s.due_at)::numeric / greatest(coalesce(s.interval_months, 1) * 30, 30), 0),
        coalesce((s.current_hours - s.due_hours) / greatest(s.interval_hours, 25), 0)
      ),
      -greatest(
        coalesce((current_date - s.due_at)::numeric / greatest(coalesce(s.interval_months, 1) * 30, 30), 0),
        coalesce((s.current_hours - s.due_hours) / greatest(s.interval_hours, 25), 0)
      )
    from public.checklist_item_status s
    join public.boat_categories cat on cat.id = s.category_id
    left join public.engines e on e.id = s.engine_id
    where s.boat_id = p_boat_id and s.status = 'overdue'

    union all

    -- rank 2: documents waiting for a decision (D91, D131). A paper waits for a person, never
    -- for a date: `due_at` carries the day it ARRIVED, which is what the row says, and the
    -- oldest comes first. `days_remaining` stays null — nothing here is late, it is unanswered.
    select
      2,
      'inbox',
      i.id,
      coalesce(nullif(btrim(i.subject), ''), i.file_name),
      null,
      null,
      null,
      null,
      null,
      i.status::text,
      i.received_at::date,
      null,
      null,
      null,
      null,
      (i.received_at::date - date '1970-01-01')::numeric
    from public.inbox_items i
    where i.boat_id = p_boat_id and i.status in ('received', 'analysing', 'ready')

    union all

    -- rank 3: interventions in progress, then planned within 30 days, by date — unless the
    -- point they are the doing of is already in the queue (D140): its line carries them.
    select
      3,
      'log',
      l.id,
      l.title,
      l.category_id,
      l.category_name,
      l.category_color,
      null,
      null,
      l.status::text,
      l.performed_at,
      null,
      (l.performed_at - current_date),
      null,
      null,
      case when l.status = 'in_progress' then 0 else 1000000 end
        + (l.performed_at - date '1970-01-01')::numeric
    from public.maintenance_logs_view l
    where l.boat_id = p_boat_id
      and l.status in ('in_progress', 'planned')
      and l.performed_at <= current_date + 30
      and (
        l.checklist_item_id is null
        or not exists (
          select 1 from public.checklist_item_status s
           where s.id = l.checklist_item_id and s.status in ('overdue', 'soon')
        )
      )

    union all

    -- rank 4: items due soon, closest deadline first (hours converted to days)
    select
      4,
      'item',
      s.id,
      s.label,
      s.category_id,
      cat.name,
      cat.color,
      s.engine_id,
      e.label,
      s.status::text,
      s.due_at,
      s.due_hours,
      s.days_remaining,
      s.hours_remaining,
      0::numeric,
      least(coalesce(s.days_remaining::numeric, 9999), coalesce(s.hours_remaining, 9999) * 1.2)
    from public.checklist_item_status s
    join public.boat_categories cat on cat.id = s.category_id
    left join public.engines e on e.id = s.engine_id
    where s.boat_id = p_boat_id and s.status = 'soon'

    union all

    -- rank 5: parts at or under their threshold (D10, D131). No date either: this one falls when
    -- someone goes to the chandlery. `severity` is how short the line is, and the shortest stock
    -- comes first — a box with none left before one with one left.
    select
      5,
      'part',
      pa.id,
      pa.name,
      pa.category_id,
      cat.name,
      cat.color,
      null,
      null,
      'low',
      null,
      null,
      null,
      null,
      (pa.min_quantity - pa.quantity),
      -(pa.min_quantity - pa.quantity)
    from public.parts pa
    left join public.boat_categories cat on cat.id = pa.category_id
    where pa.boat_id = p_boat_id
      and pa.deleted_at is null
      and pa.min_quantity > 0
      and pa.quantity <= pa.min_quantity
  )
  select
    q.rank, q.kind, q.id, q.title, q.category_id, q.category_name, q.category_color,
    q.engine_id, q.engine_label, q.status, q.due_at, q.due_hours,
    q.days_remaining, q.hours_remaining, q.severity, q.sort_key
  from queue q
  order by q.rank, q.sort_key, q.title
  limit greatest(coalesce(p_limit, 10), 0);
$$;

comment on function public.boat_todo_queue(uuid, int) is
  'Dashboard queue (D131, D140): urgent logs (0), overdue items by relative delay (1), documents waiting on « À valider » oldest first (2), in-progress then planned logs within 30 days whose point is not already listed (3), items due soon (4), parts under their threshold, shortest stock first (5). Items with status never are excluded on purpose (audit §3.5).';

-- ---------------------------------------------------------------------------------------------
-- 7. boat_activity: a fact is said once
-- ---------------------------------------------------------------------------------------------
-- A tick is now an intervention, and the intervention's line already says it — with the cost,
-- the provider and the documents the completion does not carry. The completion line stays for
-- the ticks that have no intervention: the ones written before D140, and the ones imported.
create or replace view public.boat_activity
with (security_invoker = true) as

  -- un point coché sans intervention derrière lui
  select
    cc.boat_id,
    'completion'::text as kind,
    cc.id,
    cc.completed_at as happened_at,
    ci.label as title,
    -- le nom figé d'abord (D31) : il survit à la suppression du compte qui l'a écrit
    coalesce(nullif(btrim(cc.completed_by_name), ''), p.full_name, p.email) as who,
    cat.name as category_name,
    cat.color as category_color,
    null::numeric as amount,
    cc.engine_hours as hours,
    cc.created_at as recorded_at
  from public.checklist_completions cc
  join public.checklist_items ci on ci.id = cc.checklist_item_id
  left join public.boat_categories cat on cat.id = ci.category_id
  left join public.profiles p on p.id = cc.completed_by
  where cc.maintenance_log_id is null

  union all

  -- une intervention terminée
  select
    l.boat_id,
    'log',
    l.id,
    l.performed_at,
    l.title,
    coalesce(c.name, p.full_name, p.email),
    cat.name,
    cat.color,
    l.cost,
    null,
    l.created_at
  from public.maintenance_logs l
  left join public.contacts c on c.id = l.contact_id
  left join public.boat_categories cat on cat.id = l.category_id
  left join public.profiles p on p.id = l.created_by
  where l.deleted_at is null and l.status = 'done'

  union all

  -- un achat
  select
    pu.boat_id,
    'purchase',
    pu.id,
    pu.purchased_at,
    pu.designation,
    coalesce(c.name, p.full_name, p.email),
    cat.name,
    cat.color,
    pu.amount,
    null,
    pu.created_at
  from public.purchases pu
  left join public.contacts c on c.id = pu.supplier_contact_id
  left join public.boat_categories cat on cat.id = pu.category_id
  left join public.profiles p on p.id = pu.created_by
  where pu.deleted_at is null

  union all

  -- un relevé d'heures saisi à la main. Ceux que l'application dérive d'une intervention ou d'un
  -- cochage (D5) ne sont pas un acte de plus : leur ligne est déjà au-dessus.
  select
    r.boat_id,
    'reading',
    r.id,
    r.read_at,
    e.label,
    coalesce(p.full_name, p.email),
    null,
    null,
    null,
    r.hours,
    r.created_at
  from public.engine_hour_readings r
  join public.engines e on e.id = r.engine_id
  left join public.profiles p on p.id = r.created_by
  where r.source = 'manual'

  union all

  -- une sortie de l'eau
  select
    h.boat_id,
    'haul_out',
    h.id,
    h.started_at,
    coalesce(nullif(btrim(h.yard_name), ''), c.name),
    coalesce(c.name, p.full_name, p.email),
    null,
    null,
    h.cost,
    null,
    h.created_at
  from public.haul_outs h
  left join public.contacts c on c.id = h.yard_contact_id
  left join public.profiles p on p.id = h.created_by
  where h.deleted_at is null;

comment on view public.boat_activity is
  'The carnet''s shared feed (D132, D140): what happened — points ticked without an intervention, interventions done, purchases, manual hour readings, haul-outs — newest first, with who did it. A tick that wrote an intervention is told by the intervention. Facts only: nothing here says what was trashed or edited. security_invoker, so each source table''s RLS decides.';

commit;
