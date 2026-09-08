-- 0027_inbox_reopen_delete.sql — rouvrir un document ignoré, ou le supprimer (D93).
--
-- « Je veux pouvoir réouvrir ou supprimer les ignorés. » L'écran « À valider » laissait « Ignorer »
-- sans retour : la carte descendait dans « Déjà traités » et n'avait plus un seul bouton. Deux
-- gestes manquaient — l'un parce qu'un tap se trompe de carte, l'autre parce qu'une publicité en
-- pièce jointe n'a rien à faire dans un carnet d'entretien, même en bas de page.
--
-- Réouvrir ne demande rien à la base : c'est le `status` qui revient à `ready`, et la politique
-- `inbox_items_update` de `0026` (owner / editor) le couvre déjà. Supprimer, si : `0026` disait
-- « aucune politique delete » et la ligne était donc indestructible.
--
-- La politique ajoutée ici est **la plus étroite qui réponde à la demande** : owner ou editor, et
-- seulement sur une ligne `dismissed`. Rien d'autre ne peut être détruit par ce chemin —
--   · une ligne qui attend une décision doit d'abord être ignorée (deux gestes, jamais un seul) ;
--   · une ligne validée est devenue une intervention ou un achat, et son objet dans le bucket est
--     la pièce jointe de cette ligne : la détruire arracherait une facture du carnet.
-- Ce que la corbeille garde 30 jours (règle 9), ce sont les faits du carnet ; un document ignoré
-- n'en est jamais devenu un, il n'y a rien à restaurer — d'où une suppression franche, derrière
-- une confirmation qui nomme le fichier, et « Réouvrir » comme sortie non destructrice.

drop policy if exists "inbox_items_delete" on public.inbox_items;
create policy "inbox_items_delete" on public.inbox_items for delete to authenticated
  using (public.can_write_boat(boat_id) and status = 'dismissed');

grant delete on public.inbox_items to authenticated;

comment on table public.inbox_items is
  'Documents received by mail or photographed in the app, with the intervention or purchase the analysis proposes (D91). A row is a proposal until an owner or editor validates it; a dismissed one can be reopened or deleted (D93).';
