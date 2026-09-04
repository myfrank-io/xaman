# Audit de la mise en route — captures (4 septembre 2026)

Preuves de la décision `docs/DECISIONS.md` **D67**. Les pages sont montées par la galerie
`/dev/ui` (composants réels, données factices, aucune base), pilotée par Playwright.

- `before/` — le parcours d'arrivée avant la refonte, tel qu'il était éclaté sur cinq écrans :
  `step1-boat` (`/boats/new`, qui portait aussi la question du carnet existant), `dashboard`
  (l'écran d'arrivée, qui annonçait « Tout est à jour » sur un carnet sans un seul point),
  `plan` (le choix du plan d'entretien, à trouver soi-même dans l'onglet Checklist) et `setup`
  (l'assistant « Recaler ma checklist », le second « trois étapes » de l'app).
- `after/` — le flux unique : `step1-boat` (étape 1, avec l'indicateur d'étape en haut) et
  `steps23` (les trois panneaux de l'étape 2 — rien à reprendre, tableur, papier — puis
  l'étape 3, empilés sur une page pour l'audit tactile).

Trois viewports pour chaque écran : `1024x768` (iPad paysage), `768x1024` (iPad portrait),
`390x844` (iPhone).

Chiffres mesurés lors de l'audit, après l'inscription et jusqu'à un carnet utilisable :
**9 taps au minimum et ~31 en pratique avant**, sur cinq écrans ; **4 taps après**, sur trois
écrans, avec le plan d'entretien appliqué à l'arrivée.

Reproduction : serveur de dev sur le port 3000, puis Playwright avec `PLAYWRIGHT_CHROMIUM_PATH`
pointant sur le Chromium préinstallé, sur `/dev/ui/boats/new` et `/dev/ui/onboarding`.
