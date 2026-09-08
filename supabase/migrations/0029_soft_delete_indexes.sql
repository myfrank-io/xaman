-- 0029_soft_delete_indexes.sql — les index que la corbeille avait laissés derrière elle.
--
-- Règle 9 : interventions, achats et sorties de l'eau ne sont jamais supprimés, ils portent un
-- `deleted_at`. Chaque lecture de liste finit donc par `... and deleted_at is null` — et les
-- index de `0001` ont été écrits **avant** cette règle : `maintenance_logs (boat_id,
-- performed_at desc)` et `purchases (boat_id, purchased_at desc)` ne connaissent pas la colonne.
-- Postgres les utilise quand même, puis relit chaque ligne rapportée pour vérifier ce
-- `deleted_at` — le filtre est appliqué *après* le parcours, pas pendant. `0012` a fait le
-- travail pour `contacts` et `parts` (et `0011` / `0014` pour `attachments` et `equipment`),
-- mais pas pour les deux tables les plus lues de l'application.
--
-- Ce sont celles que **tous** les écrans traversent : le journal (vingt lignes par page, triées
-- par date), la file du tableau de bord, le point rouge de la navigation — recalculé par le
-- layout à chaque écran, donc à chaque tap d'onglet —, la revue des lignes importées, et la
-- liste des dépenses, qui lit tout l'historique du bateau pour en faire un cumul.
--
-- Les cinq index :
--
--   1. `maintenance_logs (boat_id, status, performed_at desc) where deleted_at is null`
--      Le journal filtre sur `status` (« Historique » = `done`, « Prévu » = les trois statuts
--      ouverts) puis trie par date : les trois colonnes dans l'ordre où la requête les demande.
--   2. `maintenance_logs (boat_id, needs_review) where deleted_at is null`
--      Le compteur « à vérifier » de la barre du journal et `review_pending_logs` du tableau de
--      bord : un `count` qui, sans index partiel, parcourt toutes les interventions du bateau.
--   3. `purchases (boat_id, purchased_at desc) where deleted_at is null`
--      L'écran Dépenses et la vue `expenses_by_category` qui l'alimente.
--   4. `purchases (boat_id, kind) where deleted_at is null`
--      Le filtre par type, et la bouteille de gaz, qui lit `kind = 'gas'` à chaque ouverture.
--   5. `checklist_completions (boat_id, checklist_item_id, completed_at desc)`
--      `checklist_item_status` cherche le dernier cochage de chaque point ; `0001` indexait
--      `(checklist_item_id, completed_at desc)` sans le bateau, et `(boat_id)` sans la date, si
--      bien qu'aucun des deux ne répondait à la question posée. Pas de `deleted_at` ici : un
--      cochage n'en a pas (il s'annule en supprimant la ligne, D13).
--
-- Aucune table, vue, colonne ni politique n'est touchée : **rien à faire côté RLS**. Un index
-- ne donne accès à rien — il ne change pas ce qu'une politique laisse voir, seulement le chemin
-- que Postgres prend pour le trouver. Les tests de `tests/unit/rls.test.ts` restent tels quels.

begin;

-- ---------------------------------------------------------------------------------------------
-- Interventions : les deux lectures que tout l'écran fait, et que la navigation refait.
create index if not exists maintenance_logs_boat_live_status_idx
  on public.maintenance_logs (boat_id, status, performed_at desc)
  where deleted_at is null;

create index if not exists maintenance_logs_boat_live_review_idx
  on public.maintenance_logs (boat_id, needs_review)
  where deleted_at is null;

-- ---------------------------------------------------------------------------------------------
-- Achats : la liste des dépenses, et le filtre par type (dont le gaz).
create index if not exists purchases_boat_live_purchased_idx
  on public.purchases (boat_id, purchased_at desc)
  where deleted_at is null;

create index if not exists purchases_boat_live_kind_idx
  on public.purchases (boat_id, kind)
  where deleted_at is null;

-- ---------------------------------------------------------------------------------------------
-- Cochages : le dernier de chaque point, sur un bateau — la question que pose
-- `checklist_item_status`, donc la checklist, le tableau de bord et les points rouges.
create index if not exists checklist_completions_boat_item_idx
  on public.checklist_completions (boat_id, checklist_item_id, completed_at desc);

commit;
