# Audit des flux d'ajout — captures (3 septembre 2026)

Preuves de l'audit décrit dans `docs/AUDIT.md §7`. Les pages sont montées par la galerie
`/dev/ui` (composants réels, données factices, aucune base), pilotée par Playwright.

- `before/` — l'état avant la refonte : « + Ajouter » en pied de sidebar, glyphe « + » sans
  libellé en portrait et sur téléphone, feuille de choix nommée d'après les entités.
- `after/` — après : « Noter une intervention » en toutes lettres, bouton nommé sur le
  tableau de bord en dessous de `lg`, action de l'écran des interventions en haut à droite,
  identité du bateau en en-tête, inventaire replié, Dépenses en une seule liste.

Trois viewports pour chaque écran : `1024x768` (iPad paysage), `768x1024` (iPad portrait),
`390x844` (iPhone). `add-sheet-*` montre la feuille ouverte.

Reproduction : serveur de dev sur le port 3007, puis Playwright avec
`PLAYWRIGHT_CHROMIUM_PATH` pointant sur le Chromium préinstallé.
