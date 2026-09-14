-- 0033_maintenance_rules.sql — the library of maintenance rules, hung on equipment families (E17-4).
--
-- What this is for
-- ----------------
-- `0032` gave a piece of equipment the name of what it is. This gives that name a meaning: what
-- has to be done to it, how often, with what. A rule attaches to a **family** (`equipment_kinds`)
-- and may narrow to a brand or a model. It carries what a checklist point carries — label,
-- interval in months and/or engine hours, `engine_scope`, `zone_scope`, step-by-step actions —
-- plus **its consumables** (filter, anode, membrane, impeller) and **its source**.
--
-- This is the second of the two layers of `docs/AUTOPILOT.md §4`, and the whole reason for the
-- first: the rule for a Wallas heater is written once and serves every boat that carries one. It
-- is the only asset of the product that **grows** with each boat read instead of being consumed.
--
-- What it does not do
-- -------------------
-- It composes no plan. Nothing here reads a boat, writes a `checklist_item` or touches an existing
-- one — E17-5 does that, and it is the ticket that will need `checklist_items.equipment_id`. On
-- its own this migration adds a catalogue nobody's boat has seen yet.
--
-- Not a business table
-- --------------------
-- No `boat_id` (rule 4): platform data, like `equipment_kinds` (`0032`), `boat_models` (`0019`)
-- and `checklist_templates`. Read by anyone signed in while `is_active`, written by the platform
-- admin alone.
--
-- Why every seeded rule says `proposal`
-- -------------------------------------
-- `docs/AUTOPILOT.md §6`: **an interval is never invented** — a rule carries its source, and
-- without one the point arrives marked « proposé ». The intervals below are the widely practised
-- ones, and that is exactly what a proposal is: they are worth showing to a person, not worth
-- asserting over one. Citing a manual page nobody has opened would be the one failure this table
-- exists to prevent, so `source_ref` stays empty and `source` stays `proposal` until a real
-- document says otherwise — which is what E17-1 and E17-2 are for, as boats deposit their manuals.
-- The constraint below is what makes that honest rather than a habit: any source **other** than
-- `proposal` must name where it comes from.
--
-- The precedent is in the repo already: the 93 points of the ORC 50 are seeded `source =
-- 'proposal'` for the same reason.

create table public.maintenance_rules (
  id              uuid primary key default gen_random_uuid(),
  -- Stable key, so a later migration corrects a rule instead of adding a second one.
  external_ref    text not null unique,
  -- The family this rule applies to. `cascade`: a rule without its family is nothing, and a family
  -- is deactivated rather than deleted, so this fires only if one is ever really removed.
  kind_id         uuid not null references public.equipment_kinds (id) on delete cascade,
  -- Optional narrowing. Null means « every equipment of this family »; « Wallas » means only that
  -- brand. Compared without case or accents (`normaliseForMatch`), never as written.
  brand           text,
  model           text,
  label           text not null,
  description     text,
  interval_months int check (interval_months > 0),
  interval_hours  int check (interval_hours > 0),
  -- Same vocabulary as `checklist_template_items` (D90, `0024`), so E17-5 composes the plan with
  -- the one matching function the app already has, `engine_scope_matches`.
  engine_scope    text not null default 'none'
                  check (engine_scope in ('none', 'inboard', 'outboard', 'all', 'shaft', 'saildrive', 'sterndrive', 'jet')),
  zone_scope      text not null default 'all' check (zone_scope in ('all', 'offshore')),
  -- Step-by-step, as on a template point: an array of strings.
  actions         jsonb not null default '[]'::jsonb check (jsonb_typeof(actions) = 'array'),
  -- What the job consumes, in the shape `parts` stores (E17-8 feeds the stock and « À racheter »
  -- from here): `[{"name": "Filtre à gasoil", "reference": "…", "quantity": 1, "unit": "pc"}]`.
  consumables     jsonb not null default '[]'::jsonb,
  source          text not null default 'proposal'
                  check (source in ('proposal', 'manual', 'builder', 'regulation')),
  -- Where it comes from, as a person would check it: « Manuel Wallas 30DT, p. 14 ».
  source_ref      text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- An interval in engine hours requires an engine, exactly as on a template point.
  constraint maintenance_rules_hours_need_engine
    check (interval_hours is null or engine_scope <> 'none'),
  -- `AUTOPILOT.md §6` in the schema: anything claiming an authority has to name it. A proposal
  -- claims none, so it needs nothing.
  constraint maintenance_rules_source_needs_ref
    check (source = 'proposal' or coalesce(source_ref, '') <> '')
);

