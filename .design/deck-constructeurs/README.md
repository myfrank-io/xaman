# Deck « Xaman pour les constructeurs »

Les sources des quatre slides du deck de présentation (D125, D126, D155). Un fichier `.dc.html` par
slide, en 1920×1080 ; `canvas.json` les dispose sur le canevas et porte la note collante.

La page publiée est reconstruite depuis ces fichiers par la skill `design` (`seed-canvas.mjs`),
jamais éditée à la main : le `.html` produit fait 2,5 Mo d'éditeur embarqué et n'est pas versionné.
Pour modifier une slide, éditer son `.dc.html` puis re-générer.

Ces quatre slides sont la même présentation que `/constructeurs/brochure`, aux mêmes mots :
le site est ce qu'on envoie, le deck ce qu'on projette. Changer l'un sans l'autre les fait diverger ;
les textes du site vivent dans `src/messages/fr.json` sous `marketing.brochure`.

Charte : reprise à l'identique des tokens de `src/app/globals.css` (Fraunces et Manrope, navy
`#0c1b33`, laiton `#8a6a22` / `#e3b879`, papier `#f6f5f1`, pastilles d'état du carnet).

## Ce que ce deck cherche à obtenir

**Un appel de 30 minutes.** La version précédente en faisait sept et concluait à la place du
chantier sur un métier que personne ne nous avait encore raconté ; un prospect l'a lue comme « un
copier-coller de Claude Code ». Celle-ci dit ce que nous avons et ce que nous proposons, et laisse
à l'appel ce que le chantier vit.

## À vérifier avant chaque envoi

- **Les trois chiffres de la slide 2.** 300+ entreprises et 4,9/5 sont ceux que publie
  [myfrank.io](https://myfrank.io) ; les 400 points de vente sont notre propre compte. Les tenir au
  même niveau que le site.
- **Le carnet de la slide 3** est celui de Xaman (ORC 50, coque n° 25, `seed/xaman-boat.json`).
  Vérifier qu'il est chargé dans la démo avant de présenter.
- **Aucun prix nulle part** — ni l'option de service, ni ce que paie le chantier (E19-9 ne les a pas
  tranchés).
- **Les deux contacts de la slide 4** (joseph@myfrank.io, xchauvin@xl4.fr) sont les mêmes que sur le site.
