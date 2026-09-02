# Xaman — Backlog MVP

> Épics ordonnés, tickets prêts à être pris un par un par Claude Code. Chaque ticket a une définition de fini (DoD) ; la DoD générale est dans `CLAUDE.md`.
> Priorité : **M** (Must), **S** (Should), **C** (Could). Les tickets M sont dans l'ordre d'exécution recommandé.
> Estimations en « points » (1 = moins d'une demi-journée, 2 = une demi-journée à une journée, 3 = une à deux journées), indicatives.
> Routes : toutes les pages du bateau sont sous `/boats/[boatId]/…`.

Statut à tenir à jour dans ce fichier : `[ ]` à faire, `[~]` en cours, `[x]` fait.

---

## E0 — Socle technique

- [~] **E0-0 (M, 1)** Bootstrap infra via MCP (procédure détaillée dans `KICKOFF.md`) : dépôt git initialisé et poussé sur le remote GitHub existant (branche `main`), projet **Supabase** créé via le MCP (`create_project`, région UE, nom `xaman`, mot de passe base généré et stocké hors dépôt), projet **Vercel** créé via le MCP (`create_git_project` lié au dépôt, framework Next.js) avec les variables `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY` ; `SUPABASE_SERVICE_ROLE_KEY` uniquement côté serveur Vercel et `.env.local`. DoD : `git push` OK, URL Supabase et URL Vercel notées dans `docs/DECISIONS.md` (sans clés), premier déploiement (page « Xaman » vide) accessible en ligne.
- [x] **E0-1 (M, 2)** Initialiser le repo : Next.js (App Router, TS strict), pnpm, ESLint, Prettier, Tailwind, shadcn/ui, `next-intl` avec `src/messages/fr.json`, structure de dossiers de `SPEC.md §8.3`. `pnpm dev`, `pnpm lint`, `pnpm typecheck` passent.
- [x] **E0-2 (M, 2)** Supabase : projet créé en E0-0, Supabase CLI initialisé (`supabase init`, `supabase link --project-ref …`), `supabase start` local fonctionne, scripts `pnpm db:reset`, `pnpm db:migrate`, `pnpm db:types` (génère `src/types/database.ts`), variables d'environnement documentées dans `.env.example`. Clients `lib/supabase/{client,server,middleware}.ts` (`@supabase/ssr`).
- [x] **E0-3 (M, 3)** Migration `0001_init.sql` : extensions (`pg_trgm`), énumérations, **toutes** les tables (y compris templates, organisations, attachments), contraintes, index (dont trigram sur les interventions), triggers techniques (`set_updated_at`, `handle_new_user`) de `DATA-MODEL.md`. Ni RLS ni vues à ce stade. `supabase db reset` passe.
- [x] **E0-4 (M, 2)** Design system : tokens (dégradé d'en-tête, couleurs d'état de checklist et de statut d'intervention — les couleurs de catégories viennent de la base), typographie, composants de base shadcn adaptés au tactile (boutons ≥ 44 px, inputs 16 px), layout applicatif (sidebar iPad paysage / onglets bas iPhone et portrait), page `/dev/ui` (désactivée en prod) listant les composants. *Demander le prototype HTML de Xav avant de commencer.*
- [x] **E0-5 (M, 1)** CI GitHub Actions : `supabase start` (Docker), lint, typecheck, tests unitaires (dont RLS à venir), build. Vercel (créé en E0-0) : previews par PR, `main` → prod, variables d'environnement vérifiées ; déploiement des migrations en prod par `supabase db push` depuis la CI sur `main` (secret `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` dans GitHub).
- [x] **E0-6 (M, 1)** PWA de base : manifest (nom « Xaman », icônes 192/512 + `apple-touch-icon`, `display: standalone`, `theme_color: #0C1B33`), Serwist configuré avec precache de l'app shell. Installable sur iPad (vérifié manuellement).

## E1 — Authentification, bateau, membres

- [ ] **E1-1 (M, 2)** Connexion sans mot de passe : page `/login` (e-mail → écran « Saisissez le code reçu » avec champ 6 chiffres, `verifyOtp`), le même e-mail contient un lien magique de secours (`/auth/callback`), middleware protégeant `(app)/*`, déconnexion. Templates d'e-mail Supabase Auth en français (`{{ .Token }}` + lien). Session persistante en PWA standalone (vérifié sur iPad).
- [ ] **E1-2 (M, 3)** Migration `0002_rls.sql` : fonctions `is_platform_admin`, `is_boat_member`, `boat_role` (owner virtuel pour l'admin), `is_boat_owner`, `can_write_boat`, `can_contribute_boat`, `get_invitation_preview`, `accept_invitation` ; RLS activée + politiques sur **toutes** les tables selon `DATA-MODEL.md §5` (dont `with check (deleted_at is null)` pour les pro) ; `revoke select (token)` / `revoke update (is_platform_admin)` ; trigger `ensure_last_owner` (cascade-aware) ; policies Storage bucket `boat-files`.
- [ ] **E1-3 (M, 1)** Redirection après login : membre d'un seul bateau → son dashboard ; plusieurs → sélecteur (E10-2) ; aucun → page « Vous n'avez pas encore de bateau — demandez une invitation ». Layout `[boatId]` chargeant bateau + rôle (`useBoat()`, `can()`).
- [ ] **E1-4 (M, 2)** Membres : page `/boats/[boatId]/members` (owner) — liste des membres avec rôle, changement de rôle, retrait, message clair si dernier owner. Les editors voient la liste en lecture ; pro/viewer n'accèdent pas à la page (404).
- [ ] **E1-5 (M, 2)** Invitations : Server Action `inviteMember(boatId, email, role)` — insert dans `boat_invitations` avec le client utilisateur (RLS owner), puis lecture du token avec la clé service et envoi de l'e-mail (templates Supabase, ou Resend si trop limités — documenter le choix). Page `/invite/[token]` : aperçu via `get_invitation_preview` (bateau, inviteur, rôle, e-mail pré-rempli), connexion par code OTP si besoin, `accept_invitation(token)`, redirection dashboard. Liste des invitations en attente (`boat_invitations_safe`) + révocation dans la page Membres.
- [ ] **E1-6 (M, 3)** Tests RLS automatisés : `supabase/seed.sql` crée 5 utilisateurs (owner, editor, pro, viewer, étranger) et un bateau de test ; Vitest vérifie la matrice `SPEC.md §4.3` sur chaque table **et chaque vue** (select/insert/update/delete), plus : pro ne peut pas mettre à la corbeille, non-membre ne lit rien via les vues, `token` illisible pour l'owner. Exécutés en CI.
- [ ] **E1-7 (M, 1)** Profil : page `/settings/profile` (nom, langue) ; suppression de compte (Server Action : refusée si l'utilisateur est dernier owner d'un bateau, sinon supprime `auth.users` ; les données créées restent grâce aux FK `set null`) avec confirmation.

## E2 — Fiche bateau, moteurs, équipements, seed

- [ ] **E2-1 (M, 2)** Page `/boats/[boatId]/boat` : identité du bateau (lecture + édition inline owner/editor), notes. Photo du bateau reportée à E10-1 (pas de saisie d'URL en V1).
- [ ] **E2-2 (M, 2)** Moteurs : liste avec heures courantes (vue `engine_current_hours`), ajout/édition/désactivation d'un moteur, **saisie rapide d'un relevé** (dialogue : moteur, heures, date, note) avec avertissement si inférieur au dernier relevé, action « Générer les points de checklist de ce moteur » (`apply_checklist_template(boat, template, engine)`) pour un moteur ajouté après coup.
- [ ] **E2-3 (M, 2)** Équipements : liste groupée par catégorie (accordéon), fiche équipement (nom, marque, modèle, série, installation, `specs` clé/valeur éditables, notes), ajout/édition/suppression.
- [ ] **E2-4 (M, 1)** Catégories du bateau : gestion (renommer, couleur, ordre, désactiver / réactiver) dans la page Paramètres du bateau (E2-5). Les vues et filtres ignorent les catégories désactivées ; les données rattachées restent visibles avec un badge « catégorie archivée ».
- [ ] **E2-5 (M, 1)** Page `/boats/[boatId]/settings` : catégories (E2-4), export des données (bouton câblé en E9-2), **suppression du bateau** (owner, confirmation par saisie du nom, cascade).
- [ ] **E2-6 (M, 2)** Script `scripts/seed.ts` (`pnpm seed:xaman`) idempotent selon `DATA-MODEL.md §8`, lisant `seed/*.json` : modèle ORC 50, bateau Xaman, moteurs, `apply_checklist_template`, équipements, contacts, membres (création des comptes via l'API admin), historique (`pending_engine_hours` + `needs_review`) et achats. Rejouable sans doublon (test : deux exécutions = mêmes comptes de lignes). Sert de jeu de données pour tester E3 à E7 en local.

## E3 — Journal des interventions

- [ ] **E3-1 (M, 1)** Migration : vues `maintenance_logs_view` et `maintenance_logs_trash_view` (`security_invoker`), fonction `purge_trash`, trigger `sync_log_readings_date`.
- [ ] **E3-2 (M, 3)** Liste `/boats/[boatId]/logs` : cards (titre, badge catégorie coloré, badge statut, date, coût, prestataire, badge « À vérifier »), tri date desc, **filtres** catégorie + statut (multi-sélection, persistés dans l'URL), **recherche** texte (debounce, trigram), pagination infinie. État vide illustré.
- [ ] **E3-3 (M, 3)** Formulaire création/édition (`react-hook-form` + zod partagé avec la Server Action) : titre avec suggestions des titres existants, catégorie (obligatoire), statut, priorité, date, prochaine échéance, **un champ heures par moteur actif** pré-rempli avec les heures courantes, coût, prestataire (select annuaire + « Nous-mêmes »), notes. À l'enregistrement : upsert log + upsert `engine_hour_readings` sur `(maintenance_log_id, engine_id)` (source `maintenance_log`). Optimistic UI.
- [ ] **E3-4 (M, 2)** Détail `/logs/[logId]` : toutes les infos, heures moteur, pièces jointes (E10-1), achats liés, cochages de checklist liés, sortie de l'eau liée, boutons Modifier / Dupliquer (E10-3) / Mettre à la corbeille.
- [ ] **E3-5 (M, 1)** Corbeille commune `/boats/[boatId]/trash` (owner/editor) : interventions, achats et sorties de l'eau supprimés depuis moins de 30 jours, restauration ; purge automatique via `purge_trash` (`pg_cron` quotidien si disponible, sinon Server Action admin documentée).
- [ ] **E3-6 (M, 2)** Depuis une intervention terminée : « Cocher des points de checklist » → sélection multiple des points de la catégorie → crée les `checklist_completions` liées (`maintenance_log_id`, date et heures de l'intervention, sans relevé d'heures supplémentaire). *(S)* pré-cochage heuristique par mots-clés du titre (vidange, filtre, impeller, courroie…).
- [ ] **E3-7 (M, 1)** Lignes importées : badge « À vérifier », action « Marquer comme vérifié » (owner/editor) affichant les `pending_engine_hours` par moteur, modifiables, puis `mark_log_reviewed(log, override)` qui crée les relevés.

## E4 — Checklist d'entretien

- [ ] **E4-1 (M, 2)** Migration : fonction `apply_checklist_template` (idempotente, `p_engine_id`), triggers `check_completion_hours` et `sync_engine_hours_from_completion`, vues `checklist_item_status` et `checklist_category_progress` (`security_invoker`, `make_interval`, `nullif`). Tests SQL (pgTAP ou Vitest) sur la vue avec le jeu de cas `tests/fixtures/checklist-status-cases.json` (jamais fait / mois seul / heures seul / les deux / compteur inconnu / sans intervalle / fins de mois).
- [ ] **E4-2 (M, 2)** `src/lib/checklist-status.ts` : même logique en TS (`date-fns/addMonths`) + test de parité avec la vue sur le même jeu de cas.
- [ ] **E4-3 (M, 3)** Écran catégories `/boats/[boatId]/checklist` : grille des catégories actives (couleur, icône, barre de progression ou « — », compteur retard), tri par retard desc puis ordre.
- [ ] **E4-4 (M, 3)** Écran points `/checklist/[categoryId]` : liste triée (en retard → bientôt → à faire → ok), chaque ligne : libellé, intervalle, dernière réalisation (date, qui), état coloré, bouton **Fait**. Tap sur la ligne → détail déroulé : description, **actions détaillées** (étapes), historique des réalisations. Filtre « À traiter » (= tout sauf OK). Mention « compteur inconnu » si le moteur lié n'a aucun relevé.
- [ ] **E4-5 (M, 2)** Dialogue « Fait » : date (défaut aujourd'hui), qui (membres + texte libre), heures moteur si `engine_id` (pré-remplies, **obligatoires** si intervalle en heures), note → `checklist_completions` (+ relevé d'heures par trigger). Optimistic UI, la barre de progression se met à jour.
- [ ] **E4-6 (M, 2)** Ajout / édition d'un point personnalisé dans la catégorie : libellé, description, intervalle mois et/ou heures (+ moteur obligatoire si heures), étapes détaillées (liste éditable), ordre. Désactivation d'un point (conserve l'historique) et réactivation depuis « points désactivés ».
- [ ] **E4-7 (M, 1)** Realtime : un canal par bateau sur les 8 tables de `DATA-MODEL.md §7`, invalidation des queries concernées. Test manuel à deux appareils.
- [ ] **E4-8 (C, 2)** Export PDF d'une catégorie (liste des points, états, dernières réalisations).

## E5 — Consommables, achats, stock, dépenses

- [ ] **E5-1 (M, 2)** Page `/boats/[boatId]/supplies` avec onglets **Achats / Gaz / Stock / Dépenses**.
- [ ] **E5-2 (M, 2)** Achats : liste (date, désignation, type, catégorie, montant, fournisseur, badge « À vérifier »), filtres type + catégorie + période, formulaire (tous les champs de `purchases`), lien optionnel vers une intervention, mise à la corbeille (E3-5).
- [ ] **E5-3 (M, 1)** Gaz : vue filtrée `kind = 'gas'` avec formulaire simplifié (date, type de bouteille, fournisseur, montant) et indicateurs « jours moyens entre deux bouteilles » (toutes bouteilles confondues) + date estimée du prochain changement.
- [ ] **E5-4 (M, 2)** Stock : liste des pièces avec quantité, seuil, badge alerte (`min_quantity > 0 and quantity <= min_quantity`), boutons + / − (Server Action atomique), formulaire pièce, filtre « sous le seuil ». Lien « Acheter » qui pré-remplit un achat `kind = 'part'` lié à la pièce *(S : incrémente la quantité à l'enregistrement)*.
- [ ] **E5-5 (M, 2)** Dépenses : vue `expenses_by_category`, sélecteur de période (mois, année, personnalisée), tableau catégorie × (source, type d'achat) avec totaux, barres horizontales simples (pas de lib de charts), **export CSV** de la période.

## E6 — Sorties de l'eau et intervenants

- [ ] **E6-1 (M, 2)** Sorties de l'eau `/boats/[boatId]/haul-outs` : liste (dates, durée, chantier, coût), formulaire, détail avec interventions liées (`maintenance_logs.haul_out_id`, sélection depuis le détail), mise à la corbeille (E3-5). Dashboard : mois écoulés depuis la dernière sortie.
- [ ] **E6-2 (M, 2)** Intervenants `/boats/[boatId]/contacts` : liste groupée par spécialité, recherche, fiche avec `tel:` et `mailto:` cliquables, formulaire, suppression avec affichage du nombre de références (interventions, achats, sorties d'eau, pièces) avant confirmation (FK `set null`). Sélecteur d'intervenant réutilisable (composant) pour interventions, achats, sorties d'eau, pièces.

## E7 — Dashboard

- [ ] **E7-1 (M, 2)** Vue `boat_dashboard_stats` + page `/boats/[boatId]/dashboard` : en-tête dégradé avec 4 stats (retards, planifiées/urgentes, heures par moteur, dépenses de l'année), grille des catégories (réutilise E4-3), liste « À faire prochainement » (règle de tri `SPEC.md §M8` : urgentes → points en retard par retard décroissant → en cours et planifiées par date → bientôt par reste), 5 dernières interventions, boutons « + Intervention » et « + Relevé d'heures ».
- [ ] **E7-2 (M, 1)** Bannière d'installation PWA (iOS : instructions Partager → Sur l'écran d'accueil ; Android : `beforeinstallprompt`), masquable, mémorisée en `localStorage`.

## E8 — Finalisation du seed et mise en production

- [ ] **E8-1 (M, 1)** Compléter `seed/xaman-boat.json` (e-mails réels de Xavier / Emmanuel, modèles moteurs, contacts) et `seed/orc50-checklist.json` (liste complète de Xav en remplacement des `proposal`). *Dépend des réponses de Xav.*
- [ ] **E8-2 (M, 1)** Exécution du seed en production, vérification à trois sur iPad (critère `SPEC.md §11-1`), saisie par Xav des heures courantes des deux moteurs (E2-2) puis validation ligne par ligne des interventions importées (E3-7).

## E9 — PWA, hors-ligne lecture, export, QA

- [ ] **E9-1 (M, 2)** Cache de lecture : `persistQueryClient` (IndexedDB) pour les queries du bateau courant ; runtime caching Serwist des pages et assets ; bandeau « Hors ligne — consultation seule » (`navigator.onLine` + écouteurs) ; formulaires désactivés hors ligne avec message ; en cas d'échec d'envoi, le formulaire conserve les valeurs et propose « Réessayer ».
- [ ] **E9-2 (M, 2)** Export : Server Action `exportBoat(boatId)` (owner/editor) → JSON complet (toutes les tables du bateau) et zip de CSV (un par table) ; bouton dans Paramètres du bateau (E2-5).
- [ ] **E9-3 (M, 2)** Tests E2E Playwright (viewport iPad paysage + iPhone) sur les parcours `SPEC.md §6.1 à §6.4` contre Supabase local (`seed.sql` + `seed:xaman`).
- [ ] **E9-4 (M, 2)** Passe QA iPad Safari réelle : zoom involontaire, clavier masquant les champs, safe areas (`env(safe-area-inset-*)`), scroll dans les modales, tap targets, mode standalone (pas de barre d'URL → navigation retour interne obligatoire). Correctifs.
- [ ] **E9-5 (M, 1)** Page `/health`, capture d'erreurs front (Sentry ou équivalent, optionnel), README du repo (installation, seed, déploiement).

## E10 — Should (fin de V1)

- [ ] **E10-1 (S, 3)** Pièces jointes (S1) : bucket `boat-files`, composant upload (photo caméra iPad + fichier), miniatures, suppression, galerie dans le détail intervention / équipement / sortie d'eau / achat ; photo du bateau (`boats.photo_path`).
- [ ] **E10-2 (S, 1)** Sélecteur de bateau (S2) dans l'en-tête si plusieurs bateaux.
- [ ] **E10-3 (S, 1)** Dupliquer une intervention (S4).
- [ ] **E10-4 (S, 1)** Affichage « créé par / modifié par / le » dans les détails (S5).
- [ ] **E10-5 (S, 1)** Historique des relevés d'heures par moteur (S3) : liste datée avec source, depuis la fiche moteur.

## E11 — V1.1 / V2 (ne pas démarrer sans validation)

- [ ] **E11-1 (C)** Rappels : e-mail hebdomadaire (Supabase Edge Function + cron) listant retards et échéances à 30 jours ; push web sur PWA installée.
- [ ] **E11-2 (C)** Graphique des heures moteur.
- [ ] **E11-3 (C)** Onboarding public : création libre d'un bateau, choix du modèle de checklist, modèle générique voilier / moteur complet.
- [ ] **E11-4 (V2)** Offline-first : écritures hors ligne, file de synchronisation, résolution de conflits.
- [ ] **E11-5 (V2)** Organisations : UI flotte (loueur, club), rôle `renter` avec dates de validité, checklists départ/retour.
- [ ] **E11-6 (V2)** Modèles de checklist publiés par les constructeurs / chantiers ; versionnage et mise à jour des checklists instanciées.
- [ ] **E11-7 (V3)** Relevé d'heures automatique depuis les instruments (Victron / NMEA 2000 via passerelle).

---

## Jalons

| Jalon | Contenu | Critère |
|---|---|---|
| J1 — Squelette | E0, E1 | Les 3 utilisateurs se connectent et voient un bateau vide, RLS testée |
| J2 — Démo Xav | E2 (dont seed), E3, E4 | Journal + checklist utilisables sur iPad avec les données Xaman |
| J3 — MVP complet | E5, E6, E7, E8, E9 | Critères d'acceptation `SPEC.md §11` |
| J4 — Confort | E10 | Pièces jointes, sélecteur de bateau, historique des heures |
