# Xaman

Carnet d'entretien numérique et partagé pour bateaux. Web app Next.js + Supabase hébergée sur Vercel, installable en PWA, conçue d'abord pour l'iPad à bord. Premier bateau : le catamaran Marsaudon Composites ORC 50 « Xaman ».

## Démarrer
1. Lire `KICKOFF.md` : procédure unique de création de l'infrastructure (git, Supabase et Vercel via les MCP de Claude Code).
2. Lancer `claude` dans ce dossier et coller le prompt de `KICKOFF.md §1`.
3. Claude Code prend ensuite les tickets de `docs/BACKLOG.md` dans l'ordre.

## Contenu
| Chemin | Rôle |
|---|---|
| `CLAUDE.md` | Contexte, stack, règles et façon de travailler (lu automatiquement par Claude Code) |
| `KICKOFF.md` | Bootstrap infra (E0-0) et prompt de démarrage |
| `docs/SPEC.md` | Cahier des charges complet du MVP |
| `docs/DATA-MODEL.md` | Schéma Postgres, RLS, vues, triggers — source de vérité du schéma |
| `docs/BACKLOG.md` | Épics et tickets ordonnés avec critères de fini |
| `docs/DECISIONS.md` | Journal des décisions produit et infra |
| `seed/xaman-boat.json` | Bateau Xaman : identité, moteurs, équipements, contacts, membres |
| `seed/orc50-checklist.json` | Modèle de checklist ORC 50 (8 catégories, 90 points : 16 du briefing, 74 propositions à valider) |
| `seed/xaman-history.json` | Historique du carnet papier (10 entrées, anomalies signalées) |

## Commandes (une fois E0-1 et E0-2 faits)
```
pnpm dev · supabase start · pnpm db:reset · pnpm db:types · pnpm seed:xaman
pnpm lint · pnpm typecheck · pnpm test · pnpm test:e2e · pnpm build
```

## Personnes
Joseph (produit, admin plateforme) · Xavier (propriétaire, iPad) · Emmanuel Lesaffre (associé, Android).
