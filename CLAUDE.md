# CLAUDE.md — Xaman

Carnet d'entretien numérique et partagé pour bateaux. PWA iPad-first. Premier bateau : le catamaran ORC 50 « Xaman ».

## Documents de référence (à lire avant toute tâche)
- `docs/SPEC.md` — cahier des charges : vision, rôles, périmètre MoSCoW, parcours, exigences, architecture, design.
- `docs/DATA-MODEL.md` — schéma Postgres, RLS, vues, triggers. **Source de vérité du schéma.**
- `docs/BACKLOG.md` — épics et tickets ordonnés avec DoD. Mettre à jour les cases `[ ] / [~] / [x]` au fil de l'eau.
- `docs/AUDIT.md` — audit consolidé du 2 septembre 2026 et décisions D-xx (modèle de suivi, navigation, DA) ; **prime sur SPEC/DATA-MODEL pour les points qu'il tranche**.
- `docs/DECISIONS.md` — journal des décisions produit ; y ajouter une ligne à chaque arbitrage.
- `seed/` — données Xaman (bateau, checklist ORC 50, historique du carnet papier).
- `KICKOFF.md` — procédure de démarrage du projet (infra via MCP), à exécuter une seule fois.

## Infrastructure : créée depuis Claude Code via les MCP
Au démarrage, le dépôt git existe mais **aucun projet Supabase ni Vercel n'existe encore** ; c'est Claude Code qui les crée avec les MCP connectés (voir `KICKOFF.md` et ticket E0-0) :
- **Supabase MCP** : `list_organizations` → `get_cost` / `confirm_cost` → `create_project` (région UE, nom `xaman`) → `get_project_url`, `get_publishable_keys` → migrations via Supabase CLI (`supabase link` + `supabase db push`) ou `apply_migration` ; `get_advisors` après chaque migration touchant la RLS.
- **Vercel MCP** : `list_teams` → `create_git_project` lié au dépôt GitHub (framework Next.js) → variables d'environnement → `deploy_to_vercel` ; `get_deployment_build_logs` en cas d'échec.
- Les clés ne sont jamais écrites dans le dépôt : `.env.local` (ignoré) en local, variables Vercel en preview/prod ; `.env.example` documente les noms.
- Livraison : **web app hébergée sur Vercel** (URL partagée à Xav et Emmanuel, utilisable dans Safari), installable en PWA sur l'écran d'accueil (E0-6) ; pas d'app native.

## Stack
Next.js (App Router, TypeScript strict) · Tailwind + shadcn/ui · TanStack Query (persisté IndexedDB) · react-hook-form + zod · Supabase (Postgres, Auth e-mail OTP, Storage, Realtime, RLS) via `@supabase/ssr` · Serwist (PWA) · Vercel · Supabase CLI pour les migrations · Vitest + Playwright · pnpm.

## Commandes
```
pnpm dev                 # Next.js local
supabase start           # Postgres/Auth/Storage locaux (Docker)
pnpm db:reset            # supabase db reset (migrations + seed.sql de dev)
pnpm db:migrate          # applique les migrations
pnpm db:types            # génère src/types/database.ts
pnpm seed:xaman          # charge seed/*.json (idempotent)
pnpm lint · pnpm typecheck · pnpm test · pnpm test:e2e · pnpm build
```

