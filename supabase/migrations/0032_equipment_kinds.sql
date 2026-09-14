-- 0032_equipment_kinds.sql — the families a piece of equipment belongs to (E17-3).
--
-- What this is for
-- ----------------
-- Today a boat's maintenance plan comes from its hull model, and `seed/orc50-checklist.json`
-- shows where that leads: a template published to every ORC 50 that names Xaman's own Starlink,
-- its own Garmin, its own Super B batteries (`docs/AUTOPILOT.md §1.4`). Those points are right —
-- for one boat. What actually decides what a boat needs is not its hull, it is **what is aboard**:
-- two ORC 50s differ by their options, and any two boats that both carry a forced-air heater need
-- the same three things done to it.
--
-- So the plan is to be composed of two layers (`docs/AUTOPILOT.md §4`): the hull template, and a
-- library of rules attached to *families of equipment*. This migration lays the first stone — the
-- families themselves — so that E17-4 can hang rules on them and E17-5 can compose the plan. It
-- writes no rule and changes no plan: on its own it only gives a piece of equipment a name for
-- what kind of thing it is.
--
-- Not a business table
-- --------------------
-- No `boat_id` (CLAUDE.md rule 4): a reference table, exactly like `boat_models` (0019) and
-- `checklist_templates` — published by the platform, readable by everyone signed in, written by
-- nobody else, carrying no tenant's data. `equipment.kind_id` is what ties a boat's row to it.
--
-- Why synonyms, and why they are not clever
-- -----------------------------------------
-- A person writes « Chauffage Wallas 30DT », a yard's document writes « Chauffage fuel Wallas
-- 30DT, air pulsé », a broker writes « chauffage central ». The family is the same. `synonyms`
-- holds what those texts actually say — brand names included, because on this kind of gear the
-- brand *is* how people name the family — and the matching is a whole-word lookup over the name,
-- brand and model (`src/lib/equipment-kinds.ts`). It proposes; it never overwrites a choice, and
-- no match is always an answer: a wrong family would put a boat's heater under the watermaker's
-- rules, which is worse than none.
--
-- Which families are seeded
-- -------------------------
-- Only the ones a real boat in the carnet carries today, plus what every boat has (engines,
-- rigging, anchor, safety). A family is added when a boat turns up with it, never « au cas où »
-- (`docs/AUTOPILOT.md §10`): an unused family is a line in a select that makes the right one
-- harder to find.

create table public.equipment_kinds (
  id           uuid primary key default gen_random_uuid(),
  -- Stable key, so a later migration corrects a row instead of adding a second one.
  external_ref text not null unique,
  -- Shown as is in the select and in the future rules library: French, singular, no brand.
  label        text not null,
  -- The boat system this family usually belongs to, by `boat_categories.external_ref`. Not a
  -- foreign key: categories are per boat (and renameable), this is a hint for pre-filling.
  category_ref text,
  -- What people and documents write for this family, lower-case and unaccented. Read by the
  -- matcher, never shown.
  synonyms     text[] not null default '{}',
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint equipment_kinds_label_unique unique (label)
);

create index equipment_kinds_order_idx on public.equipment_kinds (sort_order, label);

create trigger set_updated_at before update on public.equipment_kinds
  for each row execute function public.set_updated_at();

-- RLS (rule 2). Same shape as `boat_models`: a published catalogue, read by anyone signed in,
-- written by the platform admin alone.
alter table public.equipment_kinds enable row level security;

create policy "equipment_kinds_select" on public.equipment_kinds for select to authenticated
  using (is_active or public.is_platform_admin());

create policy "equipment_kinds_write" on public.equipment_kinds for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

comment on table public.equipment_kinds is
  'Reference catalogue of equipment families (E17-3). No boat_id: platform data, not tenant data. '
  'The key the maintenance rules of E17-4 will hang on.';

-- What a boat''s equipment is an instance of. Null is the normal state of a row nobody has filed
-- yet, and of anything that is not a family (a bulkhead, a hull skin): the plan simply gets
-- nothing from it. `set null` rather than `restrict` — a family is deactivated, never deleted,
-- but if one ever were, an orphan `kind_id` would be worse than none.
alter table public.equipment add column kind_id uuid references public.equipment_kinds(id) on delete set null;

create index equipment_kind_idx on public.equipment (kind_id) where kind_id is not null;

comment on column public.equipment.kind_id is
  'The family this equipment belongs to (E17-3), proposed by the matcher and changeable by hand.';

