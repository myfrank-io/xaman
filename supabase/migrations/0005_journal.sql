-- 0005_journal.sql — Journal (interventions) helpers: title suggestions and checklist matching.
--
-- Two read-only functions, both `security invoker`: the caller's RLS decides what they see, so a
-- member of another boat gets nothing and `anon` cannot execute them at all.
--   1. text_fold()               — case- and accent-insensitive folding, without an extension
--   2. log_title_suggestions()   — E3-3 / ux-flows §4.6: the mechanism behind the 45 s budget
--   3. suggest_checklist_items() — E3-3b / D3: trigram matching replaces the keyword heuristic
--
-- No table, no policy: the tables and views these read already carry theirs (0002, 0003, 0004).

-- ---------------------------------------------------------------------------------------------
-- 1. text_fold: « Carénage » and « carenage » are the same word to a search box.
--    `unaccent` is not installed on the local stack and adding an extension to production for
--    three lookups is not worth it: translate() covers the French alphabet and stays IMMUTABLE
--    (unaccent is only STABLE, which would forbid an expression index later).
-- ---------------------------------------------------------------------------------------------
create or replace function public.text_fold(p_text text)
returns text
language sql immutable
set search_path = ''
as $$
  select lower(
    translate(
      replace(replace(replace(replace(coalesce(p_text, ''), 'Œ', 'OE'), 'œ', 'oe'), 'Æ', 'AE'), 'æ', 'ae'),
      'ÀÁÂÃÄÅàáâãäåÈÉÊËèéêëÌÍÎÏìíîïÒÓÔÕÖØòóôõöøÙÚÛÜùúûüÝýÿÑñÇç',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOOooooooUUUUuuuuYyyNnCc'
    )
  );
$$;

comment on function public.text_fold(text) is
  'Lowercase + accent folding for search and trigram comparison (no unaccent extension needed).';

-- ---------------------------------------------------------------------------------------------
-- 2. log_title_suggestions (ux-flows §4.6): distinct titles already used on this boat, each
--    carrying its category and its most frequent engine. Choosing one fills three fields at
--    once — that is what makes « une vidange en moins de 45 s » possible.
--    Substring match on the folded text (never `<datalist>` on the client), 2 characters
--    minimum, 5 rows, ordered by frequency then recency.
-- ---------------------------------------------------------------------------------------------
create or replace function public.log_title_suggestions(p_boat_id uuid, p_query text)
returns table (
  title text,
  category_id uuid,
  engine_id uuid,
  occurrences int,
  last_performed_at date
)
language sql stable
set search_path = ''
as $$
  with needle as (
    select public.text_fold(p_query) as folded
  ),
  matched as (
    select l.id, l.title, l.category_id, l.performed_at, l.created_at
    from public.maintenance_logs l, needle n
    where l.boat_id = p_boat_id
      and l.deleted_at is null
      and char_length(n.folded) >= 2
      -- strpos, not LIKE: the query is user input and would otherwise carry % and _ wildcards
      and strpos(public.text_fold(l.title), n.folded) > 0
  ),
  grouped as (
    select
      m.title,
      -- the category of the most recent log that had one (a title may have been filed twice)
      (array_remove(
        array_agg(m.category_id order by m.performed_at desc, m.created_at desc), null
      ))[1] as category_id,
      count(*)::int as occurrences,
      max(m.performed_at) as last_performed_at
    from matched m
    group by m.title
  )
  select
    g.title,
    g.category_id,
    (
      select r.engine_id
      from public.engine_hour_readings r
      join matched m2 on m2.id = r.maintenance_log_id
      where m2.title = g.title
      group by r.engine_id
      order by count(*) desc, max(r.read_at) desc
      limit 1
    ) as engine_id,
    g.occurrences,
    g.last_performed_at
  from grouped g
  order by g.occurrences desc, g.last_performed_at desc nulls last, g.title
  limit 5;
$$;

comment on function public.log_title_suggestions(uuid, text) is
  'Up to 5 existing intervention titles of the boat matching the query (case- and accent-insensitive), with their category and their most frequent engine.';

-- ---------------------------------------------------------------------------------------------
-- 3. suggest_checklist_items (E3-3b, D3): which points of the chosen category does this title
--    acknowledge? Replaces the keyword list (vidange, filtre, impeller…) by pg_trgm.
--
--    Two adjustments make the threshold of 0.5 behave on real data:
--      * template items are labelled « <point> — <engine> »; the engine suffix is removed before
--        comparing, otherwise every point of the same engine matches on that common tail;
--      * score = greatest(similarity, strict_word_similarity): plain similarity compares whole
--        strings, so a short title (« Vidange ») never reaches 0.5 against a long label
--        (« Vidange huile moteur + filtre à huile ») even though it names exactly that point.
--    Both sides are folded so accents never decide a match.
-- ---------------------------------------------------------------------------------------------
create or replace function public.suggest_checklist_items(
  p_boat_id uuid,
  p_category_id uuid,
  p_title text
)
returns table (
  id uuid,
  label text,
  category_id uuid,
  engine_id uuid,
  engine_label text,
  interval_months int,
  interval_hours int,
  status public.checklist_state,
  due_at date,
  due_hours numeric,
  days_remaining int,
  hours_remaining numeric,
  last_completed_at date,
  last_engine_hours numeric,
  current_hours numeric,
  score real
)
language sql stable
set search_path = ''
as $$
  select
    s.id,
    s.label,
    s.category_id,
    s.engine_id,
    e.label as engine_label,
    s.interval_months,
    s.interval_hours,
    s.status,
    s.due_at,
    s.due_hours,
    s.days_remaining,
    s.hours_remaining,
    s.last_completed_at,
    s.last_engine_hours,
    s.current_hours,
    c.score
  from public.checklist_item_status s
  left join public.engines e on e.id = s.engine_id
  cross join lateral (
    select case
      when e.label is not null
       and right(s.label, char_length(e.label) + 3) = ' — ' || e.label
      then left(s.label, char_length(s.label) - char_length(e.label) - 3)
      else s.label
    end as core
  ) l
  cross join lateral (
    select greatest(
      extensions.similarity(public.text_fold(l.core), public.text_fold(p_title)),
      extensions.strict_word_similarity(public.text_fold(p_title), public.text_fold(l.core))
    ) as score
  ) c
  where s.boat_id = p_boat_id
    and s.category_id = p_category_id
    and char_length(coalesce(p_title, '')) >= 3
    and c.score > 0.5
  order by c.score desc, s.sort_order, s.label
  limit 5;
$$;

comment on function public.suggest_checklist_items(uuid, uuid, text) is
  'Up to 5 active checklist points of the category whose label matches the intervention title (trigram > 0.5), with their deadline status.';

-- ---------------------------------------------------------------------------------------------
-- Grants: same rule as everywhere else — authenticated and service_role, never anon.
-- ---------------------------------------------------------------------------------------------
revoke all on function public.text_fold(text) from public;
revoke all on function public.log_title_suggestions(uuid, text) from public;
revoke all on function public.suggest_checklist_items(uuid, uuid, text) from public;
grant execute on function public.text_fold(text) to authenticated, service_role;
grant execute on function public.log_title_suggestions(uuid, text) to authenticated, service_role;
grant execute on function public.suggest_checklist_items(uuid, uuid, text) to authenticated, service_role;