## Règles non négociables
1. **iPad Safari d'abord.** Tester chaque écran en 1024×768 et 768×1024 avant de le considérer fini. Zones tactiles ≥ 44 px, champs ≥ 16 px, aucune interaction dépendant du survol, safe areas respectées en mode standalone.
2. **La sécurité est en base.** RLS activée sur toute table ; toute nouvelle table reçoit ses politiques dans la même migration ; toute vue est créée `with (security_invoker = true)` ; les colonnes sensibles sont retirées du rôle `authenticated` par privilèges de colonne. Jamais de clé service côté client (seulement dans les Server Actions qui en ont strictement besoin et dans le script de seed). Les droits UI ne sont qu'un confort ; les tests RLS (`tests/unit/rls.test.ts`) doivent couvrir toute nouvelle table et toute nouvelle vue.
3. **Le schéma vit dans `supabase/migrations/`.** Aucune modification manuelle en prod. Après une migration : `pnpm db:types` et commit du type généré. Mettre à jour `docs/DATA-MODEL.md` si le schéma s'écarte du document.
4. **Multi-tenant par `boat_id`.** Toute table métier porte `boat_id`, toute query filtre par `boat_id`, tout abonnement Realtime aussi.
5. **UUID générés côté client** (`crypto.randomUUID()`) pour les insertions ; `updated_at` partout. C'est le prérequis de l'offline V2.
6. **Validation zod partagée** : un schéma dans `src/lib/schemas/` utilisé par le formulaire et par la Server Action. Pas de validation dupliquée à la main.
7. **Pas de texte en dur** : toutes les chaînes UI dans `src/messages/fr.json` (next-intl). Code, identifiants, commits en anglais ; UI en français.
8. **Logique de checklist en base** (vue `checklist_item_status`) ; la copie TS `src/lib/checklist-status.ts` sert à l'optimistic UI et doit rester à parité (test dédié).
9. **Soft delete** (`deleted_at`) pour interventions, achats, sorties d'eau ; jamais de `delete` physique depuis l'UI sur ces tables.
10. **Pas de dépendance lourde sans raison** : pas de lib de charts en V1, pas de state manager global (TanStack Query + URL state suffisent), pas d'ORM (supabase-js + types générés).
11. **Toute création est idempotente** : UUID généré à l'ouverture du formulaire, Server Action en `upsert` sur la clé primaire, bouton occupé dès le premier tap (double tap = une seule ligne).
12. **Couleur = tokens de `globals.css`** : une couleur de remplissage (`--x`) n'est jamais une couleur de texte (`--x-fg`) ; les couleurs de catégories (base) ne circulent jamais seules (icône + libellé) et ne colorent jamais un texte ; le laiton est réservé à la marque.
13. **Formulaires tactiles** : jamais `type="number"` (`inputMode` + `NumericField`), dates = puces + roulette native (`DateField`), catégories = chips, prestataire = `ContactPicker`, un seul « + » par écran, jamais de saisie perdue (brouillon, formulaire conservé en cas d'échec, corbeille + Annuler).

## Conventions de code
- Composants : `PascalCase.tsx`, un composant par fichier, Server Components par défaut, `"use client"` seulement si nécessaire.
- Données : lectures via hooks `src/lib/queries/use-*.ts` (TanStack Query + client Supabase navigateur) ; écritures via Server Actions `src/lib/actions/*.ts` (`"use server"`, zod, client Supabase serveur, `revalidatePath` + invalidation query côté client).
- Routes : `src/app/(app)/boats/[boatId]/…` ; le layout de `[boatId]` charge le bateau + le rôle de l'utilisateur et les expose via un contexte (`useBoat()`). Navigation V1 : 4 onglets (Tableau de bord, Checklist, Journal, Bateau), feuille « Plus », menu compte — voir `AUDIT.md D8`. Chemins construits uniquement via `src/lib/queries/boat-routes.ts`.
- Rôles côté UI : helper `can(role, 'write' | 'contribute' | 'manageMembers' | 'deleteBoat')` dans `src/lib/permissions.ts`, miroir des fonctions SQL (`write` = owner/editor, couvre aussi la mise à la corbeille et l'export ; `contribute` = + pro sur ses propres lignes ; `manageMembers` et `deleteBoat` = owner). L'admin plateforme est traité comme owner.
- Authentification : mot de passe (mode principal, `signInWithPassword`) ou code OTP à 6 chiffres saisi dans l'app ; le code reste le chemin des personnes invitées, qui n'ont pas encore de mot de passe. Lien magique en secours. Inscription publique depuis `/signup`, réinitialisation par lien de récupération (D26).
- Dates : `date-fns` avec locale `fr` ; stockage `yyyy-MM-dd` pour les `date`.
- Montants : `Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' })`.
- Tests : logique métier (statuts, schémas, permissions) en unitaire ; parcours en E2E ; pas de tests de rendu triviaux.
- Commits : Conventional Commits (`feat(checklist): add custom item dialog`), un ticket = une branche = une PR, référence du ticket dans le titre (`E4-6`).

## Façon de travailler
- Prendre les tickets de `docs/BACKLOG.md` **dans l'ordre**, un à la fois. Marquer `[~]` en commençant, `[x]` en finissant.
- Avant de coder un ticket : relire la section correspondante de `SPEC.md` et `DATA-MODEL.md`. En cas de contradiction entre les deux, `DATA-MODEL.md` prime pour le schéma, `SPEC.md` pour le comportement ; signaler l'écart dans la PR.
- Définition de fini d'un ticket : critères du ticket remplis, `pnpm lint && pnpm typecheck && pnpm test` verts, écran vérifié en viewport iPad, textes en `fr.json`, migration + types commités si schéma modifié, `BACKLOG.md` mis à jour.
- Ne pas démarrer les tickets E11 (V1.1 / V2) sans validation explicite.
- Quand une décision produit manque, choisir l'option la plus simple compatible avec `SPEC.md`, la noter dans `docs/DECISIONS.md` (créer le fichier au premier besoin, format : date, question, décision, raison) et continuer.

## Personnes
- Joseph — produit, admin plateforme (`is_platform_admin`), valide les écrans.
- Xavier (Xav) — propriétaire de Xaman, `owner`, utilisateur principal sur iPad, fournit la liste complète des points de checklist ORC 50 et le prototype HTML de référence.
- Emmanuel Lesaffre — associé de Xav, `editor`, sur Android.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
