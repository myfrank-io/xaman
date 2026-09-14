-- 0039_search_boat.sql — E18-4: « C'était quand, la dernière courroie ? » gets one answer.
--
-- The carnet could only be searched from inside the Journal, on a log's title and notes. But the
-- first reason to open a maintenance log is a question about a *thing* — a belt, an anode, a
-- supplier, an invoice — and the thing lives in whichever screen happens to hold it. Asking the
-- question meant already knowing the answer's address.
--
-- One function, seven families, `security invoker`: the caller's RLS decides every row, so a
-- stranger reads nothing and a `pro` reads exactly what the policies already give them.
--
-- No table, no policy: everything read here carries its own (0002 → 0034).

-- ---------------------------------------------------------------------------------------------
-- 1. text_haystack: the searchable text of a row, as one string
-- ---------------------------------------------------------------------------------------------
-- A row is searched by everything a person might aim at — a title *and* its notes, a name *and*
-- its brand, its model, its serial. Folding those columns into one string means one expression,
-- one index and one scan per family, instead of one index per column and a BitmapOr across them.
--
-- IMMUTABLE, like `text_fold` (0005) that it wraps: that is what lets it carry a stored column.
-- `array_remove` drops the NULLs so a row with no notes is not a haystack of the word « null ».
create function public.text_haystack(variadic p_parts text[])
returns text
language sql immutable
set search_path = ''
as $$
  select public.text_fold(array_to_string(array_remove(p_parts, null), ' '));
$$;

comment on function public.text_haystack(variadic text[]) is
  'The searchable text of a row, folded into one string (E18-4). IMMUTABLE so it can be stored '
  'in the generated `search_text` column each family of search_boat() rides on.';

-- ---------------------------------------------------------------------------------------------
-- 2. search_text: folded once when written, never while reading
-- ---------------------------------------------------------------------------------------------
-- The folding has to happen somewhere. Written as an *expression* index, it is still evaluated
-- per row whenever the planner does not choose that index — and with `boat_id` on every query
-- (rule 4) it usually does not: it filters by boat first, then folds every row of the carnet to
-- test it. Measured on a ten-year carnet (5 000 interventions): **161 ms**, the whole of it
-- spent folding rows that were never going to match.
--
-- Stored as a generated column, the fold is paid once at write time, the index is a plain column
-- index the planner is willing to drive, and the same query measures **0.6 ms** — 280× less for
-- one column per family. That is the entire reason this migration touches seven tables.
--
-- Nothing here is new information: every one of these columns is already readable by whoever can
-- read the row. `search_text` is their lower-cased, accent-folded concatenation and nothing else,
-- which is why it needs no policy and no column privilege of its own.
alter table public.maintenance_logs
  add column search_text text generated always as (public.text_haystack(title, notes)) stored;

alter table public.checklist_items
  add column search_text text generated always as (public.text_haystack(label, description)) stored;

alter table public.purchases
  add column search_text text
  generated always as (public.text_haystack(designation, supplier_name, notes)) stored;

alter table public.equipment
  add column search_text text
  generated always as (public.text_haystack(name, brand, model, serial)) stored;

alter table public.parts
  add column search_text text
  generated always as (public.text_haystack(name, reference, location, notes)) stored;

-- A contact is searched by name, company and trade — never by phone, e-mail or address. A
-- results page is a thing one shows to whoever is standing next to them, and a typed « 06 »
-- should not print a list of numbers. The column says so as plainly as the function does.
alter table public.contacts
  add column search_text text
  generated always as (public.text_haystack(name, company, specialty)) stored;

alter table public.inbox_items
  add column search_text text
  generated always as (public.text_haystack(subject, file_name, sender_name)) stored;