-- The shape of a consumable, checked in base rather than trusted. A line with no name would reach
-- the stock in E17-8 as a nameless part — the kind of thing nobody notices until the list is full
-- of them. `immutable`, so it can stand in a check constraint.
create function public.maintenance_rule_consumables_valid(p_consumables jsonb)
returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(p_consumables) = 'array'
     and not exists (
       select 1
       from jsonb_array_elements(p_consumables) as e
       where jsonb_typeof(e) <> 'object'
          or coalesce(e ->> 'name', '') = ''
     );
$$;

comment on function public.maintenance_rule_consumables_valid(jsonb) is
  'Whether a maintenance_rules.consumables value is an array of objects that each name something '
  '(E17-4). Used as a check constraint, so a nameless consumable never reaches the stock (E17-8).';

alter table public.maintenance_rules
  add constraint maintenance_rules_consumables_shape
  check (public.maintenance_rule_consumables_valid(consumables));

-- The read E17-5 makes: every active rule of the families a boat carries.
create index maintenance_rules_kind_idx on public.maintenance_rules (kind_id, sort_order)
  where is_active;

create trigger set_updated_at before update on public.maintenance_rules
  for each row execute function public.set_updated_at();

-- RLS (rule 2). Same shape as `equipment_kinds` and `boat_models`: a published catalogue, read by
-- anyone signed in, written by the platform admin alone.
alter table public.maintenance_rules enable row level security;

create policy "maintenance_rules_select" on public.maintenance_rules for select to authenticated
  using (is_active or public.is_platform_admin());

create policy "maintenance_rules_write" on public.maintenance_rules for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

comment on table public.maintenance_rules is
  'What has to be done to an equipment family, how often, with what (E17-4). No boat_id: platform '
  'data, not tenant data. The second layer of the plan (AUTOPILOT.md §4); E17-5 composes it.';

comment on column public.maintenance_rules.source is
  'proposal (default) | manual | builder | regulation. AUTOPILOT.md §6: an interval is never '
  'invented — anything but a proposal must name its source in source_ref.';

-- ---------------------------------------------------------------------------------------------
-- The first pass of the library: the families a real boat of the carnet carries, and the jobs
-- nobody disputes. `kind_id` is resolved by `external_ref`, so a family that is not seeded simply
-- contributes no rule instead of breaking the migration.
--
-- Five of the forty-one families of `0032` deliberately get nothing: freezer, washing machine,
-- plotter, AIS, satellite link. There is no periodic job on them that a person would thank us for
-- — « contrôler que ça marche » is a line that gets ticked without being read, and it costs the
-- credibility of the ninety that mean something. A family gets a rule when someone can say what
-- to do to it (`AUTOPILOT.md §10`).
-- ---------------------------------------------------------------------------------------------
insert into public.maintenance_rules
  (external_ref, kind_id, label, description, interval_months, interval_hours, engine_scope, zone_scope, actions, consumables, sort_order)
select
  r.external_ref,
  k.id,
  r.label,
  r.description,
  r.interval_months,
  r.interval_hours,
  r.engine_scope,
  r.zone_scope,
  r.actions,
  r.consumables,
  r.sort_order
