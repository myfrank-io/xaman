# Deck « Xaman pour les constructeurs »

Les sources des sept slides du deck de présentation (D125, D126). Un fichier `.dc.html` par
slide, en 1920×1080 ; `canvas.json` les dispose sur le canevas et porte la note collante.

La page publiée est reconstruite depuis ces fichiers par la skill `design` (`seed-canvas.mjs`),
jamais éditée à la main : le `.html` produit fait 2,5 Mo d'éditeur embarqué et n'est pas versionné.
Pour modifier une slide, éditer son `.dc.html` puis re-générer.

Charte : reprise à l'identique des tokens de `src/app/globals.css` (Fraunces et Manrope, navy
`#0c1b33`, laiton `#8a6a22` / `#e3b879`, papier `#f6f5f1`, pastilles d'état du carnet).

Trois points vérifiés ou à vérifier avant de présenter :

- **Aucun prix nulle part** — ni l'option de service, ni ce que paie le chantier (E19-9 ne les a pas
  tranchés ; une grille inventée disqualifierait le deck entier).
- **« Une de vos coques » (slide 5) est vérifié.** Grand Large Yachting a repris Marsaudon Composites
  et la marque ORC le 18 septembre 2023, et Xaman est un ORC 50 coque n° 25 (`seed/xaman-boat.json`).
  La coque est sortie avant la reprise : c'est la flotte que leur pôle occasion revend.
- **La citation de Pierre Delhomeau (slide 4) n'a pas pu être vérifiée à la source.** Seul « un bon
  carnet d'entretien » est entre guillemets, le reste est en discours rapporté.

Les anomalies du carnet papier citées en slide 5 sont réelles : `seed/xaman-history.json`
(`20/13/25`, `31/11/25`, moteur SB 708 h → 347 h).
