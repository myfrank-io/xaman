-- 0045_buying_a_part_is_a_purchase.sql — E13-18 / D143.
--
-- « À racheter » and the expenses were two ways of saying the same thing, and neither knew the
-- other. Putting four filters back in the locker meant tapping « + » four times, then typing the
-- purchase again under Dépenses — the double entry D63 had promised never to ask for. So the
-- same knot D140 untied for the checklist, untied here:
--
--   « Racheter une pièce, c'est noter un achat ; un achat de pièce, c'est du stock qui rentre. »
--
--   1. `purchases.part_id` — the column has been in the schema since 0001 and meant nothing to
--      anyone. It now means: this purchase restocked that part. Same boat, checked by a trigger.
--   2. `apply_purchase_to_stock()` — what a purchase brings in **is** the stock movement, made by
--      the database (rule 8): written → the quantity goes up, trashed → it goes back down,
--      restored → up again, re-pointed or re-counted → only the difference moves. The stock stays
--      a counted quantity (one uses parts without buying them); what it no longer is, is a second
--      place to type what an invoice already says.
--   3. « À racheter » means **missing**. The list read `quantity <= min_quantity`, so a part at its
--      threshold was still to be bought: buying exactly what was short left the line in place, and
--      the one-tap gesture looked broken. A threshold is a floor one is allowed to stand on
--      (D143), so the queue counts what is strictly under it, as `isLowStock` now does.
--
-- Re-runnable: every object is created or replaced, every trigger dropped before it is recreated.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The part a purchase restocks
-- ---------------------------------------------------------------------------------------------
create index if not exists purchases_part_idx
  on public.purchases (part_id)
  where part_id is not null;

comment on column public.purchases.part_id is
  'The spare part this purchase restocked (D143). Set by « Racheté » on the « À racheter » list, '
  'and by any purchase that names a part. The quantity it carries is added to that part''s stock '
  'by apply_purchase_to_stock(); null on a purchase that is not stock coming in.';

comment on column public.purchases.quantity is
  'How many units the purchase brought in. Only read when part_id is set (D143): it is the '
  'movement applied to the stock. Defaults to 1 and is left alone everywhere else.';

-- The part must belong to the boat of the purchase (rule 4). Reads `parts` under the caller's
-- RLS, like `maintenance_logs_check_item_boat` does: a part one cannot see is one one cannot name.
create or replace function public.purchases_check_part_boat()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.part_id is not null and not exists (
    select 1 from public.parts p
    where p.id = new.part_id and p.boat_id = new.boat_id
  ) then
    raise exception 'part_boat_mismatch' using errcode = '23514',
      detail = 'purchases.part_id must name a part of the same boat';
  end if;
  return new;
end;
$$;

drop trigger if exists purchases_part_boat on public.purchases;
create trigger purchases_part_boat
  before insert or update of part_id, boat_id on public.purchases
  for each row execute function public.purchases_check_part_boat();

-- ---------------------------------------------------------------------------------------------
-- 2. What a purchase brings in is the stock movement
-- ---------------------------------------------------------------------------------------------
-- A movement, not a derivation: a part also leaves the locker without anyone buying anything, so
-- the quantity cannot be recomputed from the purchases alone. What the database owns is the
-- **difference** each write of a purchase makes, which is exactly what the screens used to ask a
-- person to type twice. Floored at 0 like `adjust_part_quantity`, and the line counts as counted
-- today: a purchase is a fact about the stock as good as a count.
create or replace function public.apply_stock_movement(p_part_id uuid, p_delta numeric)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_part_id is null or coalesce(p_delta, 0) = 0 then
    return;
  end if;
  update public.parts
     set quantity = greatest(0, quantity + p_delta),
         checked_at = current_date,
         updated_by = coalesce(auth.uid(), updated_by)
   where id = p_part_id;
end;
$$;

comment on function public.apply_stock_movement(uuid, numeric) is
  'Adds a signed quantity to a part of the stock, floored at 0, counting the line as checked today (D143). Internal: called by apply_purchase_to_stock().';

-- security definer, as `sync_log_completion` is (D140): the movement mirrors a purchase the
-- caller was already allowed to write, and it must land or not happen at all. `purchases_insert`
-- and `parts_update` both read `can_write_boat` today, so nothing is widened here — what is
-- refused is refused before the trigger fires — but a stock that silently missed a movement
-- because the two policies had drifted apart would be a lie no screen could catch.
create or replace function public.apply_purchase_to_stock()
returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old_part uuid;
  v_new_part uuid;
  v_old numeric := 0;
  v_new numeric := 0;
begin
  -- What the row fed before this write, and what it feeds after it. A trashed purchase feeds
  -- nothing: « Annuler » and the trash take the quantity back, a restore puts it in again.
  if tg_op <> 'INSERT' then
    v_old_part := old.part_id;
    if old.part_id is not null and old.deleted_at is null then
      v_old := coalesce(old.quantity, 0);
    end if;
  end if;
  if tg_op <> 'DELETE' then
    v_new_part := new.part_id;
    if new.part_id is not null and new.deleted_at is null then
      v_new := coalesce(new.quantity, 0);
    end if;
  end if;

  if v_old_part is distinct from v_new_part then
    -- Moved to another part: each side settles its own.
    perform public.apply_stock_movement(v_old_part, -v_old);
    perform public.apply_stock_movement(v_new_part, v_new);
  else
    perform public.apply_stock_movement(v_new_part, v_new - v_old);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

comment on function public.apply_purchase_to_stock() is
  'D143: applies to the stock the difference a write of a purchase makes (written → in, trashed → out, restored → in, re-pointed or re-counted → the difference only).';

drop trigger if exists apply_purchase_to_stock on public.purchases;
create trigger apply_purchase_to_stock
  after insert or update of part_id, quantity, deleted_at or delete
  on public.purchases
  for each row execute function public.apply_purchase_to_stock();

-- ---------------------------------------------------------------------------------------------
-- 3. Neither function is an API (rule 2, as 0009 and 0043)
-- ---------------------------------------------------------------------------------------------
revoke execute on function public.apply_stock_movement(uuid, numeric) from public, anon, authenticated;
revoke execute on function public.apply_purchase_to_stock() from public, anon, authenticated;
revoke execute on function public.purchases_check_part_boat() from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 4. « À racheter » means missing (D143)
-- ---------------------------------------------------------------------------------------------
-- The only change to the queue is rank 5: `<` instead of `<=`. A threshold is the level one wants
-- to keep in reserve, so holding exactly it is not a shortage — and « Racheté », which buys what
-- is short, now clears the line it was meant to clear. `src/lib/parts.ts` reads the same rule.
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

    -- rank 5: parts under their threshold (D10, D131, D143). No date either: this one falls when
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
      and pa.quantity < pa.min_quantity
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
  'Dashboard queue (D131, D140, D143): urgent logs (0), overdue items by relative delay (1), documents waiting on « À valider » oldest first (2), in-progress then planned logs within 30 days whose point is not already listed (3), items due soon (4), parts strictly under their threshold, shortest stock first (5). Items with status never are excluded on purpose (audit §3.5).';
commit;
