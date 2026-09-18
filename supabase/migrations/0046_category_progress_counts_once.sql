-- ==============================================================================================
-- 0046 — La progression par catégorie ne recompte plus la checklist sept fois (D147)
--
-- `checklist_category_progress` joignait les catégories aux points **sans agréger d'abord** :
--
--     from public.boat_categories c
--     left join public.checklist_item_status s on s.category_id = c.id
--     group by c.id, ...
--
-- `checklist_item_status` est une vue, donc le planificateur l'intègre à la requête et, faute de
-- pouvoir pousser un prédicat dedans, la rejoue **pour chaque catégorie** avant de filtrer sur
-- `category_id`. Sur le bateau Xaman — 7 catégories actives, 161 points — le plan mesuré donnait :
--
--     Nested Loop Left Join  (Rows Removed by Join Filter: 1071)
--       ->  Nested Loop  (rows=161 loops=7)
--             ->  Function Scan on checklist_compute_status  (loops=1127)
--       ->  Seq Scan on maintenance_logs  (loops=1127)
--
-- 1127 calculs de statut et 1127 balayages de `maintenance_logs` pour produire 7 lignes. Et
-- comme chaque vue est en `security_invoker`, chacune de ces lignes traverse la RLS : les
-- politiques de lecture appellent `is_boat_member(boat_id)` et consorts **par ligne**, ce qui
-- multiplie le tout par ~4,4 (mesuré : 40 ms sans RLS, 180 ms avec).
--
-- La vue est lue par la checklist **et** par le tableau de bord, donc ces 200 à 400 ms étaient
-- sur le chemin de presque chaque écran. `pg_stat_statements` en production : 2098 appels à
-- 146 ms de moyenne, 307 s cumulées — la requête la plus coûteuse de toute la base.
--
-- La correction n'est pas un index (`maintenance_logs_checklist_item_idx` existe déjà ; à 23
-- lignes le planificateur préfère le balayage, à raison) : c'est la **forme** de la vue. On
-- agrège les points une fois, par catégorie, puis on joint le résultat aux catégories. Le
-- calcul de statut passe de 1127 à 161, et la RLS avec lui.
--
-- Mesuré sur la base de production, rôle `authenticated`, RLS active : **274,6 ms → 24,4 ms**.
-- Résultat vérifié identique ligne à ligne (`except` dans les deux sens, 0 écart).
--
-- Rien ne change pour l'appelant : mêmes colonnes, même ordre, mêmes types, mêmes valeurs. La
-- logique de statut reste où elle vit (`checklist_item_status`, règle 8) ; cette migration ne
-- touche qu'à la façon de la compter.
-- ==============================================================================================

drop view if exists public.checklist_category_progress;

create view public.checklist_category_progress
with (security_invoker = true) as
with per_category as (
  -- Une seule passe sur les points. C'est tout le sujet de cette migration : le regroupement
  -- par `category_id` remplace les sept relectures que la jointure directe provoquait.
  select
    s.category_id,
    s.boat_id,
    count(s.id) filter (where s.interval_months is not null or s.interval_hours is not null)::int as total,
    count(s.id) filter (where s.status = 'ok' and (s.interval_months is not null or s.interval_hours is not null))::int as ok_count,
    count(s.id) filter (where s.status = 'soon' and (s.interval_months is not null or s.interval_hours is not null))::int as soon_count,
    count(s.id) filter (where s.status = 'overdue')::int as overdue_count,
    count(s.id) filter (where s.status = 'never')::int as never_count,
    count(s.id) filter (where not s.has_completion and (s.interval_months is not null or s.interval_hours is not null))::int as never_recorded_count,
    count(s.id) filter (where s.interval_months is null and s.interval_hours is null)::int as punctual_count,
    (count(s.id) filter (where s.status in ('ok', 'soon') and (s.interval_months is not null or s.interval_hours is not null)))::numeric
      / nullif(count(s.id) filter (where s.interval_months is not null or s.interval_hours is not null), 0) as progress
  from public.checklist_item_status s
  group by s.category_id, s.boat_id
)
select
  c.id as category_id,
  c.boat_id,
  c.name,
  c.color,
  c.icon,
  c.sort_order,
  -- Une catégorie sans point n'a pas de ligne dans `per_category` ; la jointure externe rendait
  -- déjà 0 par `count()` sur zéro ligne, le `coalesce` tient la même promesse.
  coalesce(a.total, 0) as total,
  coalesce(a.ok_count, 0) as ok_count,
  coalesce(a.soon_count, 0) as soon_count,
  coalesce(a.overdue_count, 0) as overdue_count,
  coalesce(a.never_count, 0) as never_count,
  coalesce(a.never_recorded_count, 0) as never_recorded_count,
  coalesce(a.punctual_count, 0) as punctual_count,
  -- `progress` reste nul quand il n'y a rien à mesurer : sans point à intervalle, le `nullif`
  -- de la CTE rend nul, et une catégorie absente de la CTE rend nul elle aussi. Pas de
  -- `coalesce` ici — 0 % et « rien à mesurer » ne sont pas la même chose à l'écran.
  a.progress
from public.boat_categories c
left join per_category a
  on a.category_id = c.id
 and a.boat_id = c.boat_id
where c.is_active;

-- `drop view` emporte les privilèges : on les repose à l'identique (règle 2).
grant select on public.checklist_category_progress to authenticated, service_role;
revoke all on public.checklist_category_progress from anon;
