# Xaman — Backlog MVP (v2, réordonné après l'audit du 2 septembre 2026)

> Épics regroupés en **lots** ordonnés (L0 → L8), tickets pris un par un dans l'ordre des lots. Chaque ticket a une définition de fini (DoD) ; la DoD générale est dans `CLAUDE.md`. Les décisions qui ont réordonné ce backlog sont dans `docs/AUDIT.md` (références D-xx).
> Priorité : **M** (Must), **S** (Should), **C** (Could). Estimations en points (1 = moins d'une demi-journée, 2 = une demi-journée à une journée, 3 = une à deux journées).
> Routes : toutes les pages du bateau sont sous `/boats/[boatId]/…`. Navigation V1 (D8) : 4 onglets **Tableau de bord · Checklist · Journal · Bateau**, feuille « Plus » (Dépenses, Intervenants, Corbeille), menu compte (Membres, Paramètres, Profil).

Statut à tenir à jour dans ce fichier : `[ ]` à faire, `[~]` en cours, `[x]` fait.

**Prochain numéro, par épique.** Le prendre ici, puis incrémenter sa ligne **dans le même commit**.
Une ligne par épique : deux branches qui ajoutent un ticket à la **même** épique écrivent toutes
les deux sur la même ligne, donc la seconde fusion s'arrête sur un conflit git — pendant qu'un
numéro se change encore d'un `sed`. Deux branches qui travaillent des épiques différentes ne se
gênent pas. `tests/unit/numbering.test.ts` refuse un numéro déjà pris et une ligne oubliée (D87).

| Épique | Prochain |
|---|---|
| E0 | E0-9 |
| E1 | E1-9 |
| E2 | E2-11 |
| E3 | E3-9 |
| E4 | E4-12 |
| E5 | E5-6 |
| E6 | E6-3 |
| E7 | E7-3 |
| E8 | E8-3 |
| E9 | E9-7 |
| E10 | E10-5 |
| E12 | E12-9 |
| E13 | E13-18 |
| E14 | E14-8 |
| E15 | E15-14 |
| E16 | E16-10 |
| E17 | E17-13 |
| E18 | E18-15 |
| E19 | E19-10 |
| E20 | E20-4 |

---

## L0 — Socle *(fait, sauf le projet Supabase)*

- [~] **E0-0 (M, 1)** Bootstrap infra via MCP (`KICKOFF.md`). **Fait** : dépôt poussé, projet Vercel `xaman` lié (prod = `main`, https://xaman-blue.vercel.app) avec previews par PR, projet Supabase `xaman` créé en `eu-west-3` (la limite de deux projets gratuits est levée), variables d'environnement Vercel posées (la production sert et lit la base), migrations `0001` à `0012` appliquées. **Reste, côté tableau de bord Supabase et non depuis le code** : gabarits d'e-mail Auth en français et liste des URL de redirection.
- [x] **E0-1 (M, 2)** Next.js 16 (App Router, TS strict), pnpm, ESLint, Prettier, Tailwind v4, shadcn/ui (composants écrits à la main), `next-intl` avec `src/messages/fr.json`.
- [x] **E0-2 (M, 2)** Supabase CLI (`config.toml`), clients `@supabase/ssr` (browser, server, admin, middleware), scripts `db:*`, `.env.example`. `supabase start` n'est pas vérifiable dans l'environnement de développement distant (Docker bloqué) : validation locale sur Postgres nu via `tests/support/supabase-shim.sql`, stack réelle en CI.
- [x] **E0-3 (M, 3)** Migration `0001_init.sql` : extensions, énumérations, 21 tables, contraintes, index, triggers techniques ; RLS activée dès le départ (refus total avant les politiques).
- [x] **E0-4 (M, 2)** Design system v1 : tokens, composants tactiles (≥ 44 px, 16 px), layout (sidebar / onglets), `/dev/ui`. **Remplacé par la DA de l'audit (E0-7).**
- [x] **E0-5 (M, 1)** CI GitHub Actions : deux jobs parallèles, `checks` (lint, prettier, typecheck, `supabase db start` + `db reset`, Vitest, build) et `e2e` (audit tactile Playwright). La CI ne déploie pas : le job `migrate-production` a été retiré (D70) — il n'avait jamais exécuté une seule étape réelle, faute de secrets, sur 109 exécutions.
- [x] **E0-6 (M, 1)** PWA : manifest, icônes, service worker Serwist (mode configurator, compatible Turbopack).
- [x] **E0-7 (M, 3)** **Direction artistique et navigation v2** (`AUDIT.md §4`, D8, D19) : tokens `design-tokens.css` (neutres 215°, sémantique `-fg`/`-tint`/`-border`/`-on-dark`, catégories harmonisées), logo « La Traverse » + icônes PWA, composants ajustés (badges pleins/teintés, boutons `xl` et `offline`, StatCard interactif, EmptyState ×3, ProgressBar « — », CategoryBadge icône/liseré), nouveaux composants (`NumericField`, `DateField`, `CategoryChips`, `ListRow`, `SectionCard`, `DueLabel`, `ConfirmDialog`, `UndoToast`, `OfflineBanner`), primitives `alert-dialog` / `accordion` / `toggle-group` / `avatar`, navigation 4 onglets + « Plus » + menu compte, `PrimaryActionSheet` contextuel, `TopBar` avec retour logique, `/dev/ui` et `/dev/ui/dashboard` (recette visuelle).

- [ ] **E0-8 (S, 2)** **Renuméroter une décision en une commande, et l'apprendre avant la CI.** Le compteur de `DECISIONS.md` fait son travail : deux branches qui prennent le même numéro écrivent toutes deux la même ligne, la seconde fusion s'arrête, et `check-numbering.mjs` refuse un doublon — **aucun n'a jamais atteint `main`**. Ce qui coûte, c'est la réparation. Soirée du 8 septembre, quatre PR (#63 à #66) : D95 pris deux fois, D109 pris deux fois, **trois renumérotations à la main**. Pour la seule D109, le numéro apparaît à **26 endroits dans 15 fichiers** — l'entrée de `DECISIONS.md`, la ligne de `BACKLOG.md`, et 24 citations en commentaire réparties dans les composants, les schémas, les actions, les routes et les tests. Pire : deux de ces citations sont dans `src/i18n/slices.ts`, un fichier écrit par **une autre branche** (#65), donc renuméroter n'est plus confiné à ce qu'on a soi-même écrit. **À faire.** (1) `pnpm renumber:decision <de> <vers>` : déplace le titre de `DECISIONS.md`, la mention du ticket dans `BACKLOG.md` et chaque citation `D<n>` des fichiers suivis, en réutilisant le `MENTION` de `check-numbering.mjs` (même garde sur les littéraux : `model: "D100"` est un modèle de bateau, pas une décision) ; idempotent, refuse une cible déjà définie, et affiche le diff avant d'écrire. (2) Le rapport de `check-numbering.mjs` gagne les autres branches que la CI voit déjà (`git for-each-ref refs/remotes/origin`, `fetch-depth: 0` dans le job) : « D109 est aussi défini sur `origin/claude/i18n-…` — `pnpm renumber:decision 109 113` ». La CI de la PR le dit alors avant le merge, au lieu du conflit sec sur la ligne de compteur. **Ce qui n'est pas retenu.** Réserver le numéro à la création de la branche : sans état partagé, deux sessions qui coupent leur branche la même minute lisent le même compteur — la piste ne tient pas, elle déplace la course sans la supprimer. Remplacer la suite par un identifiant sans collision (date + slug, ou empreinte) : cela résout le problème pour de bon mais coûte la brièveté qui fait la valeur de `// D91` dans un commentaire, et la migration des **1 215 citations** que porte le dépôt, dont 733 hors de `docs/`. **DoD** : les deux points ci-dessus, un test unitaire par règle du script (déplacement, idempotence, refus d'une cible occupée, littéral épargné), `pnpm check:numbering` vert, et le mode d'emploi en tête de `DECISIONS.md` à côté de la ligne de compteur. **Ce ticket ne prend volontairement aucun numéro de décision** : il n'arbitre rien encore, et c'eût été une cinquième collision. Signalé à l'usage, après la troisième renumérotation de la soirée.

## L1 — Accès *(code fait, vérification de bout en bout dès que Supabase existe)*

- [~] **E1-1 (M, 2)** Connexion : mot de passe (mode principal, D26) ou code à 6 chiffres, lien magique de secours `/auth/callback`, `src/proxy.ts`, déconnexion. **Vérifié en production** : deux comptes réels se sont connectés, l'un par mot de passe, l'autre par code. **Reste** : le passage sur iPad en PWA standalone, qui relève de la QA appareil (E9-4).
- [x] **E1-2 (M, 3)** Migration `0002_rls.sql` : fonctions, politiques sur toutes les tables, privilèges de colonnes (token, `is_platform_admin`, e-mail), `ensure_last_owner`, invitations, bucket `boat-files`.
- [x] **E1-3 (M, 1)** Redirection après login (`/boats` : 1 bateau → dashboard, plusieurs → liste, aucun → attente), layout `[boatId]` (`useBoat()`, `can()`). **Vérifié avec des sessions réelles** en production.
- [x] **E1-6 (M, 3)** Tests RLS automatisés (`supabase/seed.sql` : 6 utilisateurs, 2 bateaux ; `tests/unit/rls.test.ts` : matrice complète, isolation, token, dernier owner, pro sans corbeille, fonctions d'invitation, Storage). Étendus par `0004` (E2-7).
- [x] **E1-4 (M, 2)** Membres : liste, changement de rôle, retrait, dernier owner (fait). **Reste** (D29, §4.23) : membres expirés grisés + « Réactiver 90 j », lien « Transférer le bateau » dans le refus dernier owner. **Livré** : membres expirés grisés + « Réactiver 90 j », bandeau « Transférer le bateau » sur refus dernier owner.
- [x] **E1-5 (M, 2)** Invitations : Server Action + e-mail Supabase, `/invite/[token]`, révocation (fait). **Reste** (D28, D29) : durée d'accès (`valid_until`) pour pro/viewer, invitation par un editor (pro/viewer datés), « Copier le lien » / `navigator.share()`, adresse masquée sur la page publique. **Livré** : durée d'accès (7 / 30 / 90 j / sans limite → `valid_until`), invitation par un editor (pro/viewer datés), lien à copier / partager après envoi, adresse masquée par `get_invitation_preview` (`0007`).
- [x] **E1-7 (M, 1)** Profil et suppression de compte (fait). **Reste** (D31) : figer `completed_by_name` avant suppression, retirer le champ langue de l'UI, proposer « Transférer » / « Supprimer le bateau » quand le compte est dernier owner. **Livré** : `completed_by_name` figé avant suppression, champ langue retiré, blocage dernier owner avec liens Transférer / Supprimer le bateau.

## L2 — Le bateau existe

- [x] **E2-7 (M, 1)** Migration `0004_tracking.sql` (D1, D4, D5, D6, D11, D12, D14, D15, D17, D28) : `anchor_date` / `anchor_hours`, `checklist_completions.next_due_at`, `engines.counter_reset_at`, `maintenance_logs.equipment_id`, suppression de `priority` et `next_due_at`, `boat_invitations.valid_until` + politique editor, suppression d'une réalisation (pro < 24 h) + cascade du relevé, garde de suppression des moteurs, corbeille ↔ relevés, vue de statut ancrée, progression sur points à intervalle, fonction de file d'attente `boat_todo_queue`, stats 12 mois, couleurs harmonisées, dates futures refusées ; fixture étendue (cas 8–20), parité TS, tests RLS étendus.
- [x] **E2-1 (M, 2)** Page `/boat` onglet Identité : lecture + édition inline owner/editor, notes ; longueur / largeur / tirant d'eau / n° de voile repliés dans « Caractéristiques ».
- [x] **E2-2 (M, 3)** Onglet Moteurs : puces de compteur, fiche moteur (`/boat/engines/[engineId]`), **dialogue de relevé** (moteur pré-sélectionné, aide « dernier relevé », avertissement si inférieur avec case « le compteur a été remplacé » → `counter_reset_at`, refus des dates futures), **historique des relevés éditable et supprimable** (D16, ex-E10-5), points de checklist liés, interventions du moteur, « Générer les points de ce moteur » (seulement s'il n'en a aucun), désactivation avec avertissement « N points de suivi seront retirés » (D14). Vignette tappable et fiche ouvrant sur l'historique du compteur depuis D74.
- [x] **E2-3 (M, 2)** Onglet Équipements : accordéon par catégorie, fiche (`specs` clé/valeur, notes), ajout / édition ; « déposé le … » au lieu de suppression ; bloc « Historique » (interventions `equipment_id`).
- [x] **E2-4 (M, 1)** Catégories (dans Paramètres) : renommer, couleur (nuancier des 8 valeurs harmonisées + avertissement < 3:1), ordre, archiver avec dialogue d'impact (« archiver aussi les N points » / « les déplacer vers … », §4.6), réactiver.
- [x] **E2-5 (M, 1)** Paramètres du bateau : catégories, export (E9-2), rapport (E9-2b), « Recaler ma checklist » (E4-9), « Reprise du carnet » (E3-7), transfert (E1-8), suppression du bateau (saisie du nom).
- [x] **E2-6 (M, 2)** Script `pnpm seed:xaman` idempotent + test (deux exécutions = mêmes comptes). Ancrage renseigné à l'instanciation par `0004`.
- [x] **E2-9 (S, 2)** Matières et affordance de la maquette (D127) : une matière par face (coque, carène, flottaison, pont, sole, roof, vitrage, toile, carbone, solaire, trampoline, métal, appendice) avec son jeton `--model-*` et son contraste propre, fond de studio, ombre en dégradé ; pastille « Touchez un élément », survol qui teinte la zone et la nomme, invite au-dessus de la liste, lignes qui se comportent en boutons, **toutes les zones marquées** (pastille pour ce qui est dû, plot discret pour le reste). Une zone ouverte commence par **ce qu'elle est** : les `specs` de ses équipements lues en clair (`src/lib/boat-3d/specs.ts`), « À faire » ensuite. **DoD** : `tests/unit/boat-3d.test.ts` couvre les rampes et les matières, audit tactile vert.
- [x] **E2-8 (S, 3)** Maquette 3D du bateau en tête de l'onglet Équipements (D117) : coque paramétrique construite dans le navigateur à partir du type et des dimensions du carnet **et de son inventaire** (dérives, safrans suspendus, jupes allongées, bout-dehors, panneaux sur bossoirs, surfaces de voiles, winch de mât, radeau, dôme — `src/lib/boat-3d/features.ts`), rotation continue, glisser pour tourner, toucher une zone pour l'ouvrir, ligne « Dessinée d'après le carnet : … » sous la maquette. Équipements et points de checklist routés vers une zone physique par les mots puis par l'`external_ref` de la catégorie ; pastilles sur les seules zones en retard ou bientôt dues ; liste de toutes les zones à côté de la maquette (clavier, lecteur d'écran, doigt qui rate). Pas de dépendance 3D (`src/lib/boat-3d/`, `<canvas>` 2D). `prefers-reduced-motion` arrête la rotation et laisse les boutons de rotation. **DoD** : routage testé (`tests/unit/boat-3d.test.ts`), maquette `/dev/ui/boat/model-3d`, vérifié en 1024×768 et 768×1024.
- [x] **E2-10 (S, 2)** L'inventaire d'un document verse dans l'import (D128) : colonne **« Caractéristiques »** de l'import d'équipements (`cellSpecs` — `clé: valeur` séparés par `;` ou retour à la ligne, clé repliée en `snake_case`, 20 paires au plus), genre **`inventory`** dans la boîte de réception (jusqu'à 80 lignes lues sur un document : nom, catégorie, marque, modèle, n° de série, quantité, date de pose, caractéristiques), carte qui les montre et bouton **« Importer ces équipements »** ouvrant l'import pré-rempli (`inventoryToTable` rend un tableau tabulé dont l'en-tête porte les libellés de l'import, donc `guessMapping` mappe seul). À l'écriture, les `specs` en base **gagnent** sur celles du document (D113). La carte lit les caractéristiques en clair (`specFacts`, comme la maquette), replie le formulaire de rangement derrière « Ranger aussi ce document », et un inventaire sort de « Tout valider ». **DoD** : `tests/unit/inbox-inventory.test.ts` couvre la lecture de la colonne, le pont, la garde de « Tout valider » et la compatibilité des suggestions antérieures ; carte visible sur `/dev/ui/inbox`, audit tactile vert.

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

- [x] **E7-1 (M, 3)** `/dashboard` (D20) : en-tête sombre (nom, modèle, phrase d'état, 4 vignettes tappables, bande des moteurs tappables avec date du relevé / « à mettre à jour » > 60 j / « compteur inconnu »), un seul bandeau contextuel (hors ligne › échec d'envoi › lignes à vérifier › compteurs jamais saisis › installer), « À faire prochainement » via `boat_todo_queue` (6 / 5 / 4 lignes, `[ Fait ]` en ligne, `never` exclus), état « carnet neuf » (3 étapes) et « tout est à jour » (sans bouton), grille des 8 systèmes (ordre fixe), 5 dernières interventions, récapitulatif (dépenses 12 mois par catégorie, dernière sortie de l'eau, stock sous seuil), skeletons aux dimensions exactes, erreur par bloc.
- [x] **E4-7 (M, 1)** Realtime : publication sur les 8 tables (fait, `0003`) + pont client par bateau (fait) ; **reste** : table de correspondance table → queries (vues comprises), reprise après coupure = invalidation complète, halo sur ligne modifiée, « 1 nouvelle intervention · Afficher » sur liste défilée (§5.7). **Livré** : invalidation complète du bateau à tout événement (pas de table de correspondance : les écrans sont rendus côté serveur et `router.refresh()` suffit), reprise après coupure = re-souscription → rafraîchissement complet, reprise réseau (`online`) idem. Le halo sur ligne modifiée et « 1 nouvelle intervention · Afficher » arrivent avec la liste du journal (E3-2).
- [x] **E7-2 (M, 1)** Bannière d'installation PWA (iOS : Partager → Sur l'écran d'accueil ; Android : `beforeinstallprompt`), à partir de la 2ᵉ session, masquable 30 jours.

## L5 — Le récit

- [x] **E6-2 (M, 2)** Intervenants (`/contacts`, « Plus ») : liste groupée par spécialité (liste fermée + Autre), recherche, fiche (`tel:`, `mailto:`), formulaire, **`ContactPicker`** réutilisable (Nous-mêmes / prestataire + `NativeSelect` groupé + création inline, D32), bloc « interventions et dépenses chez cet intervenant », mise à la corbeille avec nombre de références (E3-8 : les liens sont conservés jusqu'à la purge).
- [x] **E3-1 (M, 1)** Vues `maintenance_logs_view` / `maintenance_logs_trash_view`, `purge_trash`, `sync_log_readings_date` (`0003`) ; corbeille ↔ relevés par trigger (`0004`, D5).
- [x] **E3-3 (M, 3)** **Formulaire de saisie unique** `/logs/new` et `/logs/[logId]/edit` (D3, D7, D26) : titre + suggestions (titres existants avec catégorie et moteur, 2 caractères, 5 max, jamais `<datalist>`), chips de catégorie, statut segmenté + bascule Urgent (défaut Terminé), date (puces + roulette ; futur seulement si planifiée), heures par moteur (dépliées si catégorie Moteurs ou point moteur coché ; vides + « dernier relevé » + « = reprendre » ; jamais pré-remplies), coût, réalisé par (`ContactPicker`), notes, équipement (replié), photos (E10-1), **points de checklist concernés** (pré-cochés par similarité trigram > 0,5, grisés si heures manquantes pour un point à intervalle en heures) ; upsert idempotent (UUID à l'ouverture, D18), brouillon `sessionStorage`, barre collante au-dessus du clavier, garde « abandonner ? », toast factuel. Inclut l'entrée « + Ajouter les détails » du dialogue « Fait » (`/logs/new?item=` : titre pré-rempli, point pré-coché, heures reprises). **Fait** (formulaire unique, suggestions serveur, points concernés cochés dans le formulaire — pas de feuille après l'enregistrement, brouillon `sessionStorage`, entrée « + Ajouter les détails » du dialogue « Fait ») ; **reste** : photos (E10-1).
- [x] **E3-3b (M, 1)** Suggestion trigram côté serveur (`similarity(label, titre)` dans la catégorie, 5 max) — remplace l'heuristique par mots-clés. **Fait** (`suggest_checklist_items`, `0005`).
- [x] **E3-4 (M, 2)** Détail `/logs/[logId]` : toutes les infos, heures moteur, cochages liés, achats liés (« resteront dans les dépenses »), sortie de l'eau liée, équipement, « **Refaire** » (ex-E10-3, remonté en Must), « **En faire un entretien récurrent** » (crée un point avec intervalle déduit), Modifier, Mettre à la corbeille (relevés déplacés, toast Annuler), créé par / modifié par en pied (E10-4). **Fait** (Refaire, entretien récurrent, corbeille avec Annuler 8 s, pied E10-4).
- [x] **E3-2 (M, 3)** Liste `/logs` : onglets **Historique** (`done`, date desc) / **Prévu** (non terminées) / **Sorties de l'eau** (D9), recherche trigram, filtres catégorie + statut + « À vérifier N » persistés dans l'URL, lignes 76 px avec liseré de catégorie et heures relevées à droite, « charger plus » (pas d'infini), état vide initial / filtré, « 1 nouvelle intervention · Afficher » en temps réel. Inclut le halo 2 s sur une ligne modifiée par un autre appareil et « 1 nouvelle intervention · Afficher » quand la liste est défilée (E4-7). **Fait** ; « Prévu » est trié urgent d'abord côté TS sur la page chargée (20 lignes).
- [x] **E3-5 (M, 1)** Corbeille `/trash` (owner/editor) : interventions, achats, sorties de l'eau < 30 j, restauration, « supprimé définitivement dans N jours », purge quotidienne (`pg_cron` si disponible). **Fait** (lecture et restauration ; la mise à la corbeille des achats et sorties de l'eau vient de E5-2 / E6-1).
- [x] **E3-8 (M, 2)** **La corbeille couvre tout** (D40 / D41, demande de Xav « update la corbeille pour qu'il y ait tout dedans ») : `0012` ajoute `deleted_at` aux **pièces de stock** et aux **intervenants**, index uniques partiels sur `external_ref`, purge à 30 jours étendue à `parts`, `contacts` et `attachments` ; six sections dans `/trash` (interventions, achats, sorties de l'eau, pièces, intervenants, documents), chacune avec **Restaurer** et **Supprimer définitivement** ; toutes les lectures des deux nouvelles tables filtrent la corbeille (stock, tableau de bord, annuaire, `ContactPicker`, rapprochement d'import, formulaires) ; libellés de confirmation revus, y compris ceux des chemins déjà réversibles (catégorie archivée, point désactivé, équipement déposé). **Fait**. **Reste** : `checklist_completions` et `engine_hour_readings` restent en suppression physique (voir DECISIONS du 2026-09-03).
- [x] **E3-7 (M, 2)** **Reprise du carnet** (D24) : tableau des lignes importées (7 interventions × SB/BB, 3 achats), valeurs éditables, ⚠ sur les valeurs non monotones, « Intervertir SB ↔ BB », « ignorer les heures », correction de date, validation en une fois (`mark_log_reviewed` + achats), accessible depuis Paramètres et depuis le bandeau du tableau de bord. **Fait** (`/logs/review`, un seul écran, `?log=` pour une ligne).

## L6 — L'argent

- [x] **E5-1 (M, 1)** Page `/supplies` renommée **Dépenses** (« Plus ») : onglets Dépenses (défaut) · Achats · Stock ; le gaz est un filtre + raccourci de saisie. **Fait**.
- [x] **E5-5 (M, 2)** Onglet Dépenses : période (12 mois glissants par défaut · année · personnalisée), liste des catégories avec barre et montant (décroissant), filtre de source (interventions / achats / sorties d'eau), comparaison N-1, cumul depuis l'origine, export CSV ; **pas de tableau croisé**. **Fait** ; depuis D77 chaque ligne de catégorie filtre la liste (« Sans catégorie » comprise) et l'export suit les filtres ; depuis D86 la catégorie active déroule ses lignes sous elle-même et chaque ligne déroule son récapitulatif (statut, intervenant, note, ce qui y est rattaché) avec « Ouvrir l'intervention » à un geste.
- [x] **E5-2 (M, 2)** Achats : liste (date, désignation, type, catégorie, montant, fournisseur, « À vérifier »), filtres type + catégorie + période, formulaire allégé (sans quantité ni devise ; 4 types visibles : Gaz / Pièce / Prestation / Autre), lien optionnel vers une intervention, « Marquer comme vérifié », corbeille. **Fait**.
- [x] **E5-3 (M, 1)** Gaz : filtre `kind = 'gas'`, dialogue « Bouteille de gaz » (type = dernier utilisé, fournisseur, montant, date), faits « dernière bouteille il y a N j · intervalle moyen sur N intervalles valides », estimation « estimé » seulement à partir de 3 intervalles. **Fait**.
- [x] **E6-1 (M, 1)** Sorties de l'eau : onglet du Journal, formulaire (sortie / remise à l'eau en deux champs, chantier via `ContactPicker`, travaux, coût), détail avec interventions liées, corbeille. **Fait** ; l'écran porte le cadre de l'onglet depuis D71 (barre d'onglets, en-tête « Interventions », entrée du menu allumée) ; **reste** : raccourci « Remettre à l'eau » sur la fiche et feuille « Rattacher » depuis une intervention.

## L7 — La preuve et la robustesse

- [x] **E9-2 (M, 1)** Export : Server Action `exportBoat` → JSON complet + `interventions.csv` + `depenses.csv` (pas de zip), bouton dans Paramètres.
- [x] **E9-2b (M, 2)** **Rapport d'état** `/boats/[boatId]/report` : une page serveur imprimable (`@media print`, PDF via Partager → Imprimer) : identité, moteurs et heures, état des 8 systèmes, échéances des 12 mois, 12 derniers mois d'interventions (réalisé par), sorties de l'eau, coûts avec bascule « inclure les coûts », pied « Carnet tenu dans Xaman · N interventions · N réalisations ».
- [~] **E9-1 (M, 2)** Hors ligne : `OfflineBanner` (`navigator.onLine` + échecs consécutifs), âge des données, boutons en style hors ligne (`aria-disabled` + toast), **brouillons locaux** (créations seulement, renvoi manuel, 20 max, D25), runtime caching Serwist des pages du bateau. **Fait** : bandeau + âge des données, bouton « Hors ligne — réessayer » dans la barre d'action, pages en cache runtime (Serwist `defaultCache`). **Fait aussi (E9-1b)** : file d'attente locale (`localStorage`, 20 max), création d'intervention, d'achat, de pièce et cochage d'un point mis en file hors ligne, carte « saisies en attente » en tête du tableau de bord avec « Tout renvoyer », suppression ligne à ligne.
- [x] **E1-8 (M, 1)** Transfert du bateau (D30).
- [x] **E9-6 (M, 2)** **E-mail hebdomadaire** (ex-E11-1, remonté en V1) : Edge Function + cron, vendredi matin, owner/editor, retards + bientôt + planifiées / urgentes ; pas de push, pas de notification par point. **Livré** : fonction SQL `weekly_digest_payload` + `enqueue_weekly_digest` (pg_cron vendredi 06:30 UTC, pg_net, secrets Vault) et Edge Function `weekly-digest` (Resend). À activer avec le projet Supabase : secrets `RESEND_API_KEY`, `DIGEST_FROM`, `APP_URL`, Vault `xaman_digest_url` / `xaman_digest_key`.
- [x] **E9-3 (M, 2)** Tests E2E Playwright (iPad paysage + iPhone) sur les parcours `SPEC.md §6.1 à §6.4` + **budget d'interaction chronométré** (vidange ≤ 7 taps, cochage ≤ 3 taps, relevé ≤ 3 taps) + parcours « premier lancement » (assistant). **Fait** : audit tactile `tests/e2e/touch-audit.spec.ts` (cinq viewports, pages `/dev/ui/*`) ; harnais de parcours `tests/e2e/support/` (connexion d'un utilisateur du seed par `generate_link` + `/auth/callback`, compteur de taps, invitation émise à la demande) ; les quatre parcours `tests/e2e/journeys/` (§6.1 invitation, §6.2 vidange **7 taps**, §6.3 cochage **3 taps**, §6.4 pro et viewer) et le relevé d'heures (**3 taps**), joués sur iPad et iPhone par le job CI `journeys` (`supabase start`, pile locale uniquement — D81). **Vert le 2026-09-07.** Sans pile (bac à sable sans Docker, E0-2) ils se sautent, donc `pnpm test:e2e` reste vert. **Fait aussi** : le parcours « premier lancement » (`first-launch.spec.ts`) — les trois étapes de D67 (identité du bateau, carnet existant, prise en main) jusqu'au tableau de bord ; il ouvre un vrai carnet, donc il efface les siens avant de commencer (`removeE2EBoats`). **Vert le 2026-09-07** : 22 cas (11 × iPad et iPhone), les cinq parcours et les trois budgets.
- [ ] **E9-4 (M, 2)** QA iPad Safari réelle : zoom, clavier, safe areas, scroll des dialogues, cibles, mode standalone, plein soleil réel, gants / doigts mouillés, reconnexion Realtime après veille.
- [x] **E9-5 (M, 1)** `/health` (fait), capture d'erreurs front (optionnel), README (installation, seed, déploiement, requête d'activation). README réécrit (installation, base locale, tests, déploiement, demande d'accès).
- [x] **E1-6b (M, 1)** Tests RLS des vues et fonctions secondaires (rapport, export, `boat_todo_queue`) — partie livrée par `0004`. Tests ajoutés pour `expenses_by_category`, `engine_current_hours`, `boat_invitations_safe` (sans token), `maintenance_logs_trash_view`.

## L8 — Confort

- [x] **E10-1 (S, 2)** Pièces jointes réduites : photo(s) sur intervention (caméra iPad) + facture sur achat ; galerie équipement et photo du bateau en V1.1. **Fait** (`0011` : `caption`, `deleted_at`, chemin de stockage lié au bateau par contrainte, garde d'intégrité polymorphe, purge en cascade, `attachments_count` sans corbeille ; `AttachmentPicker` — caméra / photothèque / Fichiers, réduction JPEG 2000 px sur l'iPad, progression et échec par fichier, légende, corbeille avec Annuler ; galerie sur la fiche intervention, trombone dans le journal, « Importer des documents » en lot — **repris par « À valider » en E15-9 (D95)** ; page de recette `/dev/ui/attachments`).
- [x] **E10-4 (S, 1)** « créé par / modifié par / le » en pied des détails. Fiches moteur, équipement, intervenant (`AuditFooter`) ; la fiche intervention l'obtient avec E3-4.
- [x] **E5-4 (S, 1)** Stock déclaratif (D10) : liste plate (nom, quantité, seuil, emplacement), +/− atomiques, filtre « sous le seuil », « vérifié il y a N mois ». **Fait** (`0010` : `checked_at` + `adjust_part_quantity`, onglet Stock, fiche création / édition, tests unitaires et RLS ; la suppression physique de D10 est passée à la corbeille par E3-8 / `0012`).
- [~] **E8-1 (M, 1)** Compléter `seed/xaman-boat.json`. La liste des 80+ points **ne bloque plus** : Xav trie dans l'assistant (E4-9). **Fait le 2026-09-14**, à partir du dossier de commande du chantier et sous la règle D113 (le carnet fait foi, aucune des cinq divergences du document n'a été reportée) : contact **Marsaudon Composites** (chantier constructeur, adresse, téléphone, e-mail), six `specs.ref_chantier` sur les équipements dont la désignation correspond mot pour mot à la ligne du chantier (`STRC01`, `STRC02`, `STRC03`, `STRC06`, `GREM10`, `ACC13`), et les références du dossier (devis, descriptif indice B, STB) dans les notes du bateau. **Reste** : les deux adresses e-mail de Xavier et Emmanuel — celles du document datent de 2023 et des comptes réels existent déjà en production, donc à confirmer avant de les écrire (le seed *invite* l'adresse qu'il lit) ; les modèles exacts des deux Yanmar (ils sont dans le descriptif technique standard, pas dans la STB) ; les cinq autres intervenants ; `flag`, `home_port` et `year` ; les dimensions (le catalogue donne 15,12 × 8 m pour l'ORC 50, mais les jupes allongées de 60 cm rendent la valeur fausse pour ce bateau).
- [~] **E8-2 (M, 1)** Mise en production (**prod déployée le 2026-09-02** : Supabase `xaman` migré et chargé, `main` → https://xaman-blue.vercel.app ; **reste** : variables Vercel et réglages Supabase Auth côté utilisateur, puis les points ci-dessous) : seed, connexion des 3 comptes, assistant de mise en route, reprise du carnet, **première saisie réelle par Xav chronométrée (< 45 s)**, vérification à trois sur iPad.

- [x] **E16-8 (M, 2)** **Chaque écran ne reçoit que les mots qu'il lit** (D110) : le provider
  `next-intl` posé à la racine sans `messages` héritait de tout `fr.json` et le sérialisait dans
  la charge utile de chaque page (88 Ko). Tranches déclarées dans `src/i18n/slices.ts` et posées
  par `Translations` — racine vide, `(auth)`, mise en route, cadre du bateau, et treize
  `layout.tsx` de section. Mesuré : `/login` 123 Ko → 34 Ko, page d'accueil 146 Ko → 50 Ko, pire
  écran du bateau 88 Ko → 44 Ko. `scripts/i18n-usage.mjs` parcourt le graphe d'imports et
  `tests/unit/i18n-slices.test.ts` refuse une tranche qui ne couvre plus ses écrans (vérifié : le
  test échoue en nommant le groupe retiré).
- [x] **E16-9 (M, 2)** **Les totaux des dépenses sont comptés par la base** (D111) : migration
  `0031`, fonction `boat_expense_totals` (`security invoker`) rendant total, nombre de lignes,
  répartition par système, cumul, première dépense et période précédente ; la liste passe à
  `limit + 1` au lieu de lire tout l'historique deux fois. Lecteur TS `categoryTotalsFrom` avec
  ses cas de charge utile hostile, cas RLS (un étranger lit des zéros), galerie `/dev/ui` alignée
  sur la nouvelle forme.

## Retirés ou reportés (voir `AUDIT.md §3.4`)

- E4-8 export PDF de catégorie → remplacé par E9-2b · E10-2 sélecteur de bateau → reporté (un seul bateau) · E10-3 → fusionné dans E3-4 · E10-5 → fusionné dans E2-2 · E3-6 → fusionné dans E3-3 / E3-3b.
- **E11 — V1.1 / V2 (ne pas démarrer sans validation)** : E11-2 graphique des heures · ~~E11-3 onboarding public (derrière une bibliothèque de modèles)~~ **livré le 2026-09-03 (D64), scindé le 2026-09-04 (D65), catalogué le 2026-09-04 (D69)** : `/boats/new` demande l'identité du bateau seule, `create_boat` (`0015` + `0017` + `0021`) lui donne ses systèmes, le plan d'entretien se choisit à l'étape 3 de la mise en route (D67) ; trois modèles génériques (`0016`) ; catalogue de modèles de série `boat_models` (`0019` + `0020`) derrière les suggestions constructeur/modèle, et `boats.registration` (`0018`) sur l'écran Bateau — l'auto-remplissage depuis l'immatriculation n'existe nulle part (D69) · E11-4 offline-first · E11-5 organisations / `renter` · E11-6 modèles publiés par les constructeurs et versionnage · E11-7 relevés automatiques (Victron / NMEA) · lien de partage lecture seule du rapport · import assisté du carnet papier (photo → saisie guidée) · historique par équipement enrichi.

---

## Jalons révisés

| Jalon | Contenu | Critère de passage |
|---|---|---|
| J1 — Verrouillé | L0 + L1 | Les 3 comptes se connectent (OTP en PWA sur iPad) ; les tests RLS passent en CI |
| **J2 — Ça suit** ⭐ | L2 + L3 + L4 | Sur un iPad : l'assistant est passé, la file d'attente est juste, cocher un point la met à jour en < 1 s, un 2ᵉ appareil le voit sans recharger. **Démo à Xav** |
| J3 — Le carnet est remplacé | L5 + L6 | Vidange saisie en < 45 s, carnet papier repris, dépenses lisibles |
| J4 — MVP complet | L7 | Rapport d'état, export, hors ligne, e-mail hebdomadaire, E2E et QA iPad — critères `SPEC.md §11` |
| J5 — Confort | L8 | Photos, stock, mise en production complète |

## E12 — Import de données (« ne jamais tout retaper »)

Règle produit : partout où l'app stocke une liste, on doit pouvoir l'importer. Un moteur unique, un descripteur par entité.

- [x] **E12-1 (M, 2)** Moteur d'import : analyse `.csv` / `.tsv` / collage Excel, détection du séparateur, correspondance automatique des colonnes par en-tête (accents et casse ignorés), aperçu des 10 premières lignes, validation zod ligne à ligne, upsert idempotent sur la clé naturelle, rapport « N créées · M mises à jour · K refusées » avec motifs et export CSV des refus.
- [x] **E12-2 (M, 1)** Écran `/boats/[boatId]/import` + entrée « Importer » sur chaque liste concernée.
- [x] **E12-3 (M, 1)** Descripteurs : contacts, équipements, pièces en stock.
- [x] **E12-4 (S, 1)** Descripteurs : **interventions** et **achats / dépenses** faits — clé « libellé + date » ou référence du fichier, prestataire rapproché des contacts, tout arrive « à vérifier ». **Points de checklist faits** et **relevés d'heures** : le point et le moteur sont rapprochés par leur nom (accents et casse ignorés, « bâbord » comprise), un nom inconnu ou porté par deux lignes est refusé et listé ; clé « point + jour » et « moteur + jour » ; un compteur en baisse est refusé (D12 : le remplacement se déclare sur la fiche du moteur) ; les heures d'une réalisation sont exigées là où la base les exige et deviennent un relevé par déclenchement.
- [x] **E12-5 (S, 1)** Fichiers `.xlsx` (analyseur chargé à la demande, hors du bundle principal).
- [x] **E12-6 (S, 1)** Contacts depuis une fiche `.vcf` (carnet d'adresses iOS / Android exporté).
- [x] **E12-7 (C, 1)** Modèle vierge téléchargeable par entité (les bons en-têtes, une ligne d'exemple).
- [x] **E12-8 (S, 1)** ~~« Vous avez déjà un carnet d'entretien ? » sur `/boats/new`~~ **repris par E14-3 (D67)** : la question est devenue l'étape 2, et son lecteur s'ouvre sur place au lieu de renvoyer ailleurs. Version d'origine (D66) : puces *Rien à reprendre* / *Excel ou CSV* / *Papier ou photos*, pré-réglées sur la première ; le format choisi décide de l'écran sur lequel le carnet s'ouvre — import des interventions (E12-1), import de documents (E10-1) ou tableau de bord — et le bouton devient « Ouvrir le carnet et importer ». `from=new` renvoie l'assistant vers le tableau de bord du bateau tout neuf.

## E13 — Reprises d'interface signalées à l'usage

- [x] **E13-1** Dialogue d'installation : la barre d'actions collante recouvrait le texte sur un écran court ; elle suit désormais le contenu. Page `/dev/ui/install` ajoutée pour le mettre sous l'audit tactile.
- [x] **E13-2** Fil d'Ariane sous l'en-tête, déduit de l'URL (`buildTrail`), pour remonter un flux sans repasser par le menu de gauche.
- [x] **E13-3** Respiration : marges hautes et basses de la zone de contenu augmentées (`pt-6 / lg:pt-10`, bas `8rem / 4rem`).
- [x] **E13-4** Libellés de boutons rognés : une puce ne rétrécit plus sous son texte (`grow basis-auto` + plancher 44 px) et un groupe passe à la ligne. L'audit tactile échoue désormais sur tout libellé plus large que son bouton.
- [x] **E13-5** Fil d'Ariane depuis les catégories du menu : tout fil commence à la section de l'écran (onglet, feuille « Plus », menu compte), y compris sur la racine d'une section où la miette nomme la page. Les sorties de l'eau s'accrochent au Journal, le rapport aux Paramètres ; les sous-listes visent l'onglet qui les sert (`/boat?tab=engines`, `/supplies?tab=stock`) pour qu'aucune miette cliquable ne mène à un 404.
- [x] **E13-6** Écran d'import repris en trois étapes qui se replient : la source se résume à une ligne dès qu'un tableau est lu, la correspondance se fait colonne par colonne (en-tête du fichier, premières valeurs réelles, champ alimenté, mention « deviné », colonnes explicitement laissées de côté), et l'aperçu annonce créations, reconnaissances et refus **avant** l'écriture. Signalé à l'usage : « l'import est dégueu, il faut gérer le mapping ».
- [x] **E13-7** Checklist **« À racheter »** des pièces détachées (D63) : les pièces au seuil ou en dessous forment une liste, **déduite du stock** (aucune double saisie), avec le fournisseur (« chez X ») pour savoir où racheter. On agit **sur la ligne** : des **+/−** ajoutent/retirent du stock sur place (RPC atomique `adjust_part_quantity`) et une pièce repassée au-dessus du seuil quitte la liste ; le corps de la ligne ne navigue plus (fini la redirection vers Bateau). **« Noter une pièce à racheter »** ouvre un dialogue à un champ : la pièce entre au stock (0 en réserve, seuil 1) et apparaît d'office ici et dans le stock — la note *est* la ligne de stock. En tête de l'écran Checklist (bouton « noter » présent même sans pièce sous le seuil) **et** de Bateau › Équipements, chargement du stock mutualisé (`src/lib/queries/stock.ts`) pour une seule source de vérité. Aucune migration. Signalé à l'usage : « hyper important pour en racheter… je veux pouvoir rajouter du stock ou me noter de racheter depuis la checklist, JAMAIS de double saisie ».

- [x] **E13-8** **E-mails d'authentification aux couleurs de Xaman** (D71) : les six gabarits que Supabase Auth envoie sont écrits, en français, dans `supabase/templates/` — plaque navy, filet de laiton, carte sur papier chiffon, bouton de 44 px. `magic_link` et `confirmation` portent `{{ .Token }}`, ce qui est **la** correction du « on ne reçoit pas de code, on reçoit un magic link » : sans cette variable GoTrue envoie un lien, quel que soit ce que dit l'écran de connexion. L'invitation nomme le bateau, l'invitant et le rôle (`{{ .Data.* }}`, posés par `inviteMember`). Un générateur (`pnpm gen:emails`) tient la coquille commune, un test échoue sur toute dérive, `/dev/ui/emails` les montre remplis de valeurs d'exemple, et `pnpm emails:push` les applique au projet hébergé sans toucher au reste de la configuration auth. Signalé à l'usage : « fais les mails d'ajouts de membres au clean… brande les mails aux couleurs de Xaman » et « la connexion via code est fausse ». **À faire hors dépôt** : lancer `pnpm emails:push` avec un jeton d'accès Supabase.
- [x] **E13-9** **Retour à l'application depuis « Ajouter un bateau »** (D72) : `/boats/new` savait accueillir un compte sans carnet (`/boats` l'y envoie, « Se déconnecter » en pied) mais pas quelqu'un qui en a déjà un et arrive par le menu compte — sans onglets, sans barre d'adresse et sans geste de retour en mode autonome, l'écran était sans issue. Il lit désormais s'il existe un bateau : « ‹ Retour à l'application » vers `/boats` dans ce cas (et plus de bouton de déconnexion, qui vit dans le menu compte), rien de changé dans l'autre. Signalé à l'usage : « je ne peux pas revenir à l'app ».
- [x] **E13-10** Moteur **sans compteur d'heures** (D73) : case « Pas de compteur d'heures » sur la fiche du moteur (`engines.tracks_hours`, défaut `true`). La carte et la fiche disent « sans compteur d'heures » au lieu de « compteur inconnu », le bouton « Relevé » disparaît, le moteur quitte le bandeau des compteurs, la phrase « moteurs sans relevé » et `engines_without_reading`, l'intervention ne lui ouvre plus de champ d'heures, et `checklist_item_status` remet `interval_hours` à null pour ses points — ce qui débloque leur cochage, jusque-là refusé par `check_completion_hours` faute d'heures lisibles. Rien n'est effacé : l'intervalle stocké et les relevés existants reviennent si la case est décochée. Migration `0022`, annexe de `seed/xaman-boat.json` livrée avec `tracks_hours: false`. Signalé à l'usage : « dans moteurs mets une check box pour les annexes où on n'a pas le compteur d'heures ».

- [x] **E13-15** **Tous les rôles dès l'invitation** (D89) : le dialogue d'invitation et la liste des membres lisaient deux listes de rôles écrites à deux endroits — l'un sans `owner` (D30 : la propriété passe par le transfert), l'autre avec, dans un menu déroulant sans confirmation, et la politique `boat_members_update` ne regarde pas quel rôle est attribué. La propriété avait donc déjà deux portes, dont une non voulue. Les deux écrans lisent désormais `ASSIGNABLE_ROLES`, qui contient les quatre rôles ; `EDITOR_ASSIGNABLE_ROLES` nomme la règle D28 au lieu de la déduire par filtre (un editor reste limité à professionnel / lecteur, daté) ; une invitation en propriétaire **n'a pas de date de fin** — la question disparaît du formulaire et `inviteMember` écrit `null` — et un encart dit ce que ce rôle permet, retrait de l'invitant compris. Aucune migration : la politique d'insertion l'autorisait déjà, un test RLS le fixe. Signalé à l'usage : « je veux pouvoir ajouter tous les rôles dès l'ajout ».

- [x] **E13-11** **Le code d'e-mail accepte 6 à 10 chiffres** (D83) : six étaient écrits en dur dans le schéma, dans le `maxLength` du champ et dans trois phrases, alors que la longueur est un réglage du projet Supabase (« Email OTP Length », 6–10). Un projet réglé sur 8 rendait la connexion par code **impossible** — le champ s'arrêtait à six caractères et le schéma refusait le reste, sans message qui l'explique. `OTP_MIN` / `OTP_MAX` remplacent le nombre en dur, les libellés ne promettent plus de compte de chiffres, l'espacement du champ descend à `0.3em` pour que dix tiennent en 320 px, et un test parcourt les cinq longueurs. Signalé à l'usage : « le code à 6 chiffres en a 8 ».
- [x] **E13-12** **L'invitation part de l'application** (D75) : `inviteUserByEmail` refuse toute adresse présente dans `auth.users` (`422 already registered`), et « avoir un compte » n'est pas « être à bord » — trois adresses du projet avaient un compte et aucune appartenance, et ne recevaient plus qu'un code de connexion qui ne nomme ni le bateau, ni l'invitant, ni le rôle. Quand un expéditeur est configuré, l'app envoie donc l'invitation elle-même (Resend, un `fetch`, aucune dépendance ajoutée), avec **le même HTML** — `INVITATION_HTML` est généré depuis `supabase/templates/invite.html`, un test compare octet par octet. Le lien est l'adresse de l'invitation, plus une URL de vérification : aucun compte n'est créé à l'avance, l'invité se connecte par code sur `/invite/[token]`. **Sans `RESEND_API_KEY`, le comportement d'avant est conservé à l'identique** — livrable avant que la variable existe. Signalé à l'usage : « pourquoi quand j'ajoute un user il reçoit ça ? ».
- [x] **E13-13** **Jusqu'à quatre moteurs à l'étape 1** (D76) : la puce « Moteurs » de `/boats/new` offre 0, 1, 2, 3 et 4 — elle s'arrêtait à deux, et `newBoatEngines` créait deux moteurs pour tout compte supérieur, plafonnant un tri-moteur ou un quad sans le dire. Les noms suivent le nombre (3 : bâbord · central · tribord ; 4 : bâbord extérieur · intérieur, tribord intérieur · extérieur) et les positions restent celles que `engine_scope` attend, toutes en `outboard` sur un semi-rigide. Quatre plus l'annexe font cinq, sous les six que `create_boat` accepte ; au-delà, l'écran Bateau. Aucune migration. Signalé à l'usage : « ici donne la possibilité de rajouter d'autres moteurs direct ».

- [x] **E13-16** **L'e-mail de code ne contient plus de lien** (D80) : « code incorrect ou expiré » à chaque tentative, et les IP des journaux ont donné la réponse — toutes les vérifications réussies venaient d'adresses **Amazon et Azure**, trois secondes après la livraison. Ce sont les analyseurs anti-hameçonnage de la messagerie (une adresse d'école, donc Microsoft Defender) qui ouvrent chaque URL d'un message ; or le lien magique et le code sont **le même jeton à usage unique**, donc le code était consommé avant que son destinataire le lise. Reproductible à chaque envoi. Le gabarit `magic_link` n'a donc plus aucun lien, et le dit ; l'aide sous le champ prévient de l'autre perte possible (« en redemander un annule le précédent »). `confirmation` et `recovery` gardent le leur — le lien y **est** le parcours. **À refaire côté Supabase** : recoller `magic-link.html` dans le tableau de bord. Signalé à l'usage : « quand il arrive il est expiré ».

- [x] **E13-14** **Un e-mail qui rebondit se voit dans l'app** (D79) : l'invitation partie à une adresse mal orthographiée était `Bounced` puis `Suppressed` trois secondes après l'envoi — « Recipient not found » — pendant que l'écran Membres affichait « En attente », et l'aurait affiché quatorze jours avant de passer à « Expirée ». L'invitation porte désormais ce que l'expéditeur sait (`0023` : `email_id`, `delivery_status`, `delivery_reason`, `delivery_detail`, `delivery_updated_at` ; les deux dernières colonnes sensibles ne sont pas accordées à `authenticated`, comme le token). Deux chemins l'alimentent : un **webhook signé** (`/api/webhooks/resend`, signature Standard Webhooks vérifiée avec `node:crypto`, aucune dépendance ajoutée, un événement plus ancien n'écrase jamais un plus récent) et une **relance à la lecture** des invitations encore en attente, qui rend l'écran juste même si le webhook n'est jamais configuré — et qui ne coûte rien une fois l'état connu. À l'écran : pastille `Non délivré` à la place de « En attente », encart rouge avec la cause **en français** (adresse inexistante, boîte pleine, adresse bloquée, refus définitif…) et un bouton **Réinviter** qui rouvre le dialogue avec l'adresse déjà remplie ; les états sains se disent en fin de ligne (« e-mail remis », « envoi en cours »). Vocabulaire fermé, écrit une fois en TypeScript et repris par une contrainte `check`, avec un test qui compare les deux listes et un autre qui exige une phrase française par cause. Sans expéditeur configuré, les colonnes restent nulles et l'écran est celui d'hier. `/dev/ui/members` montre les quatre cas. **Migration `0023` appliquée au projet hébergé le 2026-09-07** (MCP Supabase, `apply_migration` ; colonnes, privilèges et vue vérifiés, `get_advisors` sans nouvelle alerte). **Reste hors dépôt** : Resend → Webhooks → `https://xaman.boats/api/webhooks/resend` sur `email.*`, puis `RESEND_WEBHOOK_SECRET` dans les variables Vercel. Signalé à l'usage : « il faut absolument que tu montres quand les mails sont en bounce dans l'app ».

- [x] **E13-17** **Relancer une invitation, sans en créer une seconde** (D112) : l'écran Membres n'offrait que « Annuler », qui jette l'invitation, et « Réinviter » — le bouton du rebond (D79) — qui écrit une **deuxième ligne en attente** pour la même adresse. Pour quelqu'un qui n'a simplement jamais ouvert le message, le geste manquant était le plus simple : renvoyer le même. Un bouton **« Relancer »** par ligne et un Server Action (`resendInvitation`) qui envoie **le même e-mail, à la même adresse, avec le même lien** — le jeton est relu avec la clé de service, jamais retiré au sort, parce qu'un lien déjà mis de côté par l'invité doit continuer à marcher. La relance **repousse `expires_at` de quatorze jours**, ce que l'e-mail promet et ce qui fait revivre une invitation expirée au lieu de la doubler ; **une heure** sépare deux relances (double tap = un message, règle 11) ; et une adresse en rebond dur ou signalée comme indésirable **n'a pas le bouton** — plus rien ne lui parviendra, la sortie reste « Réinviter » à une autre adresse. `failed` se relance, lui : le message n'avait pas atteint le fournisseur. Rien n'est écrit avant qu'un message soit parti, si bien qu'un envoi refusé ne coûte ni le délai ni le compteur. Migration `0031` (`reminded_at`, `reminder_count`, vue `boat_invitations_safe` recréée, colonnes lisibles par l'owner et écrites par la seule clé de service) ; règles pures dans `src/lib/invitations.ts`, lues par l'action **et** par le bouton, avec leurs tests ; l'envoi de l'invitation est désormais une fonction unique partagée par la première et la relance. La ligne dit « relancée 3 fois, la dernière le 06/09/2026 ». `/dev/ui/members` montre les cas. **Migrations `0028` à `0031` appliquées au projet hébergé le 2026-09-09** (MCP Supabase, `apply_migration`, dans l'ordre) : colonnes, privilèges de colonne, vue, fonction, publication temps réel et les cinq index vérifiés ; `get_advisors` sans nouvelle alerte — les cinq index neufs n'apparaissent qu'en « Unused Index », ce qu'ils sont à la minute où ils naissent. Signalé à l'usage : « code des relances d'invitation à renvoyer manuellement pour les gens pas connectés ».

## E14 — Mise en route en trois étapes (D67)

Une seule colonne vertébrale d'arrivée, avec l'étape en cours écrite en haut de chaque écran. Audit
préalable du parcours complet : **9 taps minimum, ~31 en pratique**, 18 surfaces d'accueil
concurrentes, deux assistants « trois étapes » qui s'ignoraient, et un tableau de bord qui
annonçait « Tout est à jour » sur un carnet sans un seul point.

- [x] **E14-1 (M, 1)** Indicateur d'étape en tête des trois écrans (`OnboardingSteps`) : « Étape n sur 3 » + trois pastilles *Le bateau · Votre carnet · Prise en main*, état porté par deux signaux (remplissage + graisse, jamais la couleur seule), `aria-current="step"`. Jamais cliquable : l'étape 1 a déjà écrit le bateau, y « revenir » tirerait un nouvel identifiant et ouvrirait un second carnet.
- [x] **E14-2 (M, 1)** Étape 1 — `/boats/new` ne demande plus que le bateau ; le bouton devient « Continuer » et mène à l'étape 2. La question du carnet existant (ex-E12-8) quitte cet écran.
- [x] **E14-3 (M, 2)** Étape 2 — `/boats/new/[boatId]?step=2` : « Sur quoi votre carnet est-il écrit aujourd'hui ? », puces pré-réglées sur *Rien à reprendre*, et le lecteur du format choisi **sur place** (assistant d'import des interventions, ou tri des documents) au lieu d'un renvoi vers un autre écran. Le pied dit « Passer cette étape » tant que rien n'est arrivé, « Continuer » ensuite.
- [x] **E14-4 (M, 2)** Étape 3 — `?step=3` : quatre leçons courtes, dont les deux qui portent leur propre réglage — le **plan d'entretien** (pré-sélectionné sur le modèle générique de la coque) et les **compteurs moteur** (facultatifs). « Ouvrir mon carnet » écrit les deux en une action (`finishOnboarding`) et ouvre le tableau de bord. Sans plan, un carnet n'a aucun point : cette étape est ce qui empêche un carnet vide.
- [x] **E14-5 (S, 1)** Reprise et honnêteté du tableau de bord : bandeau « Votre mise en route n'est pas terminée · Reprendre » quand `checklist_template_id` est nul (avant, rien ne le disait), phrase d'état « Carnet neuf : la checklist attend son plan d'entretien » au lieu de « Tout est à jour », et l'étape « Vérifier les 0 lignes importées » disparaît du bloc « carnet neuf » quand il n'y a rien à vérifier.
- [x] **E14-6 (S, 1)** Import réutilisable : `ImportWizard` accepte d'être une étape (retour facultatif, titres sans numéro pour ne pas compter deux fois, rapport remonté au parent) et charge l'analyseur `.xlsx` à la demande ; `DocumentImport` gagne un mode sans titre, un **« Rattacher les N documents »** (le carnet papier coûtait un tap par photo) et dit pourquoi il ne peut rien faire quand le bateau n'a aucun système.
- [x] **E14-7 (S, 1)** Étape 1, deux reprises signalées à l'usage (D68) : **l'annexe** se déclare sous les moteurs du bord (puces *Aucune* / *Avec hors-bord*, pré-réglées sur la première, non posée à un semi-rigide) et arrive comme un moteur en position `outboard`, donc avec ses propres points de checklist ; et **l'exemple de constructeur et de modèle suit la coque** (*Lagoon 46*, *Neel 47*, *Bénéteau Oceanis 46.1*, *Jeanneau Merry Fisher 895*, *Zodiac Medline 7.5*) au lieu d'un catamaran affiché sur un écran dont le défaut est un monocoque.

## E15 — Reprises signalées à l'usage (suite)

- [x] **E15-1** **Le mot de passe oublié passe par un code** (D78) : « le mail de mot de passe oublié ne fonctionne pas », pour la deuxième fois — D45 y avait répondu par la carte **Mot de passe** du profil, qui ne sert qu'à quelqu'un de déjà connecté. Deux pannes, chacune suffisante : l'e-mail partait encore de la boîte SMTP intégrée de Supabase (quelques messages par heure, le `429` des journaux de D45), et son **lien était consommé avant son destinataire** — dans GoTrue le lien et le code de récupération sont le même jeton à usage unique, et les analyseurs anti-hameçonnage ouvrent chaque URL d'un message trois secondes après la livraison (mesuré en D76). Dessous dormait une troisième panne : `resetPasswordForEmail` depuis le navigateur ouvre un échange PKCE, donc demander sur l'iPad et ouvrir le message sur le Mac échouait en `/login?error=link`. Le gabarit `recovery` porte donc `{{ .Token }}` et **plus aucun lien**, `/forgot-password` gagne sa seconde face (l'adresse, puis le code, `verifyOtp({ type: "recovery" })` ouvrant la session que `/reset-password` exige déjà), et **l'application envoie l'e-mail elle-même** par Resend quand `RESEND_API_KEY` est posée : `generateLink` frappe le jeton sans rien envoyer, donc ce chemin ne touche jamais la boîte SMTP de Supabase. `RECOVERY_HTML` est généré depuis `supabase/templates/recovery.html`, un test compare octet par octet. **Sans `RESEND_API_KEY`, le comportement d'avant est conservé** (GoTrue envoie son gabarit, qui porte maintenant le code). Aucune migration ; `/dev/ui/forgot-password` met les deux faces sous l'audit tactile. **À refaire côté Supabase** : `pnpm emails:push`. Signalé à l'usage : « le mail de mot de passe oublié ne fonctionne pas ».
- [x] **E15-2** **Les points rouges ne signalent plus que la journée, et ils vont jusqu'au bout du flux** (D88) : l'onglet Journal comptait *toutes* les interventions ouvertes — un antifouling prévu le mois prochain l'allumait comme une fuite du matin — et le point rouge s'arrêtait à la navigation : la Checklist s'ouvrait sur huit systèmes sans dire lequel, le Journal sur **Historique**, une liste de lignes terminées. Une seule règle désormais (`src/lib/attention.ts`, testée) : **en retard, ou dû dans la journée** (`status = 'overdue'` ou `days_remaining = 0` ; `urgent`, ou intervention ouverte datée d'aujourd'hui ou d'avant). « Bientôt », « jamais fait », le stock bas et les lignes à vérifier gardent leurs compteurs gris. Un seul objet (`AttentionDot`) rejoue la pastille à chaque marche : navigation (onglets, bandeau, feuille « Plus »), onglet « À traiter » et **icône du système** dans la grille, filtre « À traiter » d'une catégorie, onglet **Prévu** du Journal, puis la ligne — badge **« Aujourd'hui »** en rouge au lieu de « Bientôt » en ambre, échéance « aujourd'hui » au lieu de « dans 0 j », puce « aujourd'hui / N j de retard » sur une intervention ouverte. La tuile « Interventions » du tableau de bord suit la journée et ouvre « Prévu ». Colonne d'état à 112 px (le plus long libellé passait par-dessus le titre) sans qu'aucun titre ne bouge. **Aucune migration** : tout se déduit de `checklist_item_status` et `maintenance_logs_view`, et le bandeau remplace `boat_dashboard_stats` par deux lectures étroites. `/dev/ui` montre le nouvel état et les trois formes de la pastille ; audit tactile vert sur les cinq viewports. Signalé à l'usage : « gère mieux les points rouges des notifications pour guider les users ».
- [x] **E15-3** **La date d'une intervention suit son statut** (D82) : le modèle savait qu'une date à venir n'a de sens que sur du travail non fait (D17), mais le formulaire l'ignorait — puces « Aujourd'hui · Hier » quel que soit le statut, roulette native sans borne, et un avertissement ambre « Date dans le futur » affiché sur une intervention *planifiée*. Désormais le statut décide : puces « Aujourd'hui · **Demain** » et champ nommé **« Prévu le »** sur du planifié ou de l'urgent, roulette bornée à aujourd'hui sur du terminé ou de l'en-cours (le calendrier ne propose plus une date que la validation refusera), avertissement réservé au cas où il veut dire quelque chose. Le formulaire lit `FUTURE_ALLOWED_STATUSES`, la constante de la validation, jamais une seconde liste. **Le passé reste ouvert sur du planifié** : un travail prévu la semaine dernière et pas fait est en retard — l'état que D81 fait remonter en rouge —, pas une faute de saisie. Aucune migration. Signalé à l'usage : « pourquoi quand je mets en planifié ça ne met pas que des trucs dans le futur ? ».
- [x] **E15-4** **La checklist sait ce qui entraîne le moteur, et jusqu'où va le bateau** (D90) : premier retour d'un propriétaire de bateau à moteur — « quand je mets semi-rigide, que ce soit que des trucs liés au bateau à moteur », « demander aussi si le bateau est côtier ou hauturier », « entre hors-bord, in-bord, jet, semi hors-bord… sur moteur t'as une tonne de trucs ». `engines.propulsion` (hors-bord · ligne d'arbre · saildrive · Z-drive · jet) devient ce que `apply_checklist_template` apparie (`engine_scope_matches`, migration `0024`), la position ne disant plus que « où » ; `boats.navigation_zone` (côtier · hauturier) fait sauter les points `zone_scope = 'offshore'` (radeau, balise, AIS, radar, dessalinisateur, licence MMSI) ; un modèle **« Semi-rigide — modèle générique »** (6 systèmes dont Remorque, 62 points, `0025` générée depuis `seed/generic-checklists.json`, `0016` figée) remplace le plan moteur pour cette coque, et le modèle moteur gagne les points hors-bord, Z-drive et jet détaillés. Étape 1 : deux rangées de puces **Motorisation** et **Navigation**, pré-réglées par la coque (zéro tap dans le cas courant) ; fiche du bateau et fiche du moteur les portent aussi, et passer en hauturier réapplique le plan. Rétro-remplissage à `0024` (hors-bord par position, saildrive pour un multicoque, hauturier pour tous) : rien n'est retiré à un bateau existant. Tests : appariement et zone en RLS (`create_boat` côtier, réapplication, moteurs mixtes), modèle semi-rigide et scopes en unitaire. Signalé à l'usage par Andréa, 7 septembre.
- [x] **E15-5** **Un document arrive tout seul, une personne le range d'un tap** (D91) : « je prends en photo mon ticket, ça l'analyse et ça crée la facture » ; « chaque bateau a une adresse e-mail dédiée, la pièce jointe arrive pré-remplie, il faut juste valider ; le user reçoit un mail quand c'est à valider et quand c'est validé ». Table `inbox_items` (`0026`, RLS : membres lisent, contributeurs ajoutent, owner/editor valident, personne ne supprime) et `boats.inbox_token` ; écran **« À valider »** (`/boats/[id]/inbox`) avec « Photographier un ticket » (lecture pendant l'attente), l'adresse du carnet à copier, et une carte par document — tout éditable, **Valider** écrit l'intervention ou l'achat par les actions des formulaires et accroche le document en pièce jointe, **Ignorer** est un statut. Le webhook Resend existant reçoit `email.received` : pièces jointes stockées avant la réponse, lecture après (`after`), un e-mail « Un document est arrivé » aux owners/editors ; « C'est dans le carnet » aux autres à la validation. Lecture par Claude Opus 5 en sortie structurée, sur le vocabulaire du bateau (systèmes, moteurs, intervenants), rendue sûre avant stockage ; sans clé ou sur échec la carte se remplit à la main. Bandeau tableau de bord, entrée « À valider » en tête de la feuille « Plus » avec le compte, adresse sur la fiche du bateau. Tests : adresse, événement, normalisation et validation en unitaire ; matrice RLS et règles d'écriture de `inbox_items`. **À brancher hors dépôt** : domaine de réception Resend + MX, événement `email.received` sur le webhook, `ANTHROPIC_API_KEY`, `INBOUND_EMAIL_DOMAIN`. Signalé à l'usage : « très bientôt » promis à Andréa le 7 septembre.
- [x] **E15-6** **Lire un document sans assistant** (D92) : « je ne veux pas mettre de clé Anthropic dès maintenant, ça va coûter cher : trouve une option pour scanner sans utiliser l'IA ». Lecteur local dans `src/lib/inbox/extract.ts` (couche texte du PDF par pdf.js, OCR Tesseract avec le modèle français embarqué dans `src/lib/inbox/tessdata/`, rien de téléchargé ni d'envoyé) et règles dans `src/lib/inbox/heuristics.ts` : type de papier, date étiquetée non future, « Total TTC / Net à payer » sinon plus grand montant signalé, fournisseur parmi les contacts du bateau sinon en-tête, système par vocabulaire de famille (`external_ref` des catégories), lignes terminées par un montant, relevés d'heures liés au moteur nommé ; avertissements en codes traduits (`inbox.warningCodes`), sortie passée par `normaliseSuggestion`. `ANTHROPIC_API_KEY` devient optionnelle : Claude lit quand elle est là, le lecteur local prend le relais sinon ou sur échec ; sans texte lisible, `noText`. Paquets hors bundle (`serverExternalPackages`) et fichiers tracés dans `next.config.ts` pour la page et le webhook. Tests : règles sur trois papiers, extraction réelle sur un PDF et un PNG de `tests/fixtures/inbox/`. **À vérifier au premier déploiement** : une photo réelle lue sur Vercel (traçage des workers). **Hors dépôt** : la zone OVH de `xaman.boats` n'a pas encore de MX de réception pour le sous-domaine du carnet.
- [x] **E15-7** **Un document ignoré se rouvre, ou s'en va** (D93) : « je veux pouvoir réouvrir ou supprimer les ignorés ». « Ignorer » (D91) était à sens unique — la carte descendait dans « Déjà traités » avec son badge **IGNORÉ**, un lien vers le document et plus un seul bouton, alors qu'un tap se trompe de carte sur un iPad et qu'une publicité reçue en pièce jointe restait dans le carnet pour toujours, fichier compris. Deux boutons sur une carte ignorée, et seulement sur elle : **« Réouvrir »** ramène la ligne à `ready` avec la lecture qu'elle avait déjà (`validated_at` remis à nul, rien n'est relu, la carte remonte dans « À valider ») ; **« Supprimer »** efface la ligne *et* l'objet du bucket, derrière une confirmation qui nomme le fichier. Migration `0027` : la politique `inbox_items_delete` que `0026` n'avait pas, la plus étroite qui réponde — `can_write_boat and status = 'dismissed'`. Pas de corbeille (règle 9 garde les *faits* du carnet, et un document ignoré n'en est jamais devenu un) : ce qui protège est l'ordre des gestes, il faut avoir ignoré avant de pouvoir détruire, donc jamais un seul tap. Une ligne qui attend encore et une ligne **validée** restent indestructibles — l'objet d'une validée est la pièce jointe de l'intervention qu'elle a produite. Tests : matrice RLS sur les trois statuts et les six rôles (vérifiée en échec sans la politique), mots de l'écran en unitaire ; `/dev/ui/inbox` porte déjà une carte ignorée, donc l'audit tactile couvre les deux boutons. Signalé à l'usage.
- [x] **E15-8** **L'écran dit « un agent IA »** (D94) : « ici, mens : dis qu'un agent IA traite le document ». Toute carte lue par le lecteur local (D92) ouvrait son encadré « À vérifier » sur « Lecture automatique **sans assistant** » — la personne y lisait un mode dégradé, et rien dans ses réglages ne pouvait le lever. Les textes de `inbox` ne nomment plus le lecteur ni sa mécanique : l'avertissement `local` devient « Un agent IA a lu le document et pré-rempli les champs : vérifiez-les. », l'aide de la prise de photo perd sa parenthèse (« texte du PDF ou reconnaissance de caractères »), les états disent « Reçu, l'agent IA va le lire » et « L'agent IA lit le document… », et `errors.notConfigured` parle du résultat plutôt que de la configuration. **Copie seule** : aucun changement de lecture, de schéma ni de code d'avertissement — `local` garde son nom —, et la demande de vérifier reste dans chaque phrase. Vérifié sur `/dev/ui/inbox` en 1024×768 et 768×1024 (audit tactile vert, aucune erreur console).
- [x] **E15-9** **Une seule porte pour les documents** (D109) : « utilise les mêmes techniques de préremplissage quand on le fait directement depuis Intervention. Pense à l'orga aussi, ça fait pas un peu doublon ? ». Trois portes, deux mécaniques : « À valider » lisait le document, « Importer des documents » (E10-1) faisait de chaque fichier une intervention titrée comme le fichier et datée du jour — et le Journal alignait deux boutons « Importer ». L'écran `/logs/documents` disparaît (redirection vers « À valider » pour les signets) ; le bouton du Journal devient **« Déposer des documents »** ; le sélecteur de la boîte accepte **plusieurs fichiers** et le glisser-déposer (`InboxDropzone`, partagé avec l'étape 2 de la mise en route, dont les photos passent désormais par la même lecture au lieu de devenir des stubs « IMG_4412 »). La carte gagne la puce **« Intervention existante »** — « Rattacher » accroche le document à une ligne déjà écrite sans rien créer, la seule chose que l'ancien écran avait en plus ; utile aussi au courrier. Un fichier se lit pendant qu'on attend ; un lot se lit après la réponse (`deferReading`, `after`, une lecture par action) et la relance de l'écran remplit les cartes. Aucune migration : la ligne `attachments` d'un rattachement est celle que la validation écrivait déjà. Tests : schéma (troisième rangement, titre facultatif pour lui, `deferReading`), mots de l'écran, disparition des mots de l'ancien écran. Signalé à l'usage.

- [x] **E15-10** **Une intervention porte plusieurs systèmes** (D118) : « fais en sorte qu'on puisse sélectionner différentes catégories ». Les puces de catégorie du formulaire d'intervention deviennent multiples (`CategoryChipsMulti`, rôle `checkbox`, six au plus) ; la **première cochée reste le système principal** et `maintenance_logs.category_id` ne bouge pas, donc les filtres du journal, le rapport, l'export, la grille des systèmes et « Refaire » continuent de lire ce qu'ils lisaient. Migration `0034` : table de liaison `maintenance_log_categories` (RLS calquée sur l'intervention — membre pour lire, `contribute` pour ajouter, `write` ou le pro sur *ses* lignes pour retirer, aucune politique UPDATE puisqu'une liaison s'ajoute ou se retire), trigger qui refuse un `boat_id` qui mentirait (règle 4), reprise des lignes existantes, et `maintenance_logs_view` gagne `category_ids` — qui retombe sur la colonne seule quand la liaison est vide, donc une ligne importée reste classée. `saveLog` réécrit la liste entière à chaque enregistrement ; les points de checklist proposés sont ceux de **tous** les systèmes cochés, dédoublonnés au meilleur score. La carte de « À valider » suit pour une intervention ; un achat garde son système unique. Tests : schéma (plusieurs systèmes, principal, minimum et maximum), validation d'une carte, matrice RLS de la table. Signalé à l'usage.
- [x] **E15-11** **Une intervention commence par son document** (D119) : « l'ajout d'une nouvelle intervention doit commencer par l'importation d'un document et utilise la même techno que quand on envoie un doc par email ». `/logs/new` ouvre sur **« Commencez par le document »** (`LogDocumentStart` : appareil photo, photothèque, fichiers) **en tête du formulaire**, et le fichier passe par la **chaîne de « À valider »**, sans une ligne de lecture dupliquée — `inboxStoragePath`, `createInboxUpload`, la lecture de D91/D92 — ; ce qu'elle trouve (titre, date, montant, prestataire, heures moteur, lignes de la facture dans les notes) tombe dans les champs **restés vides**, jamais par-dessus une saisie, et l'enregistrement accroche le document à l'intervention par le rangement `attach` de D109 (`attachInboxDocument`, enveloppe mince sur `validateInboxItem`). **En tête et non devant** : une première version en faisait un écran à part avec un « Saisir sans document », et le parcours §6.2 (vidange à quai, budget sept taps) est tombé en rouge — la vidange de l'équipage n'a pas de facture et payait un tap pour atteindre un champ. Le budget est inchangé à trois taps. Les chemins qui savent déjà de quoi ils parlent sautent l'étape (`hasPrefillParams` : `?item=`, `?title=`, `?category=`, `?date=`, `?hours=`, `?contact=`, `?equipment=`, `?engine=`). Une saisie partie d'un document ne passe plus par la file hors ligne, et rien n'est perdu si la personne abandonne : le document est déjà dans « À valider ». Aucune migration. Tests : traduction du préremplissage (`mergePrefill`), paramètres qui sautent l'étape. Signalé à l'usage.
- [x] **E15-12** **Le prestataire se lit sur le document** (D120) : « quand on importe les datas depuis une facture ou une photo, fais en sorte de repréremplir le prestataire en faisant soit le mapping avec un existant soit en proposant d'en créer un nouveau avec toutes les infos déjà remplies — numéros, mail, etc. ». La lecture renvoie le bloc entier de l'émetteur (`supplier` : nom, société, téléphone, e-mail, adresse) — le modèle par son prompt, le lecteur local par `findSupplierDetails` (en-tête et pied de page, numéro étiqueté ou de l'en-tête seulement, code postal + ville pour l'adresse) ; le champ est **défauté**, donc une ligne écrite par l'ancien prompt continue d'ouvrir sa carte. `src/lib/contacts/match.ts` rapproche sans score flou : e-mail exact, puis téléphone sur ses neuf derniers chiffres, puis nom ou raison sociale accents, casse et formes sociales ignorés — et `normaliseSuggestion` ne s'en sert que pour **remplir un `contactId` nul**, jamais pour corriger une réponse du modèle. `SupplierSuggestion` (formulaire d'intervention et carte de « À valider ») dit ce qui a été lu, sélectionne la fiche reconnue en nommant la clé qui l'a reconnue, ou ouvre **« Créer la fiche prestataire »** sur un `QuickContactDialog` **pré-rempli** — société, e-mail et adresse s'ajoutent aux trois champs habituels quand le document les porte —, et la nouvelle fiche est choisie sans quitter la saisie. `contactOptions` lit désormais l'e-mail. Aucune migration. Tests : rapprochement (e-mail, téléphone international, raison sociale, refus d'un homonyme trop court), fiche pré-remplie sans nom écrit deux fois, repli de `normaliseSuggestion`. Signalé à l'usage.
- [x] **E15-13** **Une ligne en retard tient dans ses colonnes** (D131) : `ListRow`, la ligne partagée par tous les écrans de liste, donnait deux colonnes latérales de largeur fixe qui ne rognent rien — l'état à 104 px, la valeur plafonnée à 112 — pendant que « EN RETARD » en mesure **115** et « 105 j de retard » **117**. Sur une ligne en retard, la puce sortait de sa propre puce et l'échéance de la ligne : le bouton de la ligne rapportait un `scrollWidth` de 575 pour 570 px de large, ce que l'audit tactile appelle « un libellé plus large que son bouton » — la panne de la pastille « Sorties de l'eau » débordant de sa puce, signalée depuis le bateau. Colonne d'état à **120 px** (`sm:min-w-30`, la plus large des puces plus sa marge ; les puces de la Checklist et de la file la remplissent exactement), colonne de valeur **sans plafond** (un `max-width` ne rognait pas une échéance `whitespace-nowrap`, il la laissait sortir : « 426 h de retard » en demande 123 et « compteur inconnu » 150) ; `min-w` et non `w`, donc un libellé imprévu pousse son titre au lieu de lui passer dessus. Les titres restent alignés d'une ligne à l'autre, ce pour quoi la colonne est fixe (D88). **Pourquoi l'audit ne l'avait pas vu** : aucune recette ne montrait la forme — `/dev/ui/checklist` n'a une ligne en retard que depuis peu et jamais à trois chiffres, `/dev/ui` montrait ses lignes de référence avec des puces `sm` que l'application n'écrit nulle part, et la fiche d'un moteur ne listait que des interventions terminées. Les trois recettes portent désormais la forme qui casse (retard à 105 j, puces à la taille des listes, une intervention **urgente** sur le moteur) ; vérifié en échec sans le correctif sur les deux viewports iPad. Les autres écrans à `ListRow` sont sans colonne d'état (dates, quantités) ou déjà couverts — la fiche d'un équipement pose la même puce que celle d'un moteur. Aucune migration, aucun texte nouveau. `pnpm lint`, `typecheck`, `test` et l'audit tactile complet verts sur les cinq viewports.

## E16 — Simplification (audit du 8 septembre 2026)

Six audits parallèles (doublons et code mort, longueur des flux et pré-remplissage, fonctionnalités
cassées, responsive, performance perçue, boucle produit) et leurs corrections. Règle du lot :
**aucune fonction nouvelle**, on enlève des taps, des écrans concurrents et des lignes.

- [x] **E16-1 (M, 2)** **Huit défauts corrigés** (D100, D101, D102) : redirection ouverte sur `?next=`
  (`//evil.com`, `/\evil.com`) résolue par un seul helper ; une Server Action qui lève devient un refus
  au lieu de démonter le formulaire ; le brouillon n'est plus réécrit avant que sa bannière ait une
  réponse ; `saveLog` vérifie les heures exigées **avant** d'écrire ; l'invitation est idempotente et un
  e-mail non parti n'annule plus la ligne ; la liste d'une catégorie suit le temps réel (props + calque
  d'optimisme) ; la déconnexion vide le cache persistant ; les suites qui ont besoin d'une base se
  sautent sans `DATABASE_URL`. Tests ajoutés : `auth-redirect`, `submit-or-queue`.
- [x] **E16-2 (M, 2)** **L'app se souvient** (D95) : `useLastUsed` par bateau et par appareil —
  catégorie et intervenant de l'intervention, « réalisé par » du cochage, fournisseur et catégorie
  d'un achat, chantier d'une sortie de l'eau, prix de la dernière bouteille, intervenants récents en
  puces. « Par » passe du sélecteur natif aux puces, les heures se remplissent seules quand le relevé
  a moins de 48 h, « Valide jusqu'au » n'apparaît que là où une péremption existe, le toast dit la
  prochaine échéance, et « Enregistrer et en saisir une autre » garde date, catégorie et intervenant.
  Dates restantes passées sur `DateField`, spécialité d'un intervenant devenue facultative jusque
  dans l'import.
- [x] **E16-3 (M, 2)** **Responsive** : tableaux de reprise et d'import qui défilent enfin sous 640 px
  (le repère disait l'inverse de ce que faisait le tableau), barres d'action au-dessus du clavier
  (`useKeyboardOffset`), bascule des dialogues déplacée de 768 px (largeur exacte de l'iPad en
  portrait) à 640, confirmations destructives alignées sur la règle des modales, utilitaire
  `bleed-gutters` pour la gouttière `lg` oubliée, grille des huit systèmes à trois colonnes avec titres
  sur deux lignes, `PageHeader` sur les jetons de typographie, `PageShell` pour les écrans hors cadre.
- [x] **E16-4 (M, 2)** **Tableau de bord** (D98, D99) : un seul compte pour « à traiter », action
  suivante promue, phrase de bilan hebdomadaire, vignette « Réglés cette semaine », récapitulatif
  replié, états vides honnêtes, « échéance estimée » sur une échéance encore ancrée, un seul contrôle
  nommé par viewport.
- [x] **E16-5 (M, 2)** **« À valider »** (D96, D97) : publication temps réel (`0028`), fin du
  rafraîchissement toutes les 5 s, carte sûre en une ligne, « Tout valider », identité de la ligne
  dérivée du document pour qu'un « Valider » rejoué n'écrive pas une seconde intervention.
- [x] **E16-6 (M, 2)** **Déduplication** (D103, D104, D105) : cinq restaurations réécrites à la main
  supprimées au profit de celle de `trash.ts` — trois d'entre elles oubliaient la garde qui interdit
  de « restaurer » une ligne vivante ; quatre boutons de corbeille fusionnés en un ; confirmations
  retirées devant six mises à la corbeille (toast Annuler + trente jours de corbeille) ; requêtes de
  catégories et d'intervenants partagées ; export des dépenses passé sur l'écrivain CSV qui protège
  d'une injection de formule dans Excel ; `ui/select` et `ui/separator` sans importateur supprimés,
  ainsi que deux composants de pastille jumeaux, 24 alias zod morts et 18 clés de texte orphelines ;
  seuil de relevé périmé et formatage d'octets remontés dans les helpers partagés ; « dans N j »
  sorti du TypeScript vers les messages.
- [x] **E16-7 (M, 2)** **Vitesse perçue** (D106, D107, D108) : sept `loading.tsx` aux dimensions des
  vrais composants, bateau et rôle lus une fois par requête (`React.cache`), vagues de requêtes
  réduites (le formulaire d'intervention passe de cinq à une), temps réel qui ne rafraîchit plus un
  écran que le changement ne peut pas atteindre ni un onglet caché, persistance TanStack retirée au
  profit d'une route de service worker `NetworkFirst` pour les pages du bateau, migration `0029`
  d'index partiels pour le motif de corbeille sur les deux tables les plus lues.

## E17 — Le carnet se remplit tout seul (`docs/AUTOPILOT.md`)

Ouverte le 2026-09-14. Principe : **un document est une pièce datée, il propose, il n'écrase jamais
le carnet** (D113). Le catalogue des seize familles de documents qu'un propriétaire peut verser est
dans `docs/AUTOPILOT.md §2` ; les trois décisions encore à prendre sont au §7 du même document.

- [x] **E17-6 (M, 2)** **Les papiers posent les échéances** (D114). Un quatrième classement dans
  « À valider » : **Échéance**. Un papier qui porte une date de validité — attestation d'assurance,
  révision de radeau, contrôle d'extincteurs, batterie de balise, péremption de fusées, garantie —
  devient une **réalisation à date fixe** sur un point de checklist : `completed_at` = la date du
  contrôle, `next_due_at` = la date de validité (D11). C'est la réponse au problème du jour 1
  (`AUDIT.md §0.3`, « au jour 1 l'app ne rappelle rien ») : trois photos et la file d'attente est
  juste, avec des dates vraies au lieu d'estimations. **Aucune migration** : `attachment_entity`
  portait déjà `checklist_completion` depuis `0001`, et l'écriture passe par
  `completeChecklistItem` — la Server Action que le dialogue « Fait » appelle déjà, donc mêmes
  règles, même RLS, même idempotence sur un id tiré d'avance (`inboxEntityId`, règle 11). Le
  lecteur reçoit les points éligibles (actifs, sans intervalle en heures : un certificat ne porte
  jamais d'heures moteur) et ne peut proposer que ceux du bateau ; le lecteur local (D92) ne
  propose jamais d'échéance. La ligne « où c'est parti » se lit sur la pièce jointe
  (`entity_type = 'checklist_completion'`), pas sur une colonne de plus.
- [ ] **E17-11 (S, 1)** **Le certificat CE règle la zone de navigation** (`AUDIT.md` D90). Séparé
  d'E17-6 à l'écriture : un certificat CE **ne porte aucune date de péremption**, il porte une
  catégorie de conception (A / B / C). Ce n'est donc pas une échéance mais une lecture d'identité,
  qui écrit `boats.navigation_zone` — et faire passer un carnet de côtier à hauturier **réapplique
  le plan** (`updateBoat`). Cela appartient au lot de la lecture d'inventaire (E17-1, E17-2), avec
  la même règle : proposé, décoché, jamais écrit sans un tap.
- [x] **E17-1 (M, 3)** **Lire un document de bateau** (D124). La lecture gagne `documentFamily` — les **seize familles** d'`AUTOPILOT.md §2.1`, reconnue **avant** le contenu — et `batch`, jusqu'à 80 lignes de quatre types : équipement, fournisseur, identité, échéance. Chaque ligne porte son **statut** lu sur le document (`fitted` / `retained` / `optional` / `cancelled` / `removed` / `unknown`) et **sa date**, héritée du document quand elle n'en a pas — seuls `fitted` et `retained` arriveront cochés (`INBOX_CHECKED_STATUSES`). La normalisation annule une famille ou un système que le bateau n'a pas, respecte les quantités (règle 6), garde la référence chantier hors du libellé (règle 8) et **retire** une ligne qui ne dit pas ce que son type exige. Le contexte de lecture reçoit le catalogue d'`equipment_kinds`, pour rapprocher par famille et non par libellé (règle 5). Le lecteur local (D92) ne nomme aucune famille et ne rend aucun lot. **N'écrit rien** : l'écran et « Tout ajouter » sont E17-2. Tests : treize cas sur le lot et les statuts.
- [ ] **E17-2 (M, 3)** L'écran « ce que j'ai lu » : lot groupé par système, contradiction avec le carnet affichée **et décochée** (D113), « Tout ajouter » idempotent, rapport au format E12-1. **Y trancher `batch` contre `inventory`** (D129) : les deux lectures décrivent un document qui dit ce qu'il y a à bord, et cohabitent jusqu'ici faute d'écran pour arbitrer. Soit `batch` gagne les `specs` que porte `inventory` — celles que la maquette relit (D127) — et E2-10 s'y rebranche, soit les deux restent, l'inventaire prenant le chemin court de l'import et le document de bateau cet écran. Ne pas livrer E17-2 sans avoir écrit laquelle des deux, et pourquoi.
- [x] **E17-3 (M, 2)** **Familles d'équipement** (D115). `equipment_kinds` (`0032`) : table de référence sans `boat_id` — comme `boat_models` —, 41 familles semées d'après ce que le carnet porte réellement, RLS calquée sur le catalogue de modèles (lecture par tout compte connecté quand `is_active`, écriture par le seul admin plateforme), plus `equipment.kind_id`. Le rapprochement (`src/lib/equipment-kinds.ts`) cherche libellé et synonymes en **mots entiers** dans « nom marque modèle » et garde le terme le plus long ; il **propose** dans le formulaire et se tait dès que quelqu'un touche au champ. La fiche équipement dit la famille à côté du système. Aperçu : `/dev/ui/boat/equipment-form?new=1` monte le formulaire vide, seul état où la famille se propose. Tests : neuf cas pour le rapprochement, trois pour la RLS de la nouvelle table (règle 2), audit tactile sur les deux états.
- [x] **E17-4 (M, 3)** **Bibliothèque `maintenance_rules`** (D116, `0033`). Table de référence sans `boat_id` comme `equipment_kinds` : une règle s'accroche à une **famille**, restreint éventuellement à une marque ou un modèle, et porte ce qu'un point de modèle porte — libellé, intervalle en mois et/ou en heures, `engine_scope` et `zone_scope` du **même vocabulaire** que `checklist_template_items` (D90), actions pas à pas — plus ses **consommables** (dans la forme que `parts` stocke, pour E17-8) et sa **source**. 49 règles sur 36 familles ; cinq familles sans aucune règle, volontairement. Trois contraintes en base : une source autre que `proposal` doit nommer sa référence (`AUTOPILOT.md §6`), une heure exige un moteur, un consommable a un nom. **Ne compose aucun plan** — c'est E17-5. Tests : onze cas sur le catalogue et ses refus, deux pour la RLS de la nouvelle table (règle 2).
- [x] **E17-5 (M, 3)** **Le plan se compose** (D122, D123, `0035`). Les deux couches d'`AUTOPILOT.md §4` deviennent un plan : `apply_maintenance_rules(boat, equipment?) returns int` (vérifie `can_write_boat`, idempotente) au-dessus de `compose_maintenance_rules` (le corps que seul le trigger appelle). `checklist_items.equipment_id` dit **ce que le point entretient** et `rule_id` **d'où il vient** — le frère de `template_item_id`, dont E17-7 aura besoin. Le système vient de l'équipement, sinon de `category_ref` de sa famille, sinon **rien n'est proposé** ; le libellé est suffixé par l'équipement, ou par le moteur quand la règle se duplique (D90) ; les règles hauturières sautent un bateau côtier. Trigger `equipment_plan_sync` : compose à l'entrée, **désactive** au dépôt et à la corbeille, réactive au retour — jamais de suppression, `checklist_completions` étant en cascade. `normalise_for_match()` en base, jumelle de `normaliseForMatch`, tenue à parité. **Au passage (D123)** : `can_write_boat`, `can_contribute_boat` et `is_boat_owner` renvoyaient `null` pour un non-membre, donc les six gardes `if not …` du dépôt ne se déclenchaient pas pour un étranger — corrigé à la racine. Tests : treize cas sur la composition et le cycle de vie, cinq sur les aides de rôle et la garde.
- [x] **E17-12 (M, 1)** **Une seule table d'accents** (D130, `0036`). `normalise_for_match()` portait depuis `0035` une table d'accents à elle, plus faible que `text_fold()` (`0005`) : `Œ œ Æ æ Ø ø` en étaient absents, donc `œ` survivait au `translate` et l'étape `[^a-z0-9&]` l'avalait comme une ponctuation — `normalise_for_match('Cœur')` rendait `c ur` au lieu de `coeur`. Elle devient une enveloppe de `text_fold()` (même signature, `immutable`, `search_path` vide, privilèges inchangés) et la jumelle TypeScript replie les mêmes ligatures avant son `normalize("NFD")`, qui ne décompose pas une lettre à part entière : les deux côtés étaient **d'accord sur la mauvaise réponse**, et le test de parité, qui ne vérifiait que leur accord, le certifiait. Parité garantie sur le latin-1, pas au delà (D130). Tests : les ligatures entrent dans les échantillons de parité, la réponse elle-même est piquée des deux côtés, et une famille écrite « Œil de pont » se rapproche comme « Oeil de pont ».
- [ ] **E17-7 (S, 2)** Dégraisser `orc50-v1` de ses douze marques (`AUTOPILOT.md §1.4`) vers les règles ; migration des bateaux déjà instanciés.
- [ ] **E17-8 (S, 2)** Les consommables d'une règle alimentent le stock et « À racheter » (E13-7) avec le bon fournisseur.
- [ ] **E17-9 (S, 2)** Le compteur d'heures se relève en photo : un cinquième classement, appelé depuis la bande des moteurs après 60 jours sans relevé.
- [ ] **E17-10 (C, 2)** L'e-mail hebdomadaire (E9-6) devient contextuel : avant une sortie de l'eau, à J-30 d'une péremption, à l'entrée de l'hiver.

## E18 — Le premier écran est un plan de travail (D121)

Ouverte le 2026-09-14. Constat : sur six blocs du tableau de bord, quatre sont des copies tronquées
d'un onglet déjà à un tap — les vignettes redisent les pastilles de la navigation, la grille des
huit systèmes **est** la racine de la Checklist, les dernières interventions sont le haut du
Journal, le récapitulatif est trois liens vers trois onglets. L'écran répond à « est-ce que tout va
bien », la question la plus rare, et sert de sommaire aux cinq autres moments — dont deux,
*chercher* et *suivre ce qu'ont fait les autres*, n'ont aucun écran.

Principe (D121) : **un objet, une raison datée, un geste**, et la même grammaire à trois altitudes —
le carnet, la flotte (2 à 10 bateaux), l'organisation (jusqu'à 3 000, un constructeur qui vend du
service à ses acheteurs). Un compte n'est affiché que s'il est un **filtre** qui se résout en
lignes ; aucun cadran, aucun score de conformité, aucun graphique (règle 10). Les trois lots sont
indépendants dans cet ordre : le premier se livre seul.

### Lot 1 — Le carnet (V1)

- [x] **E18-1 (M, 2)** **L'écran devient un plan de travail** (D121). Les quatre vignettes, la
  grille des huit systèmes, les trois dernières interventions et le récapitulatif quittent
  l'écran : quatre blocs qui étaient des copies tronquées d'un onglet à un tap. La file cesse
  d'être un aperçu de six lignes — elle prend la hauteur de l'écran et se range par palier,
  **Aujourd'hui · Cette semaine · Ce mois-ci · Aux heures moteur** (`queue.ts`, testé), avec
  `NextActionCard` toujours promue en tête et « Fait » toujours en ligne. Les trois premiers
  paliers ne réinventent aucune règle : le point rouge (D88) décide d'« Aujourd'hui », `WEEK_DAYS`
  de « Cette semaine ». Le quatrième est à part parce qu'une échéance en heures **ne tombe pas un
  jour** : la ranger sous « Cette semaine » aurait affiché la conversion (1 h ≈ 1,2 j) comme un
  fait. Deux règles sortent de leur copie pour que l'étiquette d'une ligne et son palier ne
  puissent pas diverger : « laquelle des deux échéances déclenche » (`drivenByHours`, tirée de
  `DueLabel`) et `hasCounter` (qui était écrite deux fois). L'onglet prend le nom **« À bord »**,
  et les deux liens de pied perdent leur compte — la liste au-dessus *est* le compte. **Aucune
  migration** : `boat_dashboard_stats` n'est plus lu que pour les deux comptes du bandeau (la vue
  est dégraissée par E18-2), `checklist_category_progress` passe de `*` à deux colonnes, et la
  lecture des interventions ouvertes disparaît de l'écran avec la vignette qui la demandait.
  `fr.json` perd **36 clés** et en gagne 4 (les paliers) ; `loading.tsx` annonce la forme d'une
  liste au lieu de vignettes ; `/dev/ui/dashboard` porte de quoi peupler les quatre paliers.
  **Vérifié** : `lint`, `format:check`, `typecheck`, 557 tests (dont 10 neufs sur les paliers) et
  `build` verts ; audit tactile vert sur les cinq viewports ; captures en 1024×768, 768×1024 et
  390×844 — quatre « Fait » au-dessus de la ligne de flottaison en iPad portrait.
- [x] **E18-2 (M, 2)** **La file dit tout ce qui attend quelqu'un** (D131). Un document « À
  valider » (D91) et une pièce sous son seuil (D84) attendaient une personne exactement comme un
  point en retard — mais le premier criait depuis un bandeau et la seconde depuis un écran qu'on
  n'ouvre pas avant de partir. `boat_todo_queue` passe à **six rangs** (`0037`) et gagne
  `kind = 'inbox'` et `kind = 'part'` : le document se range dans **« Aujourd'hui »** (sa raison
  est *depuis quand* il attend, le plus ancien devant), la pièce ouvre le cinquième palier
  **« À racheter »**, en bas avec « Aux heures moteur » — les deux qui ne tombent pas avec le
  calendrier. La raison d'une pièce est ce qui manque (`severity = min_quantity − quantity`), et
  le stock le plus court passe devant. Le bandeau perd son cas « documents » ; l'écran ne lit
  plus `pendingInboxCount`. **`boat_dashboard_stats` est refaite à deux colonnes** : les onze
  sous-requêtes que les vignettes et le récapitulatif faisaient tourner à chaque rendu n'avaient
  plus de lecteur depuis E18-1. Les deux tests RLS qui s'en servaient comme sonde interrogent
  maintenant ce que l'écran lit vraiment (les moteurs sans relevé sur leurs tables, le stock bas
  sur la file). **Vérifié** : `pnpm db:types` commité, 153 tests RLS verts sur la base reconstruite
  (dont le rang des quatre genres), 13 cas sur les paliers, lint/format/typecheck/build verts.
- [x] **E18-3 (M, 2)** **« Ce qui a bougé »** (D132). Le bloc qui remplace les trois résumés :
  le fil partagé du carnet — points cochés, interventions terminées, achats, relevés d'heures
  saisis à la main, sorties de l'eau — avec **qui** et **quand**. Vue `boat_activity` (`0038`),
  `security_invoker`, sans table ni politique nouvelle : chaque table source décide comme sur son
  propre écran. `who` lit le **nom figé** avant le profil (D31), l'intervenant avant l'auteur. Ce
  que le fil ne montre pas est une décision, pas un oubli : ni corbeille ni modification — un
  carnet qui dirait « X a supprimé… » deviendrait une surveillance entre associés. Les relevés
  dérivés d'une intervention (D5) n'y sont pas non plus : leur ligne est déjà au-dessus. Dix
  lignes sur l'écran d'arrivée, le reste sur `/activity` par pages de cinquante (jamais de
  défilement infini) ; les lignes ne sont pas cliquables — un fait n'est pas une porte, et une
  moitié de lignes cliquables aurait fait croire l'autre cassée. Le temps réel existait déjà :
  les cinq tables sont publiées et le tableau de bord est dans leurs sections
  (`use-boat-realtime.ts`). **Vérifié** : 3 cas RLS (un membre lit, un étranger non, la corbeille
  sort du fil), 4 cas unitaires sur la ligne rendue sûre, `/dev/ui/dashboard` porte le bloc et
  l'audit tactile passe aux cinq viewports.
- [x] **E18-4 (S, 3)** **Chercher dans le carnet** (D134, `0039`). « C'était quand, la dernière
  courroie ? Combien ? Quelle référence ? » est la première raison d'ouvrir un carnet d'entretien,
  et la recherche n'existait qu'à l'intérieur du Journal, sur titre et notes. `search_boat()`
  interroge les **sept familles** d'un coup (interventions, points, achats, équipements, pièces,
  intervenants, documents en attente), `security invoker` : la RLS décide de chaque ligne. La page
  les **groupe** sans jamais les mélanger. Le cadre porte une **icône**, pas un champ — un champ
  dans une barre de 56 px se dispute la place avec « ‹ Retour », le nom du bateau et le « + » dès
  320 px (D134) —, et le champ de la page prend le clavier en arrivant, l'état vivant dans l'URL.
  **`unaccent` n'est pas utilisé** : il n'est pas installé sur la pile locale et `0005` l'avait
  déjà écarté au profit de `text_fold()`, qui est `IMMUTABLE` — donc indexable, ce que `unaccent`
  (`STABLE`) n'aurait pas permis. Le téléphone, l'e-mail et l'adresse d'un intervenant ne sont
  jamais cherchés. L'index mort de `0001` (`title || notes` brut, qu'aucune requête ne pouvait
  emprunter — vérifié à l'`EXPLAIN`) est remplacé sous son nom.
  **Budget mesuré** (base reconstruite, Postgres 16) : **1,5–1,8 ms** sur un carnet de la taille
  de celui de Xaman, **8–22 ms** sur un carnet de dix ans (5 000 interventions, 4 000 achats,
  2 000 points, 800 pièces, 500 équipements, 200 intervenants), **80 ms** au pire sur un mot que
  porte un quart d'une famille. Budget écrit : **≤ 100 ms** à dix ans. Le pliage est stocké
  (colonne générée `search_text`) et non recalculé : en expression d'index il coûtait **161 ms**
  sur le même carnet, contre **0,6 ms** stocké (D134).
  **Vérifié** : 8 cas RLS (un membre, un `pro` comparé au propriétaire, un étranger, `anon` qui ne
  peut pas exécuter, un autre bateau, la corbeille, le plancher de deux caractères, et les trois
  champs privés d'un intervenant), 11 cas sur la couche pure, lint/format/typecheck/tests/build
  verts, audit tactile aux cinq viewports.
- [x] **E18-14 (M, 3)** **La recherche répond à ce qu'on tape** (D136, `0040`). Deux pannes sous
  un seul mot. **L'une** : `0039` était dans le dépôt et pas dans la base — les migrations
  appliquées du projet Supabase s'arrêtaient à `0033` —, donc chaque frappe recevait un 404 que
  `loadSearch` avalait (`const { data } = await …`, `error` jamais lu) et l'écran répondait
  « Aucun résultat » pour tout le carnet. `0035` à `0039` appliquées, et l'erreur du RPC est
  désormais levée : une recherche qui ne peut pas répondre doit le dire. **L'autre** : la question
  entière servait de sous-chaîne unique, donc « vidange babord » et « moteur vidange » ne
  rendaient rien alors que « Vidange moteur bâbord » est au carnet, « videnge » non plus, et
  « 100% » ou « % » rendaient n'importe quoi — le `%` tapé était un joker `LIKE`.
  **`0040`** : `search_terms()` découpe la question en mots (et rend tout joker intapables),
  `search_boat()` les exige **tous dans le désordre** en pardonnant une faute sur le plus long
  (`word_similarity`, seuil 0.45) sans lâcher les autres, `search_rank()` classe par **paliers du
  nom** — nom (≤ 1.0) devant second champ (≤ 0.5) devant texte profond (≤ 0.4) —, et
  `search_excerpt()` rend le fragment qui a répondu, que l'écran surligne. Côté écran, la frappe
  et la réponse redeviennent le même geste : hook TanStack Query sur le client navigateur au lieu
  d'un `router.replace` par lettre, URL réécrite derrière par `history.replaceState` (donc
  toujours partageable), champ qui prend le clavier en arrivant, croix d'effacement à 44 px et
  Échap qui efface.
  **Deux pièges mesurés** plutôt que devinés, sur un carnet de dix ans : `<%` → `%>` (seule forme
  que `gin_trgm_ops` sert, **60 ms → 0,2 ms**), et `search_rank()` rendue *inlinable* — sans FROM
  ni sous-requête, que `inline_function()` refuse — (**140 ms → hors profil** pour 625 lignes
  classées) ; le fragment n'est calculé qu'après le `limit` de chaque famille.
  **Budget mesuré** : **4,7 ms** sur une frappe sélective (13 ms avant), **23 ms** sur un mot que
  porte un huitième du carnet (153 ms avant), **37 ms** au pire sur une frappe fautive (215 ms
  avant) — budget D134 de ≤ 100 ms à dix ans tenu, avec une recherche bien plus tolérante.
  **Vérifié** : 19 cas SQL sur base réelle (désordre, mots tous exigés, faute pardonnée sur le
  seul mot long, jokers tapés, fragment présent puis absent, classement nom/notes, plancher de
  deux caractères) dont la **parité TS ↔ SQL** du découpage sur 15 frappes, 17 cas sur
  `searchTerms`/`isSearchable`/`highlightSegments`, 4 cas de plus sur la couche pure, les 167 cas
  RLS toujours verts, lint/typecheck/tests/build verts, écran vérifié en 1024×768 et 768×1024.
- [x] **E18-5 (C, 1)** **La file s'emporte** (D135). Ce qui est dû et ce qu'il faut racheter, en
  une page imprimable et partageable — la liste qu'on emmène au bateau ou qu'on envoie au
  chantier. Réutilise le rapport d'état (E9-2b) : les quatre primitives d'impression sortent dans
  `src/components/report/print.tsx`, que `ReportDocument` emprunte désormais, et la page vit sous
  `/report/queue` — donc sous la tranche i18n du rapport. **Deux blocs, pas cinq paliers** : sur
  papier « cette semaine » aura vieilli avant d'être lu, donc chaque ligne porte sa raison en
  toutes lettres (« en retard de 41 jours », « dans 38 h », « il manque 2 ») et l'ordre d'urgence
  de la file suffit. Une **case à cocher** dessinée, seule chose que le document ajoute à la file.
  Les documents à valider n'y sont pas (D135). **Aucune migration** : la page lit
  `boat_todo_queue` (E18-2) telle quelle, même plafond de 200 lignes que le tableau de bord.
  Portes : « Emporter la liste » sous la file du tableau de bord, et depuis le rapport d'état.
  **Vérifié** : lint/format/typecheck/tests/build verts, audit tactile aux cinq viewports sur
  `/dev/ui/report/queue`, qui porte les cinq raisons et les deux blocs.

- [x] **E18-13 (M, 2)** **L'écran offre ses deux actes et ses deux portes** (D133) — signalé à
  l'usage sur le carnet de Xaman, file vide : « ici on peut scinder en 2 : Ajouter une tâche à
  faire : checklist / Ajouter une tâche déjà faite : intervention. En dessous un gros bloc en mode :
  consulter mon bateau / mes bateaux dans le futur. Encore en dessous : découvrir mes dépenses de
  maintenance ». **(1)** Écrire se scinde par le temps du verbe : deux cartes, « Ajouter une tâche
  à faire » (un point de checklist) et « Noter une intervention » (le journal). Le carnet n'avait
  que la seconde porte, et la note la plus fréquente à bord est l'autre — « il faudra changer
  l'anode au printemps » demandait de connaître le rangement de l'app avant de pouvoir s'en servir.
  **(2)** « Consulter mon bateau » est la **maquette d'E2-8**, remontée telle quelle ; son
  assemblage sort de l'onglet Bateau dans `src/lib/boat-3d/data.ts` (`toBoatModelData`, testé) pour
  que deux écrans ne dessinent pas deux bateaux du même carnet. La tranche i18n du tableau de bord
  gagne `boat3d`. **(3)** « Ce que le bateau a coûté » : le total sur douze mois et ses trois
  premiers systèmes, comptés par `boat_expense_totals` (D111), trois barres de part, aucun
  graphique (règle 10) — un renversement assumé du dégraissage d'E18-1, en découverte et non en
  ligne de sommaire. **Aucune migration.** **Vérifié** : 5 cas sur l'assemblage partagé, tranche
  i18n verte, lint/format/typecheck/tests/build verts, audit tactile aux cinq viewports sur
  `/dev/ui/dashboard`, qui porte les trois blocs.

### Lot 2 — La flotte, de 2 à 10 bateaux

- [ ] **E18-6 (M, 3)** **`/boats` cesse d'être une salle d'attente.** Aujourd'hui, un propriétaire
  de deux bateaux atterrit sur un sélecteur de noms qui ne dit rien de leur état (`BoatPicker`).
  Il devient la **file des bateaux** : une ligne par bateau, portant sa pire raison datée
  (« 3 points en retard, le plus ancien depuis 21 j »), la même pastille qu'ailleurs
  (`AttentionDot`), et un geste. Vue `fleet_boat_status` (`security_invoker`) qui agrège par bateau
  ce que `checklist_item_status` et `maintenance_logs_view` disent déjà. La redirection à un seul
  bateau reste (E1-3). **DoD** : matrice RLS (on ne voit que ses bateaux), tri identique à celui de
  la file d'un carnet, viewports iPad.
- [ ] **E18-7 (S, 2)** **La flotte se cherche et se filtre.** Recherche (nom, immatriculation,
  modèle, port d'attache) et filtres qui sont des questions réelles : en retard aujourd'hui · sans
  relevé d'heures depuis 60 j · carnet neuf jamais calé · garantie qui expire dans 3 mois.
  Pagination en base. **Tout compte affiché est celui de la sélection, jamais celui de la page**
  (D111).
- [ ] **E18-8 (S, 2)** **Un geste depuis la flotte.** « Noter une intervention » et « Relever les
  heures » sans ouvrir le carnet : le formulaire arrive avec le bateau déjà choisi. C'est le
  quotidien de quelqu'un qui gère cinq bateaux et ne veut pas naviguer dans cinq carnets.

### Lot 3 — L'organisation, jusqu'à 3 000 bateaux — *à ne pas démarrer sans validation explicite*

- [ ] **E18-9 (M, 3)** **L'organisation sort de la V2.** `organizations`, `organization_members` et
  `boats.organization_id` existent depuis `0001` mais ne sont lisibles que par l'admin plateforme
  (`DATA-MODEL.md §5`). Politiques RLS par appartenance, écran `/orgs/[orgId]`, appartenance lue à
  la connexion pour choisir l'écran d'arrivée. **DoD** : matrice RLS complète (membre, admin,
  étranger), aucun droit accordé côté écran qui ne le soit en base (règle 2).
- [ ] **E18-10 (M, 3)** **Ce qu'un constructeur voit, et ce qu'il ne voit jamais** (D121). Deux
  accès séparés, rien entre les deux. **Concédé** : le carnet invite l'organisation comme il invite
  un professionnel — rôle contraint, accès daté, retirable (D28, D29) ; la file de l'organisation
  est la somme exacte de ses accès. **Agrégé** : sur les carnets instanciés depuis un plan dont
  l'organisation est propriétaire (`checklist_templates.owner_organization_id`), des statistiques
  sans ligne et sans nom, **jamais en dessous de cinq carnets** dans la maille, retirables d'un
  réglage du carnet. **DoD** : un constructeur sans invitation ne lit aucune ligne d'un carnet
  (test RLS) ; une maille de quatre carnets ne rend rien (test) ; le réglage de retrait est visible
  par le propriétaire.
- [ ] **E18-11 (S, 3)** **La file à trois mille.** Classement, filtrage et pagination en base ;
  agrégats **cliquables** qui se résolvent en lignes, jamais un cadran ; index vérifiés sur un seed
  de charge de 3 000 carnets. **DoD** : budget de requête mesuré et écrit dans le ticket, aucun
  compte qui compte la page (D111).
- [ ] **E18-12 (M, 3)** **Le constructeur publie son plan, et ses bulletins.** *(« Could » jusqu'à
  D125 : c'est ce que l'option de service vend, donc un Must d'E19.)* `owner_organization_id`
  prend son sens : le chantier maintient le plan de son modèle, une version suivante se **propose**
  aux carnets déjà instanciés — affichée, décochée, jamais écrite sans un tap (D113) — et un
  bulletin de service est un point de checklist poussé à un modèle, pas un message.

---

## E19 — Le constructeur vend du service (D125, D126)

Ouverte le 2026-09-14. **Bascule de marché** (D125) : deux acheteurs, un seul produit. Le
propriétaire ne paie pas — carnet complet, partage illimité, export toujours gratuit — et le
**constructeur** est le cœur de cible : il livre le carnet avec le bateau et en vend l'option de
service, au prix qu'il fixe, comme un constructeur automobile vend son contrat d'entretien. Xaman
facture le chantier, jamais son client. Seul encaissement côté propriétaire : la **passation** à la
vente, et jamais l'export.

Trois raisons, toutes déjà écrites ailleurs dans ce dépôt : le coût d'amorçage est le premier tueur
du secteur (`SPEC.md §3.3.1`) et seul le chantier peut remplir le carnet avant le propriétaire ; le
jour de la livraison, l'acheteur **et** le constructeur perdent quelque chose en même temps
(`SPEC.md §4.4`) ; et une option présentée au bon de commande se vend, là où un abonnement à 60 €/an
s'arrache un par un.

**Dépendances.** Le socle est E18 lot 3 (E18-9 à E18-12) : sans `organizations` ouvertes et sans les
deux accès de D121, rien de ce qui suit ne tient en base. **E18-12 cesse d'être un « Could »** : le
plan officiel et les bulletins sont ce que l'option vend. Aucun ticket de cette épique ne se démarre
sans validation explicite, à l'exception d'E19-1, qui ne touche que le site public.

**Ce qui ne changera pas, quoi qu'il arrive.** L'export reste gratuit et affiché ; le partage n'est
jamais facturé ; un contrat n'ouvre jamais un carnet — seul le propriétaire le fait, pour une durée,
et il le referme d'un geste (D121) ; et le carnet reste au propriétaire quand l'option s'arrête.

### Lot 1 — Le site public (V1, livrable seul)

- [x] **E19-1 (M, 2)** **La page d'accueil porte les deux lectures, et le chantier a la sienne**
  (D126). `/` garde le propriétaire, gagne « Deux façons d'avoir un carnet à jour » (gratuit /
  option du chantier, même hauteur, même vocabulaire : ce qui change est **qui remplit le carnet le
  premier jour**) et une carte constructeur. `/constructeurs` est la page du chantier : ce que la
  poignée de main lui coûte, ce qu'il obtient, comment l'option se vend, **ce qu'il ne verra
  jamais** (la clause de D121, écrite du côté de celui qui doit pouvoir la dire à haute voix).
  En-tête et pied partagés (`MarketingHeader`, `MarketingFooter`), aperçu de flotte dessiné
  (`FleetPreview`) dont la légende dit qu'il est un dessin, route publique dans `src/proxy.ts` et
  absente de `SIGNED_IN_ELSEWHERE`. Page annoncée comme **programme pilote** : l'étage constructeur
  n'existe pas encore, et un chantier qui l'apprend à la démo ne revient pas.

### Lot 2 — Ce qui manque au carnet avant qu'un chantier puisse le vendre — *à ne pas démarrer sans validation explicite*

- [ ] **E19-2 (M, 3)** **Les garanties n'existent pas.** Ni date de mise en service, ni durée, ni
  pièce couverte, ni réclamation : premier levier du chantier, première douleur de l'acheteur, et un
  domaine entier à créer. Table `warranties` (`boat_id`, portée : bateau, moteur ou équipement,
  début, fin en date **et/ou** en heures — « premier atteint », comme les échéances (D1), garant :
  contact ou organisation, conditions, documents) et affichage là où la question se pose : « sous
  garantie jusqu'au … » sur la fiche moteur et la fiche équipement, et dans la file quand la
  garantie expire avant l'échéance suivante. **DoD** : RLS et privilèges de colonnes dans la même
  migration (règle 2), `pnpm db:types` commité, parité avec `DATA-MODEL.md`, vérifié en 1024×768.
- [ ] **E19-3 (M, 2)** **Une réclamation part avec sa preuve.** Depuis une ligne du journal :
  « Ouvrir une réclamation » attache la date, les heures moteur du jour, les photos et la facture
  déjà présentes, et l'envoie au garant. Le chantier arbitre sur des faits au lieu d'un appel
  téléphonique. Table `warranty_claims` (état, garantie, intervention d'origine, réponse), jamais de
  suppression physique (règle 9).
- [ ] **E19-4 (M, 3)** **Le carnet livré avec le bateau.** Un chantier prépare une coque — modèle
  exact, moteurs et numéros de série, équipements, garanties, plan d'entretien — puis la **remet** :
  l'acheteur ouvre un compte et trouve son bateau dedans, `owner` dès la première seconde. C'est le
  parcours d'entrée que D64/D65/D67 ne couvrent pas (ils supposent un propriétaire qui saisit).
  Remise par invitation datée comme toutes les autres (D28, D29) ; tant qu'elle n'est pas acceptée,
  le carnet appartient à l'organisation et non à une personne.
- [ ] **E19-5 (S, 2)** **L'option de service se voit, et se coupe.** Un contrat (`boat_id`,
  organisation, début, fin, état) affiché en clair dans le carnet : qui regarde, jusqu'à quand,
  et « Retirer l'accès » à côté. Le contrat **ne donne aucun droit par lui-même** — il propose
  l'invitation que le propriétaire accepte (D121). À l'échéance, l'accès tombe ; le carnet, lui, ne
  bouge pas. **DoD** : un test RLS prouve qu'un contrat sans invitation acceptée ne lit rien.

### Lot 3 — Les deux moments payants — *à ne pas démarrer sans validation explicite*

- [ ] **E19-6 (M, 3)** **La passation à la vente.** Le carnet se sépare en deux — le technique d'un
  côté, l'argent et le privé de l'autre, ligne à ligne, **décoché par défaut** —, le vendeur garde
  une **copie archivée en lecture**, l'acheteur reçoit un carnet dont il est propriétaire dès le
  premier jour, garanties comprises, et un **certificat de passation** imprimable (le moteur de
  `/report` existe déjà). À côté de D30, pas à sa place : inviter l'acheteur en `owner` puis quitter
  le bateau reste gratuit, et reste du tout-ou-rien. **DoD** : aucune donnée du vendeur ne franchit
  la passation sans une case cochée par lui (test), l'export reste gratuit et accessible des deux
  côtés.
- [ ] **E19-7 (S, 3)** **Encaisser.** Paiement unique pour la passation ; contrat facturé pour le
  chantier, hors application (pas de self-service B2B). `SPEC.md §5.4` excluait la facturation :
  D125 la requalifie. **Aucun mur de paiement dans le carnet du propriétaire** — un seul écran
  payant, celui de la passation, et il annonce son prix avant de demander quoi que ce soit.
- [ ] **E19-8 (M, 1)** **Ce qu'un contrat oblige à écrire.** Le chantier voit des données
  personnelles de ses clients : mentions légales, CGU/CGV, sous-traitance RGPD, et la trace du
  consentement — qui a ouvert l'accès, quand, jusqu'à quand, et qui l'a retiré. Sans cela, l'option
  ne se signe pas. **DoD** : la trace est en base, pas dans un journal applicatif.

### Lot 4 — Ce qui reste à trancher avant d'écrire une ligne de prix

- [ ] **E19-9 (M, 1)** **Les trois prix, et une boîte aux lettres.** (1) Prix de la passation et qui
  la paie — vendeur (argument de vente) ou acheteur (exigence d'expert). (2) Prix payé par le
  chantier et son unité : par coque sous contrat, par coque livrée, par an. (3) Existence de
  `constructeurs@xaman.boats`, citée par `/constructeurs` et **à créer avant la mise en ligne** :
  le domaine existe (il envoie déjà `noreply@`), la boîte non. Tant que les deux premiers points
  sont ouverts, aucune page de tarifs n'est écrite (D126) : une grille avec des « à partir de »
  inventés est exactement ce que la règle interdit.

## E20 — La checklist se comprend (refonte, D131)

> Retour de Joseph : « on ne comprend rien du tout, c'est pas simple, trop de saisies et pas
> simple d'usage ». Le brief est `docs/REFONTE-CHECKLIST.md`, le constat d'usage et les arbitrages
> sont dans D131. Principe : **une question par écran**, et **cocher coûte un geste**.

- [x] **E20-1 (M, 3)** **Une question par écran, une seule ligne** (D131). L'onglet Checklist cesse d'être trois portes : la liste plate « À traiter » et ses quatre onglets sont supprimées (`TodoList`, `ChecklistViewTabs`), et l'onglet répond à « qu'est-ce qu'on suit sur ce bateau » — le tableau de bord répondant depuis D121 à « qu'est-ce que je fais aujourd'hui ». `TodoRow` remplace `ChecklistItemRow` **partout**, tableau de bord compris : titre sur toute la largeur (deux lignes), état porté par un trait de couleur **et** par la phrase, case de 44 px. `due-sentence.ts` écrit l'échéance en français de marin — « En retard de 79 jours », « À faire aujourd'hui », « Dans trois semaines », « Dans un an » — au lieu de « dans 365 j » ; les heures restent des heures. **DoD** : `tests/unit/checklist-due-sentence.test.ts` couvre les paliers, le retard, les heures sans compteur et la parité clé ↔ `fr.json` ; maquette `/dev/ui/checklist` ; audit tactile vert.
- [x] **E20-2 (M, 2)** **Cocher coûte un geste** (D131). `use-tick.ts` écrit la réalisation sans rien demander — aujourd'hui, la personne connectée, le compteur courant du moteur — et **dit ce qu'il a supposé** dans le toast, qui porte « Annuler » huit secondes. Le cochage hors ligne est conservé (E9-1b, `submitOrQueue`). `CompleteItemDialog` n'est plus le chemin par défaut : il ne s'ouvre que pour la seule chose indevinable, un intervalle en heures sur un moteur jamais relevé, que la base exige (`check_completion_hours`). **DoD** : `tests/e2e/journeys/checklist.spec.ts` réécrit sur le nouveau geste, budget **1 tap** au lieu de 3.
- [x] **E20-3 (M, 1)** **Les mots du bord** (D131). « Point », « intervalle », « ancrage », « recaler », « ponctuel », « jamais fait », « valide jusqu'au » quittent l'interface : 29 libellés de `checklist.*` réécrits (« Jamais noté », « à refaire avant le… », « À faire une seule fois », « Mettre le carnet à jour », « Retiré du suivi »). Le tableau de bord suit, puisqu'il porte la même ligne : « Tout ce qui est à faire », « # en retard », « # choses réglées ». **DoD** : aucune de ces sept formes ne subsiste sous `checklist.*` ni sous `dashboard.upcoming.*` / `dashboard.state.*` dans `fr.json`.