-- `gin_trgm_ops` answers `like '%…%'` — which is what a search box types: a substring, mid-word,
-- unaccented, in any case.
--
-- The journal's own index goes first. `0001` created `maintenance_logs_search_idx` on the raw
-- `title || ' ' || coalesce(notes, '')`, and no query has ever been able to use it: the only one
-- that wanted it is the journal's filter, which asks `title ilike … or notes ilike …` — two
-- columns, not their concatenation, so the planner falls back to the boat index and filters
-- (verified with EXPLAIN before dropping it). It is replaced here, under its own name, by the
-- folded column that the same search can actually ride.
drop index public.maintenance_logs_search_idx;

create index maintenance_logs_search_idx
  on public.maintenance_logs using gin (search_text extensions.gin_trgm_ops);
create index checklist_items_search_idx
  on public.checklist_items using gin (search_text extensions.gin_trgm_ops);
create index purchases_search_idx
  on public.purchases using gin (search_text extensions.gin_trgm_ops);
create index equipment_search_idx
  on public.equipment using gin (search_text extensions.gin_trgm_ops);
create index parts_search_idx
  on public.parts using gin (search_text extensions.gin_trgm_ops);
create index contacts_search_idx
  on public.contacts using gin (search_text extensions.gin_trgm_ops);
create index inbox_items_search_idx
  on public.inbox_items using gin (search_text extensions.gin_trgm_ops);