from (values
  -- Engines. The hour intervals are why `engine_scope` is not 'none' here.
  ('engine-inboard',    'engine-inboard-oil',        'Vidange moteur et filtre à huile',        'Huile chaude, moteur à l''arrêt depuis peu. Relever les heures au compteur.', 12,  250, 'inboard',  'all', '["Vidanger l''huile usagée à la pompe","Remplacer le filtre à huile","Refaire le niveau","Faire tourner et contrôler l''absence de fuite"]'::jsonb, '[{"name":"Huile moteur","quantity":1,"unit":"L"},{"name":"Filtre à huile","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('engine-inboard',    'engine-inboard-fuel-filter','Remplacer le filtre à gasoil',            'Préfiltre décanteur compris : purger l''eau avant de déposer la cartouche.',   12,  250, 'inboard',  'all', '["Fermer le robinet de gasoil","Remplacer la cartouche","Purger le circuit","Contrôler l''absence de fuite"]'::jsonb, '[{"name":"Filtre à gasoil","quantity":1,"unit":"pc"}]'::jsonb, 20),
  ('engine-inboard',    'engine-inboard-impeller',   'Remplacer la turbine de pompe à eau de mer', 'Compter les pales au remontage : une pale manquante est partie dans l''échangeur.', 12, null, 'inboard', 'all', '["Fermer le passe-coque","Déposer le couvercle de pompe","Remplacer la turbine et son joint","Rouvrir le passe-coque et contrôler le débit"]'::jsonb, '[{"name":"Turbine de pompe à eau de mer","quantity":1,"unit":"pc"},{"name":"Joint de couvercle de pompe","quantity":1,"unit":"pc"}]'::jsonb, 30),
  ('engine-inboard',    'engine-inboard-anode',      'Contrôler et remplacer les anodes moteur', 'Une anode consommée à plus de la moitié se remplace.',                        12, null, 'inboard',  'all', '["Déposer les anodes","Mesurer l''usure","Remplacer si consommée à plus de la moitié"]'::jsonb, '[{"name":"Anode moteur","quantity":1,"unit":"pc"}]'::jsonb, 40),
  ('engine-inboard',    'engine-inboard-belt',       'Contrôler la courroie d''alternateur',    'Tension, fissures, poussière noire au pied du moteur.',                       12, null, 'inboard',  'all', '["Contrôler la tension","Chercher fissures et effilochage","Remplacer si le moindre doute"]'::jsonb, '[{"name":"Courroie d''alternateur","quantity":1,"unit":"pc"}]'::jsonb, 50),
  ('engine-outboard',   'engine-outboard-oil',       'Vidange du hors-bord',                    'Moteur quatre temps : huile et filtre. Deux temps : ne pas appliquer.',       12,  100, 'outboard', 'all', '["Vidanger l''huile moteur","Remplacer le filtre à huile","Refaire le niveau"]'::jsonb, '[{"name":"Huile moteur","quantity":1,"unit":"L"},{"name":"Filtre à huile","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('engine-outboard',   'engine-outboard-gearbox',   'Vidange de l''embase du hors-bord',       'Une huile laiteuse signale une entrée d''eau : joints spi à refaire.',        12, null, 'outboard', 'all', '["Vidanger l''embase","Contrôler la couleur de l''huile sortie","Remplir par le bas jusqu''au débordement","Remplacer les joints de bouchon"]'::jsonb, '[{"name":"Huile d''embase","quantity":1,"unit":"L"},{"name":"Joints de bouchon de vidange","quantity":2,"unit":"pc"}]'::jsonb, 20),
  ('engine-outboard',   'engine-outboard-impeller',  'Remplacer la turbine du hors-bord',       'Contrôler le témoin d''eau au démarrage après remontage.',                    12, null, 'outboard', 'all', '["Déposer l''embase","Remplacer la turbine","Remonter et contrôler le témoin d''eau"]'::jsonb, '[{"name":"Turbine","quantity":1,"unit":"pc"}]'::jsonb, 30),
  ('saildrive',         'saildrive-oil',             'Vidange de l''embase saildrive',          'Huile laiteuse = entrée d''eau par les joints spi de l''hélice.',             12, null, 'saildrive','all', '["Vidanger l''embase","Contrôler la couleur de l''huile sortie","Remplir et contrôler le niveau"]'::jsonb, '[{"name":"Huile d''embase","quantity":2,"unit":"L"}]'::jsonb, 10),
  ('saildrive',         'saildrive-anode',           'Remplacer l''anode de saildrive',         'À chaque sortie de l''eau, et à mi-saison en eau chaude.',                     6, null, 'saildrive','all', '["Déposer l''anode usée","Nettoyer la portée","Poser l''anode neuve"]'::jsonb, '[{"name":"Anode de saildrive","quantity":1,"unit":"pc"}]'::jsonb, 20),
  ('saildrive',         'saildrive-diaphragm',       'Remplacer le soufflet de saildrive',      'Le seul point de ce plan dont la défaillance coule le bateau : contrôler le soufflet à chaque sortie de l''eau, le remplacer au terme donné par le constructeur.', 84, null, 'saildrive','all', '["Contrôler l''état du soufflet à chaque sortie de l''eau","Remplacer au terme prescrit par le constructeur"]'::jsonb, '[{"name":"Soufflet de saildrive","quantity":1,"unit":"pc"}]'::jsonb, 30),
  ('alternator',        'alternator-check',          'Contrôler l''alternateur et sa charge',   'Tension de charge à chaud, serrage des cosses, état des charbons.',           12, null, 'all',      'all', '["Mesurer la tension de charge moteur chaud","Contrôler le serrage des cosses","Contrôler l''état des charbons"]'::jsonb, '[]'::jsonb, 10),

  -- Underwater and steering.
  ('daggerboard',       'daggerboard-check',         'Contrôler dérives et puits',              'Jeu, état du bordé de puits, fonctionnement du palan de relevage.',           12, null, 'none', 'all', '["Descendre et remonter la dérive en entier","Contrôler le jeu dans le puits","Contrôler le palan et son amarrage"]'::jsonb, '[]'::jsonb, 10),
  ('rudder',            'rudder-bearings',           'Contrôler mèches et bagues de safran',    'Jeu à la tête et au pied, étanchéité du presse-étoupe.',                      12, null, 'none', 'all', '["Contrôler le jeu en tête et au pied de mèche","Contrôler l''étanchéité","Contrôler la liaison de barre"]'::jsonb, '[]'::jsonb, 10),
  ('antifouling',       'antifouling-apply',         'Carénage et antifouling',                 'Au sortir de l''eau : nettoyage haute pression avant séchage de l''ancien.',   12, null, 'none', 'all', '["Nettoyer la carène au sortir de l''eau","Poncer et reprendre les manques","Appliquer les couches d''antifouling","Reprendre les anodes de carène"]'::jsonb, '[{"name":"Antifouling","quantity":5,"unit":"L"},{"name":"Anode de carène","quantity":2,"unit":"pc"}]'::jsonb, 10),

  -- Rig and sails.
  ('mast',              'mast-inspection',           'Visite du mât et de l''accastillage de tête', 'Monter au mât : réas, axes, girouette, feux, amarrages de drisses.',      12, null, 'none', 'all', '["Monter au mât","Contrôler réas, axes et manilles","Contrôler feux et girouette","Contrôler l''état des drisses en tête"]'::jsonb, '[]'::jsonb, 10),
  ('standing-rigging',  'standing-rigging-check',    'Contrôler le gréement dormant',           'Ridoirs, cadènes, goupilles, sertissages, points de corrosion.',              12, null, 'none', 'all', '["Contrôler ridoirs et goupilles","Contrôler cadènes et leur étanchéité","Chercher brins rompus et corrosion","Refaire les protections de goupilles"]'::jsonb, '[]'::jsonb, 10),
  ('standing-rigging',  'standing-rigging-replace',  'Remplacer le gréement dormant',           'Terme donné par le gréeur et l''assureur, pas par l''usage apparent.',       120, null, 'none', 'all', '["Faire déposer et contrôler le gréement par un gréeur","Remplacer selon son avis"]'::jsonb, '[]'::jsonb, 20),
  ('sail',              'sail-inspection',           'Contrôler les voiles',                    'Coutures, anti-UV, points de ris, état des lattes et des chariots.',          12, null, 'none', 'all', '["Contrôler coutures et renforts","Contrôler l''anti-UV","Contrôler lattes, chariots et points de ris","Rincer et sécher avant hivernage"]'::jsonb, '[]'::jsonb, 10),
  ('furler',            'furler-service',            'Rincer et graisser l''emmagasineur',      'Eau douce abondante puis graisse marine sur les portées.',                    12, null, 'none', 'all', '["Rincer à l''eau douce","Graisser les portées","Contrôler le jeu et l''émerillon","Contrôler la drisse et son amarrage"]'::jsonb, '[{"name":"Graisse marine","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('winch',             'winch-service',             'Démonter, nettoyer et graisser les winchs', 'Graisse sur les portées, huile fine sur les cliquets : pas l''inverse.',    12, null, 'none', 'all', '["Démonter le winch","Nettoyer au dégraissant","Graisser les portées et huiler les cliquets","Remonter et contrôler les deux vitesses"]'::jsonb, '[{"name":"Graisse à winch","quantity":1,"unit":"pc"},{"name":"Huile à cliquets","quantity":1,"unit":"pc"}]'::jsonb, 10),

  -- Deck and ground tackle.
  ('windlass',          'windlass-service',          'Entretenir le guindeau',                  'Barbotin, embrayage, étanchéité du moteur, coupe-circuit.',                   12, null, 'none', 'all', '["Contrôler l''usure du barbotin","Contrôler l''embrayage et le frein","Graisser selon la notice","Contrôler le coupe-circuit et les cosses"]'::jsonb, '[]'::jsonb, 10),
  ('anchor-rode',       'anchor-rode-check',         'Contrôler mouillage, chaîne et manille',  'Manille d''ancre, maillon rapide, amarrage du bout de chaîne au bateau.',     12, null, 'none', 'all', '["Dérouler toute la chaîne","Contrôler l''usure des maillons et de la manille","Contrôler l''amarrage du brin dormant","Remarquer les longueurs"]'::jsonb, '[]'::jsonb, 10),
  ('dinghy',            'dinghy-check',              'Contrôler l''annexe',                     'Valves, collages, plancher, tableau arrière, bouchon de nable.',              12, null, 'none', 'all', '["Gonfler et laisser 24 h pour chercher une fuite","Contrôler valves et collages","Contrôler plancher et tableau arrière"]'::jsonb, '[]'::jsonb, 10),
  ('davits',            'davits-check',              'Contrôler les bossoirs',                  'Axes, sangles, palans et leur ancrage dans la structure.',                    12, null, 'none', 'all', '["Contrôler axes et goupilles","Contrôler sangles et palans","Contrôler l''ancrage dans la structure"]'::jsonb, '[]'::jsonb, 10),

  -- Energy.
  ('battery-lithium',   'battery-lithium-check',     'Contrôler le parc lithium',               'Tensions de repos par élément, serrage des cosses, journal du BMS.',          12, null, 'none', 'all', '["Relever la tension de repos de chaque élément","Contrôler le serrage des cosses","Lire le journal du BMS","Contrôler la ventilation du coffre"]'::jsonb, '[]'::jsonb, 10),
  ('battery-lead',      'battery-lead-check',        'Contrôler le parc plomb / AGM',           'Niveau d''électrolyte sur les batteries ouvertes, tension par élément.',       6, null, 'none', 'all', '["Contrôler le niveau d''électrolyte","Mesurer la tension de chaque batterie","Nettoyer et graisser les cosses"]'::jsonb, '[{"name":"Eau déminéralisée","quantity":1,"unit":"L"}]'::jsonb, 10),
  ('solar-panel',       'solar-panel-clean',         'Nettoyer les panneaux solaires',          'Le sel seul coûte une part notable de la production.',                        6, null, 'none', 'all', '["Nettoyer à l''eau douce","Contrôler les connexions et les presse-étoupes","Relever la production au régulateur"]'::jsonb, '[]'::jsonb, 10),
  ('charger-shore',     'charger-shore-check',       'Contrôler la prise de quai et le chargeur', 'Différentiel, état de la prise, échauffement des cosses.',                  12, null, 'none', 'all', '["Tester le différentiel","Contrôler l''état de la prise et du câble","Contrôler l''échauffement des cosses en charge"]'::jsonb, '[]'::jsonb, 10),
  ('inverter',          'inverter-check',            'Contrôler le convertisseur',              'Dépoussiérage, ventilation, serrage des cosses de puissance.',                12, null, 'none', 'all', '["Dépoussiérer l''appareil et sa ventilation","Contrôler le serrage des cosses de puissance","Contrôler le fonctionnement en charge"]'::jsonb, '[]'::jsonb, 10),

  -- Plumbing and comfort.
  ('watermaker',        'watermaker-prefilters',     'Remplacer les préfiltres du dessalinisateur', 'Ou dès que la pression d''alimentation chute.',                             6, null, 'none', 'offshore', '["Fermer l''alimentation","Remplacer les cartouches de préfiltre","Purger et contrôler la pression"]'::jsonb, '[{"name":"Cartouche de préfiltre","quantity":2,"unit":"pc"}]'::jsonb, 10),
  ('watermaker',        'watermaker-membrane',       'Rincer et conserver la membrane',         'Rinçage à l''eau douce après chaque usage ; conservation avant tout arrêt long.', 12, null, 'none', 'offshore', '["Rincer à l''eau douce","Injecter le produit de conservation avant un arrêt long","Relever la salinité de l''eau produite"]'::jsonb, '[{"name":"Produit de conservation de membrane","quantity":1,"unit":"pc"}]'::jsonb, 20),
  ('heater-forced-air', 'heater-forced-air-service', 'Réviser le chauffage à air pulsé',        'Brûleur, filtre, prise d''air, sortie des gaz brûlés.',                       12, null, 'none', 'all', '["Faire réviser le brûleur","Remplacer le filtre","Contrôler prise d''air et sortie des gaz","Faire un cycle complet et contrôler l''absence d''odeur"]'::jsonb, '[{"name":"Filtre de chauffage","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('water-heater',      'water-heater-anode',        'Contrôler l''anode du chauffe-eau',       'Et détartrer si l''eau du réseau est calcaire.',                              12, null, 'none', 'all', '["Couper l''alimentation et vidanger","Contrôler l''anode et la remplacer si consommée","Détartrer la cuve si nécessaire"]'::jsonb, '[{"name":"Anode de chauffe-eau","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('fridge',            'fridge-condenser',          'Nettoyer le condenseur du réfrigérateur', 'Un condenseur encrassé double la consommation du groupe.',                    12, null, 'none', 'all', '["Dépoussiérer le condenseur et son ventilateur","Contrôler la circulation d''air du coffre","Contrôler les joints de porte"]'::jsonb, '[]'::jsonb, 10),
  ('marine-toilet',     'marine-toilet-descale',     'Détartrer le WC marin',                   'Vinaigre ou acide dilué ; jamais de produit chloré sur les joints.',          12, null, 'none', 'all', '["Faire circuler le produit de détartrage","Rincer abondamment","Contrôler le fonctionnement des clapets"]'::jsonb, '[{"name":"Produit de détartrage","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('marine-toilet',     'marine-toilet-seals',       'Remplacer les joints et clapets du WC',   'Kit complet du fabricant : les joints vieillissent ensemble.',                24, null, 'none', 'all', '["Fermer les passe-coques","Déposer la pompe","Remplacer joints et clapets","Remonter et contrôler l''étanchéité"]'::jsonb, '[{"name":"Kit de joints de WC marin","quantity":1,"unit":"pc"}]'::jsonb, 20),
  ('bilge-pump',        'bilge-pump-test',           'Essayer les pompes de cale',              'Automatique comprise : lever le flotteur à la main, pas au contacteur.',       6, null, 'none', 'all', '["Nettoyer la crépine","Lever le flotteur à la main et contrôler le démarrage","Contrôler le refoulement et le col de cygne","Contrôler l''alarme de niveau"]'::jsonb, '[]'::jsonb, 10),
  ('gas-system',        'gas-system-check',          'Contrôler l''installation gaz',           'Test à l''eau savonneuse sur les raccords, jamais à la flamme.',              12, null, 'none', 'all', '["Contrôler le tuyau et sa date","Contrôler le détendeur et l''électrovanne","Chercher les fuites à l''eau savonneuse","Contrôler la ventilation du coffre"]'::jsonb, '[]'::jsonb, 10),
  ('gas-system',        'gas-system-hose',           'Remplacer le tuyau de gaz',               'Le tuyau porte sa date de péremption imprimée.',                              60, null, 'none', 'all', '["Fermer la bouteille","Remplacer le tuyau et ses colliers","Contrôler l''étanchéité à l''eau savonneuse"]'::jsonb, '[{"name":"Tuyau de gaz","quantity":1,"unit":"pc"}]'::jsonb, 20),

  -- Electronics and navigation.
  ('instruments',       'instruments-check',         'Contrôler la centrale de navigation',     'Capteurs, calibration du compas, nettoyage du speedomètre.',                  12, null, 'none', 'all', '["Nettoyer le capteur de speed","Contrôler sondeur et anémomètre","Recalibrer le compas si nécessaire","Contrôler les connexions du bus"]'::jsonb, '[]'::jsonb, 10),
  ('autopilot',         'autopilot-check',           'Contrôler le pilote automatique',         'Vérin, fixations, jeu de la liaison de barre, essai en route.',               12, null, 'none', 'all', '["Contrôler le vérin et ses fixations","Contrôler le jeu de la liaison de barre","Faire un essai en route et un calibrage"]'::jsonb, '[]'::jsonb, 10),
  ('vhf',               'vhf-check',                 'Essayer la VHF et son antenne',           'Essai radio, contrôle de l''antenne de tête et du numéro MMSI.',              12, null, 'none', 'all', '["Faire un essai radio","Contrôler l''antenne et son câble","Contrôler le MMSI programmé","Essayer l''appel ASN de test"]'::jsonb, '[]'::jsonb, 10),

  -- Safety. Offshore gear is not applied to a coastal boat (D90).
  ('liferaft',          'liferaft-service',          'Révision du radeau de survie',            'Terme donné par le fabricant et porté sur la housse ; la révision est faite en station agréée.', 12, null, 'none', 'offshore', '["Déposer le radeau en station agréée","Récupérer le procès-verbal de révision","Contrôler la date portée sur la housse au retour","Contrôler le largueur hydrostatique"]'::jsonb, '[]'::jsonb, 10),
  ('epirb',             'epirb-test',                'Essayer la balise de détresse',           'Essai par la fonction de test de la balise, jamais par une émission réelle.', 12, null, 'none', 'offshore', '["Faire le test intégré de la balise","Contrôler l''enregistrement du code","Contrôler le largueur et sa date"]'::jsonb, '[]'::jsonb, 10),
  ('epirb',             'epirb-battery',             'Remplacer la batterie de la balise',      'La date de péremption est portée sur la balise.',                             60, null, 'none', 'offshore', '["Faire remplacer la batterie par un agent agréé","Contrôler la nouvelle date de péremption"]'::jsonb, '[{"name":"Batterie de balise","quantity":1,"unit":"pc"}]'::jsonb, 20),
  ('extinguisher',      'extinguisher-check',        'Contrôler les extincteurs',               'Pression, plomb, accessibilité, date de la dernière vérification.',           12, null, 'none', 'all', '["Contrôler la pression au manomètre","Contrôler le plomb et la goupille","Contrôler l''accessibilité de chaque appareil","Faire vérifier selon le terme du fabricant"]'::jsonb, '[]'::jsonb, 10),
  ('lifejacket',        'lifejacket-check',          'Contrôler les gilets gonflables',         'Percuteur, cartouche, étanchéité de la vessie, sangle et harnais.',           12, null, 'none', 'all', '["Contrôler la cartouche et sa pesée","Contrôler le percuteur et sa date","Gonfler à la bouche et laisser 24 h","Contrôler sangles, boucles et longe"]'::jsonb, '[{"name":"Cartouche de gilet","quantity":1,"unit":"pc"},{"name":"Pastille de percuteur","quantity":1,"unit":"pc"}]'::jsonb, 10),
  ('pyrotechnics',      'pyrotechnics-replace',      'Remplacer les feux à main et fusées',     'La date de péremption est imprimée sur chaque artifice.',                     36, null, 'none', 'all', '["Relever la date de chaque artifice","Remplacer les périmés","Déposer les anciens en point de collecte"]'::jsonb, '[]'::jsonb, 10)
) as r (kind_ref, external_ref, label, description, interval_months, interval_hours, engine_scope, zone_scope, actions, consumables, sort_order)
join public.equipment_kinds k on k.external_ref = r.kind_ref;