-- The families, seeded from what the carnet actually carries.
insert into public.equipment_kinds (external_ref, label, category_ref, synonyms, sort_order) values
  ('engine-inboard',    'Moteur inbord',              'engines',              array['moteur','inbord','in-bord','diesel','yanmar','volvo penta','nanni','lombardini'], 10),
  ('engine-outboard',   'Moteur hors-bord',           'engines',              array['hors-bord','hors bord','horsbord','outboard','suzuki','honda','tohatsu','mercury','yamaha'], 20),
  ('saildrive',         'Embase saildrive',           'engines',              array['saildrive','sail drive','embase'], 30),
  ('daggerboard',       'Dérive',                     'daggerboards_rudders', array['derive','derives','dagger','sabre'], 40),
  ('rudder',            'Safran',                     'daggerboards_rudders', array['safran','safrans','gouvernail','meche'], 50),
  ('mast',              'Mât',                        'sails_rigging',        array['mat','mât','espar','lorima','sparcraft','axxon'], 60),
  ('standing-rigging',  'Gréement dormant',           'sails_rigging',        array['greement','hauban','haubans','etai','galhauban','ridoir','dyneema','kevlar'], 70),
  ('sail',              'Voile',                      'sails_rigging',        array['voile','grand-voile','grand voile','genois','gennaker','trinquette','spi','spinnaker','code 0','incidence','north sails','elvstrom','hydranet'], 80),
  ('furler',            'Emmagasineur / enrouleur',   'sails_rigging',        array['emmagasineur','enrouleur','stockeur','furler','karver','profurl','facnor'], 90),
  ('winch',             'Winch',                      'sails_rigging',        array['winch','winchs','winches','andersen','harken','lewmar','antal'], 100),
  ('windlass',          'Guindeau',                   'hull_deck',            array['guindeau','windlass','barbotin','lofrans','quick','maxwell'], 110),
  ('anchor-rode',       'Mouillage (ancre et chaîne)','hull_deck',            array['mouillage','ancre','chaine','chaîne','spade','rocna','delta','manson'], 120),
  ('antifouling',       'Antifouling',                'hull_deck',            array['antifouling','anti-fouling','carene','coppercoat','copper coat','nautix','seajet','international'], 130),
  ('dinghy',            'Annexe',                     'hull_deck',            array['annexe','semi-rigide','dinghy','highfield','zodiac','bombard','ab inflatables'], 140),
  ('davits',            'Bossoirs',                   'hull_deck',            array['bossoir','bossoirs','davits','portique'], 150),
  ('battery-lithium',   'Batterie lithium',           'energy',               array['lithium','lifepo4','super b','superb','battery lithium'], 160),
  ('battery-lead',      'Batterie plomb / AGM',       'energy',               array['agm','gel','plomb','batterie de service','batterie moteur'], 170),
  ('solar-panel',       'Panneau solaire',            'energy',               array['panneau solaire','panneaux solaires','solaire','photovoltaique','back contact'], 180),
  ('charger-shore',     'Chargeur de quai',           'energy',               array['chargeur','prise de quai','cristec','mastervolt','dolphin'], 190),
  ('inverter',          'Convertisseur',              'energy',               array['convertisseur','onduleur','inverter','victron','phoenix','multiplus'], 200),
  ('alternator',        'Alternateur',                'energy',               array['alternateur','alternator','regulateur de charge'], 210),
  ('watermaker',        'Dessalinisateur',            'plumbing_systems',     array['dessalinisateur','dessalateur','osmoseur','watermaker','aquabase','aqua base','schenker','dessalator','katadyn'], 220),
  ('heater-forced-air', 'Chauffage à air pulsé',      'plumbing_systems',     array['chauffage','air pulse','air pulsé','wallas','webasto','eberspacher','eberspächer','truma'], 230),
  ('water-heater',      'Chauffe-eau',                'plumbing_systems',     array['chauffe-eau','chauffe eau','ballon','boiler','isotemp','quick'], 240),
  ('fridge',            'Réfrigérateur',              'plumbing_systems',     array['refrigerateur','réfrigérateur','frigo','frigidaire','isotherm','waeco','keel cooler'], 250),
  ('freezer',           'Congélateur',                'plumbing_systems',     array['congelateur','congélateur','freezer'], 260),
  ('marine-toilet',     'WC marin',                   'plumbing_systems',     array['wc','toilette','toilettes','jabsco','tecma','broyeur'], 270),
  ('bilge-pump',        'Pompe de cale',              'plumbing_systems',     array['pompe de cale','pompe','cale','whale','rule'], 280),
  ('gas-system',        'Installation gaz',           'plumbing_systems',     array['gaz','bouteille de gaz','detendeur','détendeur','propane','butane'], 290),
  ('washing-machine',   'Lave-linge',                 'plumbing_systems',     array['lave-linge','lave linge','machine a laver','seche-linge','daewoo'], 300),
  ('instruments',       'Centrale de navigation',     'electronics_nav',      array['centrale','instruments','girouette','anemometre','anémomètre','speedo','loch','sondeur','nke','b&g','raymarine','garmin'], 310),
  ('plotter',           'Traceur',                    'electronics_nav',      array['traceur','plotter','gps','cartographie','axiom','navionics','zeus','gpsmap'], 320),
  ('autopilot',         'Pilote automatique',         'electronics_nav',      array['pilote','pilote automatique','autopilot','verin','vérin','drive'], 330),
  ('vhf',               'VHF',                        'electronics_nav',      array['vhf','asn','dsc','icom','standard horizon'], 340),
  ('ais',               'AIS',                        'electronics_nav',      array['ais','transpondeur','transponder'], 350),
  ('satcom',            'Liaison satellite',          'electronics_nav',      array['satellite','starlink','iridium','inmarsat','vsat'], 360),
  ('liferaft',          'Radeau de survie',           'safety',               array['radeau','radeau de survie','survie','liferaft','plastimo','survitec','zodiac survie'], 370),
  ('epirb',             'Balise de détresse',         'safety',               array['balise','epirb','plb','sart','mcmurdo','ocean signal'], 380),
  ('extinguisher',      'Extincteur',                 'safety',               array['extincteur','extincteurs','couverture anti-feu'], 390),
  ('lifejacket',        'Gilet de sauvetage',         'safety',               array['gilet','gilets','brassiere','brassière','harnais','percuteur'], 400),
  ('pyrotechnics',      'Pyrotechnie',                'safety',               array['fusee','fusée','fusees','fumigene','fumigène','pyrotechnie','feux a main'], 410);
