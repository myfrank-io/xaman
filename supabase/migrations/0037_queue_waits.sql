-- 0037_queue_waits.sql — E18-2 / D131: the queue says everything that waits for someone.
--
--   1. boat_todo_queue() gains two kinds — a document waiting on « À valider » (D91) and a part
--      under its threshold (D10). Neither carries a deadline, and that is exactly why they were
--      invisible: the queue only ranked what had a date, so a document shouted from a banner and
--      a part waited on a screen nobody opens before leaving.
--   2. boat_dashboard_stats sheds every column E18-1 left without a reader. What the screen now
--      needs of it is two counts; the rest was recomputed on every dashboard render for nobody.
--
-- Re-runnable. security invoker is unchanged on both: the caller's RLS decides what it sees.

-- ---------------------------------------------------------------------------------------------
-- 1. The queue, in six ranks
-- ---------------------------------------------------------------------------------------------
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

    -- rank 3: interventions in progress, then planned within 30 days, by date
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
  'Dashboard queue (D131): urgent logs (0), overdue items by relative delay (1), documents waiting on « À valider » oldest first (2), in-progress then planned logs within 30 days (3), items due soon (4), parts under their threshold, shortest stock first (5). Items with status never are excluded on purpose (audit §3.5).';

-- ---------------------------------------------------------------------------------------------
-- 2. boat_dashboard_stats: two counts, and nothing else
--
-- E18-1 took the four tiles, the systems grid, the last interventions and the recap off the
-- screen, and with them every reader of this view but one — the banner, which asks how many
-- imported rows still wait for a check. Eleven correlated sub-queries (the year's expenses, the
-- twelve months', the haul-out, the stock, five status counts, the engines without a reading)
-- were being run on every render of the boat's landing screen for nobody. The column list
-- changes, so this is a drop and not a replace.
-- ---------------------------------------------------------------------------------------------
drop view if exists public.boat_dashboard_stats;

create view public.boat_dashboard_stats
with (security_invoker = true) as
select
  b.id as boat_id,
  (select count(*)::int from public.maintenance_logs l where l.boat_id = b.id and l.deleted_at is null and l.needs_review) as review_pending_logs,
  (select count(*)::int from public.purchases pu where pu.boat_id = b.id and pu.deleted_at is null and pu.needs_review) as review_pending_purchases
from public.boats b;

comment on view public.boat_dashboard_stats is
  'What the dashboard banner still asks the database for: how many imported rows wait for a check (D131). Everything else this view carried left with the summary blocks (E18-1).';

grant select on public.boat_dashboard_stats to authenticated, service_role;
revoke all on public.boat_dashboard_stats from anon;
