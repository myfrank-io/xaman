# Prompt pour Claude Design

> À copier-coller tel quel dans Claude Design (tout ce qui suit la ligne horizontale).
> Il est autonome : Claude Design n'a pas accès au dépôt, tout ce dont il a besoin est dedans.
> Variantes de mission en fin de document (§11) : remplacer le §0 par la variante voulue.
> À tenir à jour quand la DA ou la navigation bougent (`docs/AUDIT.md §4`, D8/D19/D20, `src/app/globals.css`).

---

## 0. Ta mission

Tu es designer produit. Tu travailles sur **Xaman**, une application web (PWA) de carnet
d'entretien de bateau, en français, utilisée d'abord sur un **iPad à bord d'un catamaran**.

L'application existe déjà et fonctionne : elle est en production, développée en Next.js, avec un
système de tokens et de composants en place. Je ne te demande pas de repartir de zéro, mais de
**reprendre visuellement les écrans clés** : hiérarchie, densité, rythme, finition — jusqu'à un
niveau que je puisse reporter dans le code.

Livrable attendu : **un canvas de design**, un artboard par écran et par état, aux trois viewports
réels (§8). Pas de code d'application, pas de refonte fonctionnelle : la structure des écrans et
les décisions produit ci-dessous sont acquises et ne se rediscutent pas.

Avant de dessiner : lis tout ce document, puis dis-moi en cinq lignes ce que tu as compris du
produit et par quoi tu commences. Ensuite dessine.

---

## 1. Le produit en dix lignes

Xaman remplace le carnet d'entretien **papier** d'un bateau par un dossier vivant et partagé entre
toutes les personnes qui interviennent dessus : propriétaire, associé, équipage, professionnels.

Vision : **« la donnée suit le bateau, pas la personne. »** Un bateau = un dossier unique (fiche
technique, journal des interventions, checklists d'entretien, pièces et dépenses, sorties de
l'eau, intervenants, documents), qui reste attaché au bateau quand les gens changent.

Trois convictions :

1. **Checklists par modèle exact de bateau**, pré-remplies, avec les gestes détaillés pas à pas.
   Le bateau arrive **déjà rempli** — c'est le différenciateur, parce que le vrai concurrent
   n'est pas une autre app, c'est le papier et le tableur : le coût d'amorçage tue ces produits.
2. **Multi-acteurs natif.** Un pro invité voit tout, écrit ses lignes, n'efface rien.
3. **Utilisable à bord.** Plein soleil, doigts mouillés, connexion intermittente.

Promesse : **« Tout ce que le bateau a vécu, à portée de doigt mouillé. »**

Le premier bateau est *Xaman*, un catamaran Marsaudon ORC 50 en Méditerranée.

**Ce que Xaman n'est pas** : pas de télémétrie, pas de capteurs, pas d'« état du bateau » en temps
réel. Le sujet est **la mémoire des interventions et le partage entre ceux qui entretiennent**.

---

## 2. Les gens et le terrain

| Qui | Rôle | Ce qu'il fait |
|---|---|---|
| **Xavier** | propriétaire (`owner`) | Utilisateur principal, **iPad**, saisit à bord |
| **Emmanuel** | associé (`editor`) | Android, voit tout, saisit tout |
| **Joseph** | produit (`editor` + admin) | Valide les écrans |
| Un mécano Yanmar | `pro` invité, accès daté | Lit tout, écrit **ses** interventions, ne supprime rien, ne voit pas les membres |
| Un acheteur, un expert | `viewer` | Lecture seule |

Conditions d'usage réelles, qui commandent tout le design :

- **iPad Safari en plein soleil.** L'ombre portée disparaît au soleil : une carte se délimite par
  une **bordure**, jamais par une ombre seule. Le contraste est mesuré, pas ressenti.
- **Doigts mouillés, bateau qui bouge.** Cibles ≥ 44 px, champs ≥ 44 px de haut et 16 px de texte
  (en dessous, Safari iOS zoome tout seul). Aucune interaction qui dépend du survol.
- **Réseau Starlink intermittent.** Un état hors ligne existe et se dessine.
- **Budget d'interaction chronométré** : noter une vidange avec heures ≤ 7 taps / < 45 s ; cocher
  un point de checklist ≤ 3 taps / < 10 s ; relever les heures d'un moteur ≤ 3 taps / < 15 s.
  Chaque tap que ton design ajoute se paie sur ces budgets.

---

## 3. Ce qui existe déjà

- L'app est **en production** et couvre : connexion, checklist ancrée, tableau de bord, journal des
  interventions, dépenses et achats, stock, sorties de l'eau, intervenants, corbeille, membres et
  invitations, import CSV/XLSX/VCF, rapport d'état imprimable, PWA + lecture hors ligne, export.
- Un **système de tokens** est en place (§5), avec des contrastes WCAG calculés pour chaque
  couleur. Ne les recalcule pas : réutilise-les, et si tu introduis une couleur, donne son ratio.
- Des composants existent : `Badge`, `StatCard`, `ListRow`, `SectionCard`, `ProgressBar`,
  `DueLabel`, `CategoryBadge`, `NumericField`, `DateField`, `CategoryChips`, `ContactPicker`,
  `ConfirmDialog`, `UndoToast`, `OfflineBanner`, `EmptyState`, `PrimaryActionSheet`, `TopBar`.
- Ce qui **n'est pas** fait et que tu peux donc cadrer librement : la QA iPad réelle (plein soleil,
  clavier, safe areas, scroll des dialogues) et la finition d'ensemble.

