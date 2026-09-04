# Xaman

Carnet d'entretien numérique et partagé pour bateaux. Web app Next.js + Supabase hébergée sur Vercel, installable en PWA, conçue d'abord pour l'iPad à bord. Premier bateau : le catamaran Marsaudon Composites ORC 50 « Xaman ».

- Production : https://xaman-blue.vercel.app (previews Vercel à chaque push)
- Accès sur invitation uniquement : un propriétaire ou un éditeur invite par e-mail depuis « Membres » ; la connexion se fait par code à 6 chiffres, jamais de mot de passe.

## Documents
| Chemin | Rôle |
|---|---|
| `CLAUDE.md` | Contexte, stack, règles non négociables et façon de travailler |
| `docs/SPEC.md` | Cahier des charges (vision, périmètre, parcours) |
| `docs/AUDIT.md` | Audit du 2 septembre 2026 et décisions D1–D32 (prime sur SPEC / DATA-MODEL pour les points tranchés) |
| `docs/DATA-MODEL.md` | Schéma Postgres, RLS, vues, triggers — source de vérité du schéma |
| `docs/BACKLOG.md` | Lots et tickets ordonnés avec leur état |
| `docs/DECISIONS.md` | Journal des décisions produit et techniques |
| `seed/` | Bateau Xaman, checklist ORC 50, historique du carnet papier |

## Installation locale
Prérequis : Node 22 (`.nvmrc`), pnpm 10, PostgreSQL 16 ou Docker pour la pile Supabase.

```
pnpm install
cp .env.example .env.local        # renseigner les clés du projet Supabase (jamais commitées)
pnpm dev                          # http://localhost:3000
```

### Base de données
Le schéma vit dans `supabase/migrations/` (jamais de modification manuelle en production).

- Pile Supabase locale (Docker) : `supabase start`, puis `pnpm db:reset` (migrations + `supabase/seed.sql`), `pnpm db:types` pour régénérer `src/types/database.ts`.
- Sans Docker : un PostgreSQL 16 sur `127.0.0.1:54322` (utilisateur `postgres`) et le shim `tests/support/supabase-shim.sql` (rôles `anon` / `authenticated` / `service_role`, `auth.uid()`, tables Storage). Créer une base, appliquer le shim puis les migrations dans l'ordre, puis `supabase/seed.sql`. Types : `pnpm db:types:url` (via postgres-meta, `DATABASE_URL` requis).

### Contenu publié (catalogue et modèles génériques)
Deux jeux de données sont livrés par des **migrations générées**, parce que la production ne joue
jamais le script de seed : les modèles de checklist génériques (`seed/generic-checklists.json` →
`pnpm gen:templates` → `0016`) et le catalogue de modèles de série
(`seed/boat-models.json` → `pnpm gen:boat-models` → `0020`). Le JSON est le fichier qu'on modifie ;
le SQL se régénère, et les tests de parité échouent si les deux divergent.

### Données Xaman
`pnpm seed:xaman` charge `seed/*.json` (modèle ORC 50, bateau, moteurs, équipements, intervenants, historique du carnet avec les lignes « à vérifier »). Idempotent : deux exécutions donnent le même résultat. Avec `NEXT_PUBLIC_SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY`, les comptes sont créés par invitation Supabase Auth ; sinon directement dans `auth.users` (local seulement).

## Vérifications
```
pnpm lint · pnpm typecheck · pnpm test · pnpm build
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/xaman_test pnpm test   # suites base de données
```
`pnpm test` couvre : la matrice RLS complète (rôles × tables × opérations, fonctions d'invitation, Storage, corbeille, file d'attente), la parité entre la vue SQL `checklist_item_status` et sa copie TypeScript, le script de seed, les exports CSV et les formats.

La CI GitHub Actions (`.github/workflows/ci.yml`) rejoue lint, prettier, typecheck, la pile Supabase (`supabase db start` + `db reset`), les tests et le build à chaque push ; les migrations de production sont appliquées par le job `migrate-production` quand les secrets `SUPABASE_ACCESS_TOKEN` / `SUPABASE_DB_PASSWORD` et la variable `SUPABASE_PROJECT_REF` sont définis.

Écrans sans base : les pages `/dev/ui/*` (hors production) montent les composants réels avec des données d'exemple pour la recette visuelle en 1024×768 et 768×1024.

## Déploiement
- **Vercel** : projet `xaman` lié au dépôt GitHub ; variables d'environnement `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL` (voir `.env.example`). Région `cdg1` (`vercel.json`).
- **Supabase** : projet en région UE ; migrations appliquées par la CI ou `supabase db push` ; gabarits d'e-mail en français (code OTP, invitation, lien magique) ; URL de redirection `https://xaman-blue.vercel.app/**`.
- **PWA** : `src/app/manifest.ts` + service worker Serwist (`src/app/sw.ts`, construit par `serwist build` après `next build`). Sur iPad : Partager → Sur l'écran d'accueil.

## Ouvrir un carnet
Créez un compte sur `/signup`, puis ajoutez votre bateau : un nom, un type de coque, son constructeur et son modèle, le nombre de moteurs. Écrivez le constructeur et le modèle tels quels — le champ est libre. Le carnet s'ouvre avec les systèmes du bord ; le plan d'entretien se choisit ensuite depuis la Checklist, dans la liste des modèles publiés ou dans le modèle générique de votre coque.

Pour rejoindre le carnet d'un bateau existant, demandez plutôt une invitation à son propriétaire (« Membres → Inviter ») : le lien reçu par e-mail vous y ajoute directement.

## Personnes
Joseph (produit, admin plateforme) · Xavier · Emmanuel