-- ---------------------------------------------------------------------------------------------
-- 3. search_boat
-- ---------------------------------------------------------------------------------------------
-- Seven families, one shape. Each row says what it is (`kind`), what to show (`title`,
-- `subtitle`), when it happened and what it cost when those mean something, and how to open it
-- (`id`, plus `parent_id` for a checklist point, whose screen is its category).
--
-- `score` is the trigram similarity of the *name* field — the one a person aims at — computed on
-- the matched rows only. It orders within a family; the UI groups by family and never mixes the
-- two orders.
--
-- Two rules the whole carnet already obeys and this keeps: the bin is invisible (rule 9,
-- `deleted_at is null`), and every family is filtered by `boat_id` (rule 4) even though RLS
-- would already refuse.
create function public.search_boat(
  p_boat_id uuid,
  p_query text,
  p_limit int default 8
)
returns table (
  kind text,
  id uuid,
  title text,
  subtitle text,
  happened_at date,
  amount numeric,
  parent_id uuid,
  score real
)
returns null on null input
language sql stable
set search_path = ''
as $$
  with needle as (
    select
      '%' || public.text_fold(p_query) || '%' as pattern,
      public.text_fold(p_query) as folded,
      -- Two characters minimum, like the title suggestions of 0005: below that every carnet
      -- matches everything and the page says nothing.
      char_length(public.text_fold(p_query)) >= 2 as usable,
      greatest(1, least(p_limit, 20)) as per_family
  ),
  hits as (
    -- Interventions: the answer to « c'était quand ? » is as often in the notes as in the title.
    (
      select
        'log'::text as kind,
        l.id,
        l.title,
        null::text as subtitle,
        l.performed_at as happened_at,
        l.cost as amount,
        l.category_id as parent_id,
        extensions.similarity(public.text_fold(l.title), n.folded) as score
      from public.maintenance_logs l, needle n
      where n.usable
        and l.boat_id = p_boat_id
        and l.deleted_at is null
        and l.search_text like n.pattern
      order by score desc, l.performed_at desc nulls last
      limit (select per_family from needle)
    )
    union all
    -- Checklist points: only the live plan. An inactive point is not something to go and do.
    (
      select
        'item'::text,
        i.id,
        i.label,
        null::text,
        null::date,
        null::numeric,
        i.category_id,
        extensions.similarity(public.text_fold(i.label), n.folded)
      from public.checklist_items i, needle n
      where n.usable
        and i.boat_id = p_boat_id
        and i.is_active
        and i.search_text like n.pattern
      order by 8 desc, i.sort_order
      limit (select per_family from needle)
    )
    union all
    -- Purchases: « combien ? » is half the question, so the supplier is searchable too.
    (
      select
        'purchase'::text,
        p.id,
        p.designation,
        p.supplier_name,
        p.purchased_at,
        p.amount,
        p.category_id,
        extensions.similarity(public.text_fold(p.designation), n.folded)
      from public.purchases p, needle n
      where n.usable
        and p.boat_id = p_boat_id
        and p.deleted_at is null
        and p.search_text like n.pattern
      order by 8 desc, p.purchased_at desc nulls last
      limit (select per_family from needle)
    )
    union all
    -- Equipment: « quelle référence ? » is a serial or a model as often as a name.
    (
      select
        'equipment'::text,
        e.id,
        e.name,
        nullif(trim(coalesce(e.brand, '') || ' ' || coalesce(e.model, '')), ''),
        null::date,
        null::numeric,
        e.category_id,
        extensions.similarity(public.text_fold(e.name), n.folded)
      from public.equipment e, needle n
      where n.usable
        and e.boat_id = p_boat_id
        and e.deleted_at is null
        and e.search_text like n.pattern
      order by 8 desc, e.sort_order
      limit (select per_family from needle)
    )
    union all
    -- Parts: the reference is what one reads off a box in a locker.
    (
      select
        'part'::text,
        pa.id,
        pa.name,
        pa.reference,
        null::date,
        null::numeric,
        pa.category_id,
        extensions.similarity(public.text_fold(pa.name), n.folded)
      from public.parts pa, needle n
      where n.usable
        and pa.boat_id = p_boat_id
        and pa.deleted_at is null
        and pa.search_text like n.pattern
      order by 8 desc, pa.name
      limit (select per_family from needle)
    )
    union all
    -- People: the name, the company, the trade — never the phone, the e-mail or the address.
    (
      select
        'contact'::text,
        c.id,
        c.name,
        nullif(trim(coalesce(c.company, '') || ' ' || coalesce(c.specialty, '')), ''),
        null::date,
        null::numeric,
        null::uuid,
        extensions.similarity(public.text_fold(c.name), n.folded)
      from public.contacts c, needle n
      where n.usable
        and c.boat_id = p_boat_id
        and c.deleted_at is null
        and c.search_text like n.pattern
      order by 8 desc, c.name
      limit (select per_family from needle)
    )
    union all
    -- Documents still waiting in « À valider ». A validated one has become a log or a purchase
    -- and is already found as that: showing it twice would be showing it as two things.
    (
      select
        'document'::text,
        d.id,
        coalesce(nullif(d.subject, ''), d.file_name),
        d.sender_name,
        d.received_at::date,
        null::numeric,
        null::uuid,
        extensions.similarity(
          public.text_fold(coalesce(nullif(d.subject, ''), d.file_name)),
          n.folded
        )
      from public.inbox_items d, needle n
      where n.usable
        and d.boat_id = p_boat_id
        and d.status in ('received', 'analysing', 'ready')
        and d.search_text like n.pattern
      order by 8 desc, d.received_at desc
      limit (select per_family from needle)
    )
  )
  select
    h.kind,
    h.id,
    h.title,
    h.subtitle,
    h.happened_at,
    h.amount,
    h.parent_id,
    h.score
  from hits h
  order by h.score desc, h.happened_at desc nulls last, h.title;
$$;

comment on function public.search_boat(uuid, text, int) is
  'E18-4: one question, seven families (log, item, purchase, equipment, part, contact, document). '
  '`security invoker`, so the caller''s RLS decides every row; the bin and inactive points are '
  'excluded, and a contact''s phone, e-mail and address are never searched.';

-- Supabase grants EXECUTE to anon / authenticated / service_role on creation; 0009 takes it back
-- from `anon` for every function that reads a boat. A search is no exception: there is nothing
-- for a signed-out visitor to search.
revoke execute on function public.text_haystack(variadic text[]) from public, anon;
revoke execute on function public.search_boat(uuid, text, int) from public, anon;
grant execute on function public.search_boat(uuid, text, int) to authenticated, service_role;
