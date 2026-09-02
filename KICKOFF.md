# KICKOFF — Démarrage du projet Xaman avec Claude Code

À exécuter **une seule fois**, dans ce dossier, avec Claude Code lancé (`claude`) et les MCP **Supabase**, **Vercel** et l'accès GitHub (`gh`) disponibles. État de départ : ce dossier contient le cahier des charges et les seeds ; un dépôt GitHub vide existe ; aucun projet Supabase ni Vercel n'existe.

## 1. Prompt à coller dans Claude Code

> Lis `CLAUDE.md`, `docs/SPEC.md`, `docs/DATA-MODEL.md`, `docs/BACKLOG.md` et `KICKOFF.md`. Résume-moi en 10 lignes le produit et les règles, puis exécute la procédure de `KICKOFF.md` (ticket E0-0) étape par étape : git, Supabase via MCP, Vercel via MCP. Montre-moi les URL obtenues. Ensuite enchaîne sur E0-1 et avance ticket par ticket dans l'ordre du backlog, en me montrant chaque écran avant de passer au suivant.

Remplacer avant de lancer : l'URL du dépôt GitHub ci-dessous (`https://github.com/myfrank-io/xaman`), et vérifier que Joseph est bien connecté aux MCP Supabase et Vercel avec son compte.

## 2. Procédure (ticket E0-0)

### 2.1 Git
```bash
git init -b main
git remote add origin https://github.com/myfrank-io/xaman
git add .
git commit -m "docs: add Xaman MVP specification pack"
git push -u origin main
```
`.gitignore` est déjà fourni (Node, Next.js, `.env*.local`, `supabase/.temp`, `.vercel`).

### 2.2 Supabase (MCP)
1. `list_organizations` → choisir l'organisation de Joseph.
2. `get_cost` (type `project`) puis `confirm_cost` → obtenir `confirm_cost_id`. Plan gratuit si disponible pour l'organisation.
3. `create_project` : `name = "xaman"`, `region = "eu-west-3"` (Paris ; à défaut `eu-central-1`), `organization_id`, `confirm_cost_id`. Le mot de passe base généré est à conserver dans un gestionnaire de mots de passe, **jamais dans le dépôt**.
4. Attendre `get_project` → `status = ACTIVE_HEALTHY`.
5. `get_project_url` et `get_publishable_keys` → `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. La clé service (`SUPABASE_SERVICE_ROLE_KEY`) se récupère dans le dashboard Supabase (Settings → API) ; elle ne sert qu'aux Server Actions d'invitation et au script de seed.
6. Écrire `.env.local` (ignoré par git) et `.env.example` (noms seuls).
7. Après E0-3 : `supabase link --project-ref <ref>` puis `supabase db push` pour appliquer les migrations ; `get_advisors` (security) après chaque migration RLS. Alternative : `apply_migration` via MCP, mais le fichier doit **aussi** exister dans `supabase/migrations/` (règle 3 de `CLAUDE.md`).
8. Auth : dans le dashboard, activer le provider Email avec OTP (code), désactiver les mots de passe si l'option existe, personnaliser les templates en français (E1-1), ajouter l'URL Vercel dans « Redirect URLs ».

### 2.3 Vercel (MCP)
1. `list_teams` → choisir l'équipe / le compte de Joseph.
2. `create_git_project` : nom `xaman`, dépôt GitHub `https://github.com/myfrank-io/xaman`, framework **Next.js**, branche de production `main`, région de fonctions `cdg1` (Paris) si proposée.
3. Variables d'environnement (Production + Preview) : `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (sensible, serveur uniquement), `NEXT_PUBLIC_APP_URL`.
4. Une fois E0-1 poussé : `deploy_to_vercel` ou déploiement automatique sur push ; vérifier avec `get_deployment` / `get_deployment_build_logs`. Récupérer l'URL `https://xaman-….vercel.app` et la noter dans `docs/DECISIONS.md`.
5. Protection de déploiement : previews protégées (`get_project_deployment_protection`), production publique (l'app a sa propre authentification).

### 2.4 Vérification de fin de E0-0
- `git push` OK, `main` protégée sur GitHub (PR obligatoire, facultatif en solo).
- Projet Supabase actif, URL et clé anonyme dans `.env.local` et dans Vercel.
- Projet Vercel lié au dépôt, un premier déploiement (même vide) en ligne.
- Ligne ajoutée dans `docs/DECISIONS.md` : date, `project_ref` Supabase, URL Vercel, région.

## 3. Ce qui reste à obtenir de Xav (n'empêche pas de démarrer)
- Liste complète des 80+ points de checklist ORC 50 → remplace les `source: proposal` dans `seed/orc50-checklist.json`.
- Prototype HTML de référence → base du design system (E0-4).
- E-mails de Xavier et Emmanuel, noms et contacts des intervenants → `seed/xaman-boat.json`.
- Confirmation des dates et heures moteur signalées dans `seed/xaman-history.json` (`review_summary`).