Un rafraîchissement visuel a déjà eu lieu (moins « généré », plus instrument) : typographie
Manrope + Fraunces, fond papier chaud, filet laiton sous les bandeaux sombres, badges tous en
teinte. Continue dans cette direction, ne la renverse pas.

---

## 4. Contraintes non négociables

1. **iPad d'abord.** Tout écran est jugé en 1024×768 **et** 768×1024 avant d'exister. Le téléphone
   n'est pas un iPad étroit : sa densité se dessine, elle ne se déduit pas.
2. **Cibles ≥ 44 px**, champs ≥ 44 px et texte de champ ≥ 16 px, aucun survol nécessaire, safe
   areas respectées en mode standalone.
3. **Un seul « + » par écran**, nommé. **Pas de FAB.** Le contrôle primaire dit l'acte
   (« Noter une intervention »), jamais l'entité (« Ajouter »). L'acte part d'où l'on est : depuis
   une fiche moteur, le formulaire arrive avec la catégorie et le bloc d'heures déjà ouverts.
4. **L'action principale est visible sans défiler**, aux trois viewports.
5. **La couleur ne porte jamais seule un sens.** Toujours icône + libellé. Une couleur de
   catégorie n'est **jamais** une couleur de texte et ne circule jamais seule.
6. **Le laiton est réservé à la marque** (logo, connexion, états vides, filet d'en-tête). Jamais
   sur une donnée, un statut, une alerte.
7. **Chiffres tabulaires partout**, 12 px minimum, graisse ≥ 500 en dessous de 14 px.
8. **Une action interdite à un rôle est absente, pas grisée.** Le grisé est réservé au hors ligne
   (style dédié, jamais une simple opacité).
9. **Jamais de saisie perdue** : brouillon conservé, formulaire jamais vidé en cas d'échec,
   corbeille + « Annuler » plutôt que des confirmations partout.
10. **Pas de dark mode en V1** (les tokens existent, l'écran ne se dessine pas).
11. **Jamais `type="number"`**, dates = puces de raccourci + roulette native, catégories = chips.

---

## 5. Direction artistique

**Marque.** *Xaman Ek'* = l'étoile du Nord. Ligne directrice : **le repère fixe**. Registre
**instrument de bord / carte marine / plaque de constructeur**. Logo « La Traverse » : un X formé
de deux coques coupé par la ligne de flottaison, rectiligne, monochrome par construction ;
logotype `XAMAN` en capitales géométriques.

**Fond et surfaces.** Le fond est du **papier de carte chaud**, les cartes sont **blanches et
bordées** et posées dessus comme un instrument sur une table.

```
--background      #f6f5f1   fond de l'app (papier chaud, jamais un gris froid)
--surface         #ffffff   cartes, feuilles, champs
--surface-2       #edece7   surface secondaire
--border          #d2dae4   bordure par défaut     --border-strong #b3becc
--input           #b3becc   bordure de champ, volontairement plus forte
--ring            #1b5e96   focus, azur marin (jamais le bleu de framework)
```

**Encre et navy.**

```
--navy        #0c1b33   en-tête, encre, icône d'app
--navy-light  #1e3a5f   fin du dégradé d'en-tête
--navy-deep   #081426
--brand-ink   #123152   bouton primaire (blanc dessus : 13,2:1)
--foreground  #0c1b33   texte principal  (15,9:1 sur le fond)
--ink-2       #4a5b72   texte secondaire (6,6:1)
--ink-3       #63748a   méta, placeholder (4,5:1)
--on-navy     #ffffff   /  --on-navy-2 #cbd6e4  /  --on-navy-3 #9bb0c8
```

**Accent de marque (laiton).** `--brass #8a6a22` sur clair, `--brass-light #e3b879` sur navy.
Signature : un **filet laiton** très fin au bas de chaque bandeau navy — le trait doré d'une
couverture de carnet. Il se lit comme une finition, jamais comme une alerte.

**Sémantique — trois variantes par couleur** : `--x` = pastille / barre / point (≥ 3:1, **jamais
du texte**), `--x-fg` = texte et icône (≥ 5:1), `--x-tint` = fond, `--x-border` = liseré,
`--x-on-dark` = sur le navy.

| Sens | fill | texte `-fg` | teinte | liseré |
|---|---|---|---|---|
| Planifié | `#2563eb` | `#1d4ed8` | `#e5ecfd` | `#bed0f9` |
| En cours | `#d97706` | `#94540a` | `#faefe1` | `#f4d6b4` |
| Terminé / OK | `#16a34a` | `#0f6b32` | `#e3f4e9` | `#b9e3c9` |
| Urgent / En retard | `#c81e2b` | `#b01823` | `#f8e4e6` | `#eebcbf` |
| Bientôt | `#ea580c` | `#b03b0b` | `#fcebe2` | `#f9cdb6` |
| Jamais fait | `#63748a` | `#4a5b72` | `#eceef1` | `#d0d5dc` |

**Règle acquise, à respecter :** *tous* les badges sont **en teinte + `-fg` + liseré + icône*, y
compris En retard, Bientôt et Urgent. Aucun aplat rouge ou orange : un mur d'aplats lisait
« tableau de bord en alarme » ; l'instrument reste calme.

**Les 8 catégories (systèmes)** — harmonisées pour la deutéranopie, minimum 3,19:1 sur blanc :

| Système | Couleur | | Système | Couleur |
|---|---|---|---|---|
| Moteurs | `#d97706` | | Électronique / Nav | `#1d4ed8` |
| Dérives & Safrans | `#0284c7` | | Énergie | `#a16207` |
| Voiles & Gréement | `#a21caf` | | Hydraulique & Circuits | `#0f766e` |
| Coque & Pont | `#52606f` | | Sécurité | `#c81e2b` |

Elles servent de **liseré, de pastille et d'icône** — jamais de couleur de texte, jamais seules.

**Typographie.** **Manrope** pour toute l'interface et tous les chiffres ; **Fraunces** (serif
éditorial) pour la couche d'affichage seulement : logotype, `h1`, nom du bateau, états vides,
écran de connexion, rapport. **Jamais de serif sur une donnée ou un chiffre.**

```
overline 11/16 · caption 13/18 · label 14/20 · body 16/24 · body-lg 17/26
h3 17/24 · h2 19/26 · h1 24/30 · display 28/34
chiffres : inline 17 · carte 24 · vignette de stat 32
rayon 10 px · mouvement : 90 ms pression · 140 ms bascule · 200 ms feuille · 320 ms barre
```

---

## 6. Langue et ton

- Interface **en français**, **vouvoiement**, voix active, **un fait par phrase**.
- Vocabulaire du bord, pas du logiciel : « Noter une intervention », « Qu'avez-vous fait ? »,
  « Fait », « Heures moteur », « Sortie de l'eau », « À racheter ».
- **Zéro point d'exclamation, zéro emoji, zéro ton commercial.**
- Un état vide **invite** au lieu de constater : jamais « Aucune intervention. » tout seul —
  toujours une phrase et le bouton qui la résout.
- On dit la vérité de la donnée : « compteur inconnu » plutôt que « 0 h », « à mettre à jour »
  au-delà de 60 jours, « estimé » quand la valeur est estimée, « à vérifier » sur une ligne
  importée douteuse. Rien de douteux n'est masqué.
- Une échéance s'affiche **en clair** : « dans 12 j **ou** dans 40 h, au premier atteint ».

---

## 7. Navigation et écrans

**4 onglets** : **Tableau de bord · Checklist · Interventions · Bateau**.
Feuille **« Plus »** : Dépenses, Intervenants, Corbeille.
Menu **compte** : Membres, Paramètres, Mon profil, Installer, Se déconnecter.
En ≥ 1024 px : barre latérale portant le libellé complet du bouton primaire. En dessous : onglets
en bas + en-tête compact (deux carrés de 44 px : carnet et « + »).

Le rangement suit le sens : **Bateau** = ce que le bateau *est* (identité, moteurs, équipements,
pièces détachées) · **Interventions** = le travail · **Dépenses** = l'argent · **Checklist** = ce
qui vient.

### Écrans à dessiner (contenu réel, jamais de faux texte)

**A. Tableau de bord** — en-tête navy dégradé + filet laiton : nom du bateau, modèle, **phrase
d'état**, 4 vignettes tappables (En retard · Bientôt · Interventions · Dépenses 12 mois), bande
des moteurs (heures, « relevé le … », « à mettre à jour » > 60 j, « compteur inconnu »).
Puis : **un seul** bandeau contextuel (hors ligne › échec d'envoi › lignes à vérifier › compteurs
jamais saisis › installer), **« À faire prochainement »** (6 lignes en paysage, 5 en portrait,
4 sur téléphone, bouton **`Fait`** en ligne), **grille des 8 systèmes à ordre fixe** (l'ordre ne
change jamais : la mémoire de position vaut plus que le tri), 5 dernières interventions,
récapitulatif (dépenses 12 mois par catégorie, dernière sortie de l'eau, pièces sous le seuil).
États à dessiner : **carnet neuf** (3 étapes), **tout est à jour** (sans bouton), chargement
(squelettes aux dimensions exactes), erreur par bloc.

**B. Checklist, racine** — grille des 8 systèmes (icône, couleur, progression, « N en retard »,
« jamais fait » / « à jour ») + onglet **« À traiter »** à plat trié par urgence (Tout · En retard
· Bientôt · Jamais fait). En tête : la liste **« À racheter »**, déduite du stock, avec des **+/−**
qui agissent sur la ligne (aucune double saisie) et « Noter une pièce à racheter ».

**C. Checklist, une catégorie** — lignes de **64 px** triées (en retard → bientôt → à faire → OK),
contrainte déclenchante affichée, bouton **`Fait` de 88 × 44 px à abscisse fixe** (le pouce le
retrouve sans regarder), accordéon **exclusif ouvert en place** (description, étapes cochables,
historique, Modifier / Désactiver), groupe « Contrôles ponctuels » en bas, « points désactivés »
en pied.

**D. Dialogue « Fait »** — date (puces + roulette, jamais de futur), réalisé par, heures moteur si
l'intervalle est en heures (aide « dernier : 1 234 h le 28/08 » + puce « = reprendre »),
« Valide jusqu'au » pour les points à date fixe, note, « + Ajouter les détails ». Puis le **toast
8 s avec Annuler**.

**E. « Noter une intervention »** — le formulaire dit l'acte : titre « Noter une intervention »,
premier champ **« Qu'avez-vous fait ? »** avec exemple, suggestions de titres, chips de catégorie,
statut segmenté [À faire · En cours · Terminé] + bascule **Urgent** (défaut Terminé), date, heures
par moteur (jamais pré-remplies), coût, réalisé par, notes, équipement replié, photos, **points de
checklist concernés pré-cochés**. Barre d'action **collante au-dessus du clavier**. Garde
« abandonner cette saisie ? ».

**F. Interventions** — onglets Historique / Prévu / Sorties de l'eau, recherche, filtres persistés,
lignes de **76 px** avec liseré de catégorie et heures relevées à droite, « charger plus »,
« 1 nouvelle intervention · Afficher » quand un autre appareil écrit, halo 2 s sur la ligne
modifiée. L'action de création est **en haut à droite de l'écran** ; le « + » du cadre s'efface
ici — un écran, un chemin.

**G. Bateau** — identité en tête, puis moteurs (vignettes de compteur tappables, fiche moteur avec
historique des relevés), équipements, pièces détachées.

**H. Dépenses** — période (12 mois glissants par défaut), catégories avec barre et montant
décroissant, comparaison N-1, export CSV. **Pas de bibliothèque de graphiques** : des barres
dessinées, rien de plus.

**I. Rapport d'état imprimable** — une page, `@media print`, PDF par Partager → Imprimer :
identité, moteurs, état des 8 systèmes, échéances 12 mois, 12 derniers mois d'interventions,
sorties de l'eau, coûts (avec bascule « inclure les coûts »).

**J. Écrans de première fois** — connexion (mot de passe ou code à 6 chiffres), **assistant de mise
en route en 3 étapes < 5 min** (compteurs → tri des points proposés → calage grossier
Jamais · < 6 mois · ~1 an · > 2 ans).

**K. États système transverses** — hors ligne (bandeau, âge des données, boutons en style hors
ligne, carte « saisies en attente · Tout renvoyer »), vide, chargement, erreur, conflit de
modification (montré, jamais fusionné).

**Données à utiliser dans les maquettes** : catamaran ORC 50 « Xaman », deux moteurs Yanmar
(bâbord / tribord, relevés indépendants), les 8 systèmes ci-dessus, des interventions crédibles
(« Vidange moteur bâbord », « Contrôle des drisses », « Carénage »), des montants en euros
formatés à la française. **Aucun faux texte, aucun placeholder.**

---

## 8. Ce que je veux que tu produises

1. **Un canvas** avec un artboard par écran et par état, groupés par flux, dans l'ordre du §7.
2. **Trois viewports** pour les écrans A à F : **1024 × 768** (iPad paysage), **768 × 1024** (iPad
   portrait), **390 × 844** (iPhone). Les autres écrans : iPad paysage suffit, sauf si le portrait
   change quelque chose.
3. **Une planche de composants** : badges (les 6 sens), boutons (primaire, secondaire, `xl`, hors
   ligne, occupé), chips de catégorie, ligne de liste 64 / 76 px, vignette de stat, barre de
   progression (dont l'état « — »), champ numérique avec son unité, champ de date, toast Annuler,
   bandeau hors ligne, état vide.
4. **Pour chaque artboard, trois lignes de note** : ce que tu as changé par rapport à l'existant,
   pourquoi, et le token utilisé (nomme `--state-overdue-fg`, pas `#b01823`).
5. **Une liste finale des reprises**, ordonnée par gain sur la lisibilité au soleil et sur le
   nombre de taps — c'est elle que je porterai dans le code.

Commence par le **tableau de bord** en iPad paysage et montre-le-moi avant de dérouler le reste :
c'est l'écran qui fixe le vocabulaire visuel de tous les autres.

---

## 9. Comment je jugerai

- Toute cible interactive mesure ≥ 44 px, tout champ ≥ 44 px et 16 px de texte.
- Aucun débordement horizontal, aux trois viewports.
- L'action principale de l'écran est atteignable **sans défiler**, aux trois viewports.
- Aucun sens porté par la couleur seule ; tout texte coloré atteint 5:1, toute pastille 3:1.
- Les chiffres sont tabulaires et alignés ; aucun serif sur une donnée.
- Une carte se lit sans son ombre.
- Aucun écran n'ajoute de tap aux trois parcours chronométrés du §2.
- La page tient en plein soleil : contraste haut, aplats rares, laiton discret.

---

## 10. Interdits

- **Imagerie** : voilier en silhouette, vagues, cordages, bois verni, hublot, gouvernail, ancre,
  ton brochure de charter. Xaman est un **instrument**, pas une carte postale.
- **Emoji**, points d'exclamation, ton commercial, « Oups », « Super ».
- Glassmorphism, néomorphisme, dégradés saturés, ombres portées lourdes, coins très arrondis,
  cartes flottantes sans bordure, illustrations 3D génériques.
- Aplats rouges ou orange en masse ; laiton sur une donnée ; couleur de catégorie en texte.
- FAB, second « + », menu kebab qui cache l'acte principal, tooltip au survol.
- Dark mode, bibliothèque de graphiques, faux texte.

---

## 11. Variantes de mission

Remplacer le §0 par l'un de ces blocs selon le besoin.

- **Marque et identité.** Décliner « La Traverse » : logotype, icône d'app sur navy, favicon,
  écran de connexion, écran d'installation PWA, en-tête du rapport imprimable, planche d'usage
  (tailles minimales, zone de respiration, monochrome, sur navy et sur papier chaud).
- **Site public.** Une page d'accueil pour Xaman : promesse, les trois convictions du §1, une
  preuve par capture d'écran, le positionnement du §1 (le concurrent est le papier), inscription.
  Même DA, même ton, aucune surenchère marketing.
- **Écran unique, à fond.** Prendre un seul écran (le tableau de bord, ou la checklist d'une
  catégorie) et en produire trois directions distinctes aux trois viewports, avec leurs états
  vide / chargement / erreur / hors ligne, puis une recommandation argumentée.
- **Audit avant dessin.** Auditer les captures existantes (je les fournis) écran par écran :
  hiérarchie, densité, contraste, cibles, coût en taps ; produire une liste de reprises ordonnée
  avant de dessiner quoi que ce soit.
