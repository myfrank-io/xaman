-- 0028_inbox_realtime.sql — « À valider » se met à jour tout seul (E16, D96).
--
-- `0026` a créé `inbox_items` sans jamais l'ajouter à la publication `supabase_realtime`, alors
-- que la table est la seule de l'application dont les lignes changent **sans que personne ne
-- touche l'écran** : un document arrive par e-mail, la lecture le fait passer de `received` à
-- `analysing` puis à `ready`. L'écran compensait par un `router.refresh()` toutes les cinq
-- secondes — soit une douzaine de requêtes serveur par tick, indéfiniment si une lecture reste
-- coincée, et rien du tout sur le deuxième appareil.
--
-- La publication règle les deux : la carte se met à jour d'elle-même, et le compteur « À valider »
-- de la navigation, la bannière du tableau de bord et la liste bougent ensemble, y compris quand
-- c'est l'autre associé qui a validé. Les événements restent filtrés par la RLS (`inbox_items_select`
-- de `0026`, membres du bateau), et le pont client ne s'abonne qu'à son propre `boat_id`.
--
-- Aucune donnée, aucune politique : la table est déjà en RLS et ses politiques ne changent pas.

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'inbox_items'
  ) then
    execute 'alter publication supabase_realtime add table public.inbox_items';
  end if;
end;
$$;

commit;
