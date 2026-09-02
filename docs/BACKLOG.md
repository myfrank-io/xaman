# Xaman — Backlog MVP (v2, réordonné après l'audit du 2 septembre 2026)

> Épics regroupés en **lots** ordonnés (L0 → L8), tickets pris un par un dans l'ordre des lots. Chaque ticket a une définition de fini (DoD) ; la DoD générale est dans `CLAUDE.md`. Les décisions qui ont réordonné ce backlog sont dans `docs/AUDIT.md` (références D-xx).
> Priorité : **M** (Must), **S** (Should), **C** (Could). Estimations en points (1 = moins d'une demi-journée, 2 = une demi-journée à une journée, 3 = une à deux journées).
> Routes : toutes les pages du bateau sont sous `/boats/[boatId]/…`. Navigation V1 (D8) : 4 onglets **Tableau de bord · Checklist · Journal · Bateau**, feuille « Plus » (Dépenses, Intervenants, Corbeille), menu compte (Membres, Paramètres, Profil).

Statut à tenir à jour dans ce fichier : `[ ]` à faire, `[~]` en cours, `[x]` fait.

---

## L0 — Socle *(fait, sauf le projet Supabase)*

- [~] **E0-0 (M, 1)** Bootstrap infra via MCP (`KICKOFF.md`). Fait : dépôt poussé, projet Vercel `xaman` lié (prod = `main`, https://xaman-blue.vercel.app), previews par PR. **Reste** : projet Supabase (bloqué par la limite de 2 projets gratuits actifs de l'organisation — mettre un projet en pause ou passer en Pro), variables d'environnement Vercel, gabarits d'e-mail Auth en français, URL de redirection.
- [x] **E0-1 (M, 2)** Next.js 16 (App Router, TS strict), pnpm, ESLint, Prettier, Tailwind v4, shadcn/ui (composants écrits à la main), `next-intl` avec `src/messages/fr.json`.
- [x] **E0-2 (M, 2)** Supabase CLI (`config.toml`), clients `@supabase/ssr` (browser, server, admin, middleware), scripts `db:*`, `.env.example`. `supabase start` n'est pas vérifiable dans l'environnement de développement distant (Docker bloqué) : validation locale sur Postgres nu via `tests/support/supabase-shim.sql`, stack réelle en CI.
- [x] **E0-3 (M, 3)** Migration `0001_init.sql` : extensions, énumérations, 21 tables, contraintes, index, triggers techniques ; RLS activée dès le départ (refus total avant les politiques).
- [x] **E0-4 (M, 2)** Design system v1 : tokens, composants tactiles (≥ 44 px, 16 px), layout (sidebar / onglets), `/dev/ui`. **Remplacé par la DA de l'audit (E0-7).**
- [x] **E0-5 (M, 1)** CI GitHub Actions : lint, prettier, typecheck, `supabase db start` + `db reset`, Vitest, build ; `db push` en prod sur `main` quand les secrets existent.
- [x] **E0-6 (M, 1)** PWA : manifest, icônes, service worker Serwist (mode configurator, compatible Turbopack).
- [x] **E0-7 (M, 3)** **Direction artistique et navigation v2** (`AUDIT.md §4`, D8, D19) : tokens `design-tokens.css` (neutres 215°, sémantique `-fg`/`-tint`/`-border`/`-on-dark`, catégories harmonisées), logo « La Traverse » + icônes PWA, composants ajustés (badges pleins/teintés, boutons `xl` et `offline`, StatCard interactif, EmptyState ×3, ProgressBar « — », CategoryBadge icône/liseré), nouveaux composants (`NumericField`, `DateField`, `CategoryChips`, `ListRow`, `SectionCard`, `DueLabel`, `ConfirmDialog`, `UndoToast`, `OfflineBanner`), primitives `alert-dialog` / `accordion` / `toggle-group` / `avatar`, navigation 4 onglets + « Plus » + menu compte, `PrimaryActionSheet` contextuel, `TopBar` avec retour logique, `/dev/ui` et `/dev/ui/dashboard` (recette visuelle).

## L1 — Accès *(code fait, vérification de bout en bout dès que Supabase existe)*

- [~] **E1-1 (M, 2)** Connexion sans mot de passe : `/login` (e-mail → code 6 chiffres), lien magique de secours `/auth/callback`, `src/proxy.ts`, déconnexion. Fait ; **à vérifier sur iPad en PWA standalone** dès que le projet Supabase existe (gabarits FR, `shouldCreateUser: false` sur `/login`).
- [x] **E1-2 (M, 3)** Migration `0002_rls.sql` : fonctions, politiques sur toutes les tables, privilèges de colonnes (token, `is_platform_admin`, e-mail), `ensure_last_owner`, invitations, bucket `boat-files`.
- [~] **E1-3 (M, 1)** Redirection après login (`/boats` : 1 bateau → dashboard, plusieurs → liste, aucun → attente), layout `[boatId]` (`useBoat()`, `can()`). Fait ; à vérifier avec une session réelle.
- [x] **E1-6 (M, 3)** Tests RLS automatisés (`supabase/seed.sql` : 6 utilisateurs, 2 bateaux ; `tests/unit/rls.test.ts` : matrice complète, isolation, token, dernier owner, pro sans corbeille, fonctions d'invitation, Storage). Étendus par `0004` (E2-7).
- [~] **E1-4 (M, 2)** Membres : liste, changement de rôle, retrait, dernier owner (fait). **Reste** (D29, §4.23) : membres expirés grisés + « Réactiver 90 j », lien « Transférer le bateau » dans le refus dernier owner.
- [~] **E1-5 (M, 2)** Invitations : Server Action + e-mail Supabase, `/invite/[token]`, révocation (fait). **Reste** (D28, D29) : durée d'accès (`valid_until`) pour pro/viewer, invitation par un editor (pro/viewer datés), « Copier le lien » / `navigator.share()`, adresse masquée sur la page publique.
- [~] **E1-7 (M, 1)** Profil et suppression de compte (fait). **Reste** (D31) : figer `completed_by_name` avant suppression, retirer le champ langue de l'UI, proposer « Transférer » / « Supprimer le bateau » quand le compte est dernier owner.

## L2 — Le bateau existe

- [x] **E2-7 (M, 1)** Migration `0004_tracking.sql` (D1, D4, D5, D6, D11, D12, D14, D15, D17, D28) : `anchor_date` / `anchor_hours`, `checklist_completions.next_due_at`, `engines.counter_reset_at`, `maintenance_logs.equipment_id`, suppression de `priority` et `next_due_at`, `boat_invitations.valid_until` + politique editor, suppression d'une réalisation (pro < 24 h) + cascade du relevé, garde de suppression des moteurs, corbeille ↔ relevés, vue de statut ancrée, progression sur points à intervalle, fonction de file d'attente `boat_todo_queue`, stats 12 mois, couleurs harmonisées, dates futures refusées ; fixture étendue (cas 8–20), parité TS, tests RLS étendus.
- [x] **E2-1 (M, 2)** Page `/boat` onglet Identité : lecture + édition inline owner/editor, notes ; longueur / largeur / tirant d'eau / n° de voile repliés dans « Caractéristiques ».
- [x] **E2-2 (M, 3)** Onglet Moteurs : puces de compteur, fiche moteur (`/boat/engines/[engineId]`), **dialogue de relevé** (moteur pré-sélectionné, aide « dernier relevé », avertissement si inférieur avec case « le compteur a été remplacé » → `counter_reset_at`, refus des dates futures), **historique des relevés éditable et supprimable** (D16, ex-E10-5), points de checklist liés, interventions du moteur, « Générer les points de ce moteur » (seulement s'il n'en a aucun), désactivation avec avertissement « N points de suivi seront retirés » (D14).
- [x] **E2-3 (M, 2)** Onglet Équipements : accordéon par catégorie, fiche (`specs` clé/valeur, notes), ajout / édition ; « déposé le … » au lieu de suppression ; bloc « Historique » (interventions `equipment_id`).
- [x] **E2-4 (M, 1)** Catégories (dans Paramètres) : renommer, couleur (nuancier des 8 valeurs harmonisées + avertissement < 3:1), ordre, archiver avec dialogue d'impact (« archiver aussi les N points » / « les déplacer vers … », §4.6), réactiver.
- [x] **E2-5 (M, 1)** Paramètres du bateau : catégories, export (E9-2), rapport (E9-2b), « Recaler ma checklist » (E4-9), « Reprise du carnet » (E3-7), transfert (E1-8), suppression du bateau (saisie du nom).
- [x] **E2-6 (M, 2)** Script `pnpm seed:xaman` idempotent + test (deux exécutions = mêmes comptes). Ancrage renseigné à l'instanciation par `0004`.

## L3 — Le suivi vit ⭐

- [x] **E4-1 (M, 2)** Vue `checklist_item_status` ancrée (D1, D11, D12, D13, D14) et `checklist_category_progress` (dénominateur = points à intervalle), triggers `security definer`, fonction pure `checklist_compute_status` — livré par `0004`.
- [x] **E4-2 (M, 2)** Miroir TS `src/lib/checklist-status.ts` + parité sur le jeu de cas étendu — livré par `0004`.
- [x] **E4-9 (M, 2)** **Assistant de mise en route** (D2) : compteurs des moteurs → tri des points proposés par catégorie (tout coché, un tap pour retirer) → calage grossier (Jamais · < 6 mois · ~1 an · > 2 ans, « tout à ~1 an » par catégorie) écrit `anchor_date` marqué « estimé » ; proposé au premier lancement, reprenable depuis Paramètres.
- [x] **E4-3 (M, 3)** `/checklist` : grille des 8 catégories à ordre fixe (icône, couleur, progression, « N en retard », « jamais fait » / « à jour ») + onglet **« À traiter »** à plat trié par urgence (Tout · En retard · Bientôt · Jamais fait), « N jamais renseignés » en information secondaire (D21).
- [x] **E4-4 (M, 3)** `/checklist/[categoryId]` : lignes 64 px triées (en retard → bientôt → à faire → OK), contrainte déclenchante affichée (« dans 12 j » **ou** « dans 40 h »), « compteur inconnu », bouton « Fait » 88 × 44 px à abscisse fixe, accordéon exclusif en place (description, **étapes cochables en `sessionStorage`** D22, historique, Modifier / Désactiver), groupe « Contrôles ponctuels » en bas (D13), « points désactivés » en pied.
- [x] **E4-5 (M, 2)** Dialogue « Fait » : date (puces + roulette, pas de futur), réalisé par (moi · membre · intervenant · texte libre), heures moteur obligatoires si intervalle en heures (aide « dernier relevé » + « = reprendre »), **« Valide jusqu'au »** pour les points à date fixe (D11), note, « + Ajouter les détails » (coût, prestataire, photo → crée l'intervention liée, D3), avertissement « déjà coché aujourd'hui », optimistic UI (ligne, barre, compteurs), toast 8 s avec **Annuler** (D15). **« + Ajouter les détails » livré avec E3-3** (lien vers le formulaire d'intervention pré-rempli, point pré-coché).
- [x] **E4-10 (M, 1)** Annulation / suppression d'une réalisation depuis l'historique (owner/editor ; auteur pro < 24 h), relevé dérivé supprimé avec (D15).
- [x] **E4-6 (M, 2)** Point personnalisé : libellé, catégorie (verrouillée, « changer »), puces d'intervalle (3 / 6 / 12 / 24 / 36 mois / Autre / Aucun), heures + moteur obligatoire, description, étapes (liste éditable ▲▼), « dernière réalisation connue » (= `anchor_date`) ; désactivation avec confirmation, réactivation.
- [x] **E4-11 (M, 1)** Points à date fixe dans le seed (radeau, EPIRB, fusées, extincteurs, gilets, trousse, assurance, dossier de sécurité) et libellés « Valide jusqu'au » ; point « Carénage / sortie de l'eau » (18 mois) dans Coque & Pont (D9).

## L4 — Le premier écran ⭐

- [ ] **E7-1 (M, 3)** `/dashboard` (D20) : en-tête sombre (nom, modèle, phrase d'état, 4 vignettes tappables, bande des moteurs tappables avec date du relevé / « à mettre à jour » > 60 j / « compteur inconnu »), un seul bandeau contextuel (hors ligne › échec d'envoi › lignes à vérifier › compteurs jamais saisis › installer), « À faire prochainement » via `boat_todo_queue` (6 / 5 / 4 lignes, `[ Fait ]` en ligne, `never` exclus), état « carnet neuf » (3 étapes) et « tout est à jour » (sans bouton), grille des 8 systèmes (ordre fixe), 5 dernières interventions, récapitulatif (dépenses 12 mois par catégorie, dernière sortie de l'eau, stock sous seuil), skeletons aux dimensions exactes, erreur par bloc.
- [~] **E4-7 (M, 1)** Realtime : publication sur les 8 tables (fait, `0003`) + pont client par bateau (fait) ; **reste** : table de correspondance table → queries (vues comprises), reprise après coupure = invalidation complète, halo sur ligne modifiée, « 1 nouvelle intervention · Afficher » sur liste défilée (§5.7).
- [ ] **E7-2 (M, 1)** Bannière d'installation PWA (iOS : Partager → Sur l'écran d'accueil ; Android : `beforeinstallprompt`), à partir de la 2ᵉ session, masquable 30 jours.

## L5 — Le récit

- [ ] **E6-2 (M, 2)** Intervenants (`/contacts`, « Plus ») : liste groupée par spécialité (liste fermée + Autre), recherche, fiche (`tel:`, `mailto:`), formulaire, **`ContactPicker`** réutilisable (Nous-mêmes / prestataire + `NativeSelect` groupé + création inline, D32), bloc « interventions et dépenses chez cet intervenant », suppression avec nombre de références.
- [x] **E3-1 (M, 1)** Vues `maintenance_logs_view` / `maintenance_logs_trash_view`, `purge_trash`, `sync_log_readings_date` (`0003`) ; corbeille ↔ relevés par trigger (`0004`, D5).
- [ ] **E3-3 (M, 3)** **Formulaire de saisie unique** `/logs/new` et `/logs/[logId]/edit` (D3, D7, D26) : titre + suggestions (titres existants avec catégorie et moteur, 2 caractères, 5 max, jamais `<datalist>`), chips de catégorie, statut segmenté + bascule Urgent (défaut Terminé), date (puces + roulette ; futur seulement si planifiée), heures par moteur (dépliées si catégorie Moteurs ou point moteur coché ; vides + « dernier relevé » + « = reprendre » ; jamais pré-remplies), coût, réalisé par (`ContactPicker`), notes, équipement (replié), photos (E10-1), **points de checklist concernés** (pré-cochés par similarité trigram > 0,5, grisés si heures manquantes pour un point à intervalle en heures) ; upsert idempotent (UUID à l'ouverture, D18), brouillon `sessionStorage`, barre collante au-dessus du clavier, garde « abandonner ? », toast factuel. Inclut l'entrée « + Ajouter les détails » du dialogue « Fait » (`/logs/new?item=` : titre pré-rempli, point pré-coché, heures reprises).
- [ ] **E3-3b (M, 1)** Suggestion trigram côté serveur (`similarity(label, titre)` dans la catégorie, 5 max) — remplace l'heuristique par mots-clés.
- [ ] **E3-4 (M, 2)** Détail `/logs/[logId]` : toutes les infos, heures moteur, cochages liés, achats liés (« resteront dans les dépenses »), sortie de l'eau liée, équipement, « **Refaire** » (ex-E10-3, remonté en Must), « **En faire un entretien récurrent** » (crée un point avec intervalle déduit), Modifier, Mettre à la corbeille (relevés déplacés, toast Annuler), créé par / modifié par en pied (E10-4).
- [ ] **E3-2 (M, 3)** Liste `/logs` : onglets **Historique** (`done`, date desc) / **Prévu** (non terminées) / **Sorties de l'eau** (D9), recherche trigram, filtres catégorie + statut + « À vérifier N » persistés dans l'URL, lignes 76 px avec liseré de catégorie et heures relevées à droite, « charger plus » (pas d'infini), état vide initial / filtré, « 1 nouvelle intervention · Afficher » en temps réel.
- [ ] **E3-5 (M, 1)** Corbeille `/trash` (owner/editor) : interventions, achats, sorties de l'eau < 30 j, restauration, « supprimé définitivement dans N jours », purge quotidienne (`pg_cron` si disponible).
- [ ] **E3-7 (M, 2)** **Reprise du carnet** (D24) : tableau des lignes importées (7 interventions × SB/BB, 3 achats), valeurs éditables, ⚠ sur les valeurs non monotones, « Intervertir SB ↔ BB », « ignorer les heures », correction de date, validation en une fois (`mark_log_reviewed` + achats), accessible depuis Paramètres et depuis le bandeau du tableau de bord.

## L6 — L'argent

- [ ] **E5-1 (M, 1)** Page `/supplies` renommée **Dépenses** (« Plus ») : onglets Dépenses (défaut) · Achats · Stock ; le gaz est un filtre + raccourci de saisie.
- [ ] **E5-5 (M, 2)** Onglet Dépenses : période (12 mois glissants par défaut · année · personnalisée), liste des catégories avec barre et montant (décroissant), filtre de source (interventions / achats / sorties d'eau), comparaison N-1, cumul depuis l'origine, export CSV ; **pas de tableau croisé**.
- [ ] **E5-2 (M, 2)** Achats : liste (date, désignation, type, catégorie, montant, fournisseur, « À vérifier »), filtres type + catégorie + période, formulaire allégé (sans quantité ni devise ; 4 types visibles : Gaz / Pièce / Prestation / Autre), lien optionnel vers une intervention, « Marquer comme vérifié », corbeille.
- [ ] **E5-3 (M, 1)** Gaz : filtre `kind = 'gas'`, dialogue « Bouteille de gaz » (type = dernier utilisé, fournisseur, montant, date), faits « dernière bouteille il y a N j · intervalle moyen sur N intervalles valides », estimation « estimé » seulement à partir de 3 intervalles.
- [ ] **E6-1 (M, 1)** Sorties de l'eau : onglet du Journal, formulaire (sortie / remise à l'eau en deux champs, chantier via `ContactPicker`, travaux, coût), détail avec interventions liées, corbeille.

## L7 — La preuve et la robustesse

- [ ] **E9-2 (M, 1)** Export : Server Action `exportBoat` → JSON complet + `interventions.csv` + `depenses.csv` (pas de zip), bouton dans Paramètres.
- [ ] **E9-2b (M, 2)** **Rapport d'état** `/boats/[boatId]/report` : une page serveur imprimable (`@media print`, PDF via Partager → Imprimer) : identité, moteurs et heures, état des 8 systèmes, échéances des 12 mois, 12 derniers mois d'interventions (réalisé par), sorties de l'eau, coûts avec bascule « inclure les coûts », pied « Carnet tenu dans Xaman · N interventions · N réalisations ».
- [ ] **E9-1 (M, 2)** Hors ligne : `OfflineBanner` (`navigator.onLine` + échecs consécutifs), âge des données, boutons en style hors ligne (`aria-disabled` + toast), **brouillons locaux** (créations seulement, renvoi manuel, 20 max, D25), runtime caching Serwist des pages du bateau.
- [ ] **E1-8 (M, 1)** Transfert du bateau (D30).
- [ ] **E9-6 (M, 2)** **E-mail hebdomadaire** (ex-E11-1, remonté en V1) : Edge Function + cron, vendredi matin, owner/editor, retards + bientôt + planifiées / urgentes ; pas de push, pas de notification par point.
- [ ] **E9-3 (M, 2)** Tests E2E Playwright (iPad paysage + iPhone) sur les parcours `SPEC.md §6.1 à §6.4` + **budget d'interaction chronométré** (vidange ≤ 7 taps, cochage ≤ 3 taps, relevé ≤ 3 taps) + parcours « premier lancement » (assistant).
- [ ] **E9-4 (M, 2)** QA iPad Safari réelle : zoom, clavier, safe areas, scroll des dialogues, cibles, mode standalone, plein soleil réel, gants / doigts mouillés, reconnexion Realtime après veille.
- [~] **E9-5 (M, 1)** `/health` (fait), capture d'erreurs front (optionnel), README (installation, seed, déploiement, requête d'activation).
- [ ] **E1-6b (M, 1)** Tests RLS des vues et fonctions secondaires (rapport, export, `boat_todo_queue`) — partie livrée par `0004`.

## L8 — Confort

- [ ] **E10-1 (S, 2)** Pièces jointes réduites : photo(s) sur intervention (caméra iPad) + facture sur achat ; galerie équipement et photo du bateau en V1.1.
- [ ] **E10-4 (S, 1)** « créé par / modifié par / le » en pied des détails.
- [ ] **E5-4 (S, 1)** Stock déclaratif (D10) : liste plate (nom, quantité, seuil, emplacement), +/− atomiques, filtre « sous le seuil », « vérifié il y a N mois ».
- [ ] **E8-1 (M, 1)** Compléter `seed/xaman-boat.json` (e-mails réels, modèles de moteurs, contacts). La liste des 80+ points **ne bloque plus** : Xav trie dans l'assistant (E4-9).
- [ ] **E8-2 (M, 1)** Mise en production : seed, connexion des 3 comptes, assistant de mise en route, reprise du carnet, **première saisie réelle par Xav chronométrée (< 45 s)**, vérification à trois sur iPad.

## Retirés ou reportés (voir `AUDIT.md §3.4`)

- E4-8 export PDF de catégorie → remplacé par E9-2b · E10-2 sélecteur de bateau → reporté (un seul bateau) · E10-3 → fusionné dans E3-4 · E10-5 → fusionné dans E2-2 · E3-6 → fusionné dans E3-3 / E3-3b.
- **E11 — V1.1 / V2 (ne pas démarrer sans validation)** : E11-2 graphique des heures · E11-3 onboarding public (derrière une bibliothèque de modèles) · E11-4 offline-first · E11-5 organisations / `renter` · E11-6 modèles publiés par les constructeurs et versionnage · E11-7 relevés automatiques (Victron / NMEA) · lien de partage lecture seule du rapport · import assisté du carnet papier (photo → saisie guidée) · historique par équipement enrichi.

---

## Jalons révisés

| Jalon | Contenu | Critère de passage |
|---|---|---|
| J1 — Verrouillé | L0 + L1 | Les 3 comptes se connectent (OTP en PWA sur iPad) ; les tests RLS passent en CI |
| **J2 — Ça suit** ⭐ | L2 + L3 + L4 | Sur un iPad : l'assistant est passé, la file d'attente est juste, cocher un point la met à jour en < 1 s, un 2ᵉ appareil le voit sans recharger. **Démo à Xav** |
| J3 — Le carnet est remplacé | L5 + L6 | Vidange saisie en < 45 s, carnet papier repris, dépenses lisibles |
| J4 — MVP complet | L7 | Rapport d'état, export, hors ligne, e-mail hebdomadaire, E2E et QA iPad — critères `SPEC.md §11` |
| J5 — Confort | L8 | Photos, stock, mise en production complète |
