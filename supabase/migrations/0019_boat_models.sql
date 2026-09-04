-- 0019_boat_models.sql — the catalogue of production models, so that typing « Oceanis » is enough.
--
-- Why a table of our own
-- ----------------------
-- The creation screen suggests builders and models drawn from `checklist_templates`, which means
-- it can only suggest the four boats we happen to publish a maintenance plan for. Anyone else
-- types their boat blind. The obvious fix — look the boat up from its registration number — does
-- not exist: the French registry (PUMA) is internal to the Affaires maritimes, with no API and no
-- open data, and nothing anywhere maps a registration to a builder and a model. The datasets that
-- do carry hulls are either scraped verbatim from a site whose terms forbid it, unlicensed, or
-- have no multihulls at all — which rules them out for a product whose first boat is a catamaran.
--
-- So the catalogue is ours, and it is deliberately small: a few hundred production models one
-- actually meets in the Mediterranean, entered by us, versioned in `seed/boat-models.json`.
--
-- Not a business table
-- --------------------
-- No `boat_id` (CLAUDE.md rule 4): this is a reference table, like `checklist_templates`. It is
-- the same shape of thing — published by the platform, readable by everyone signed in, written by
-- nobody else — and it carries no tenant's data, so there is nothing to partition.
--
-- Dimensions are indicative, and often absent
-- -------------------------------------------
-- A model name does not determine a hull. « Oceanis 40 » covers ORC certificates from 1991 to
-- 2020 measuring between 11.80 m and 12.15 m, and most models ship in several keel versions whose
-- draft differs by more than half a metre. The catalogue therefore leaves a dimension null rather
-- than guess it, and the app only ever pre-fills a field the person left empty — it never
-- overwrites what someone measured on their own boat.

create table public.boat_models (
  id           uuid primary key default gen_random_uuid(),
  -- Stable key the data migration upserts on, so re-running it corrects rows instead of doubling
  -- them: 'beneteau-oceanis-40-1'. Generated from builder + model by the script, never typed.
  external_ref text not null unique,
  builder      text not null,
  model        text not null,
  boat_type    public.boat_type not null,
  year_from    int,
  year_to      int,
  length_m     numeric(5,2),
  beam_m       numeric(5,2),
  draft_m      numeric(5,2),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint boat_models_years check (year_from is null or year_to is null or year_to >= year_from),
  constraint boat_models_identity unique (builder, model)
);

create index boat_models_builder_idx on public.boat_models (builder, length_m);

create trigger set_updated_at before update on public.boat_models
  for each row execute function public.set_updated_at();

-- RLS (rule 2). Readable by anyone signed in — it is a published catalogue, it holds nobody's
-- data — and written only by the platform admin, exactly like `checklist_templates`.
alter table public.boat_models enable row level security;

create policy "boat_models_select" on public.boat_models for select to authenticated
  using (is_active or public.is_platform_admin());

create policy "boat_models_write" on public.boat_models for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

comment on table public.boat_models is
  'Reference catalogue of production boat models. No boat_id: platform data, not tenant data. '
  'Dimensions are indicative and frequently null — a model name does not determine a hull.';
