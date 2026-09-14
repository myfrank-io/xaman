# Xaman — Ce qu'un bateau peut verser au carnet à la mise en route

> **Proposition, 14 septembre 2026.** Rien n'est tranché ici : aucun numéro de décision
> (`DECISIONS.md`) ni de ticket (`BACKLOG.md`) n'est pris tant que ce document n'est pas validé.
> L'épique E17 décrite au §7 prendra sa ligne dans les tableaux de compteurs le jour où elle s'ouvre.
>
> **Cadre posé par Joseph (14/09)** : **les données de l'application font foi.** Le document lu
> ci-dessous est un dossier de commande qui a beaucoup changé depuis sa rédaction ; il ne dit pas
> ce que Xaman porte aujourd'hui et n'est pas invoqué ici pour corriger le carnet. Il vaut comme
> **spécimen** : il montre, pièce par pièce, ce qu'un propriétaire peut verser dans l'app à la mise
> en route, et donc ce que le lecteur de documents doit savoir faire.
>
> **Spécimen** : *Spécification Technique de Besoin*, Marsaudon Composites, ORC 50 #25, créé le
> 31/01/2023, 4 pages.

---

## 0. En dix lignes

1. Ce document n'est pas une fiche technique : c'est un **tableau de commande d'options** — une
   référence chantier, une marque, une quantité, un prix et **un statut** par ligne. ~60 lignes.
2. Le statut est la première chose à lire : **Validé · À valider · Chiffrage · Annulé**. Sur ce
   spécimen, **aucune option n'est validée** hormis la base : tout est encore en discussion.
3. Deuxième chose à lire : **sa date**. Entre ce document (janvier 2023) et la livraison (début
   2024), au moins cinq postes ont changé — voilerie, pack électronique, traceur, puissance
   solaire, hors-bord d'annexe. **C'est normal, et c'est l'enseignement principal.**
4. D'où la règle n° 1 du lecteur : **un document est une pièce datée, jamais une source de
   vérité.** Il propose ; le carnet fait foi ; une ligne qui contredit l'existant s'affiche à côté,
   décochée, et n'écrase rien — §1.3.
5. Le vrai gisement n'est pas ce seul document : c'est **la douzaine de familles de documents**
   qu'un propriétaire a déjà, du bon de livraison au certificat de révision du radeau. §2 en dresse
   le catalogue avec, pour chacune, ce qu'elle remplit et ce qu'elle vaut.
6. **Deux familles donnent de la valeur dès le jour 1** et personne ne les demande : l'attestation
   d'assurance et les certificats de révision (radeau, extincteurs, balise, pyrotechnie). Ce sont
   des **dates de péremption** : la file d'attente cesse d'être vide sans qu'on invente rien — ce
   que l'ancrage (D1) ne sait pas faire, faute de dates réelles.
7. Le certificat de conformité CE porte la **catégorie de conception** (A / B / C), c'est-à-dire
   exactement ce que `boats.navigation_zone` pilote déjà (D90) : côtier ou hauturier, donc quels
   points s'appliquent.
8. Le **descriptif technique standard** du modèle porte ce que la STB ne porte pas : le modèle
   exact des moteurs, les capacités de réservoirs, l'échantillonnage. Deux documents, pas un.
9. Côté plan d'entretien, la proposition reste celle-ci : **deux couches**, le modèle de coque plus
   une **bibliothèque de règles par famille d'équipement**, composées à l'instanciation — §4. Le
   spécimen le confirme : ce qui distingue deux ORC 50, ce sont leurs options.
10. Et le principe qui ne bouge pas : **auto-pilote ne veut pas dire écriture automatique.** L'app
    prépare, une personne confirme d'un tap (D91).

---

## 1. Anatomie du spécimen

### 1.1 Ce qu'il contient

| Bloc | Contenu | Ce qu'on en tire |
|---|---|---|
| En-tête (p. 1) | Client, sociétés, téléphones, **e-mails**, référence du devis | Membres, annuaire |
| Identité (p. 1) | « ORC 50#25 », base standard, descriptif indice B signé le 07/05/2022 | `builder`, `model`, `hull_number` |
| Commercial (p. 1) | 775 000 € HT, éco-contribution, TVA, **934 418,40 € TTC** | Valeur d'acquisition — **pas une dépense** (§6) |
| Échéancier (p. 1) | 6 acomptes **prévisionnels**, 07/05/2022 → solde à la livraison, 06/01/2024 | `year`, **départ de garantie** |
| Options chiffrées (p. 2) | ~25 lignes avec référence (`STRC01`, `GREM17`, `ACC33`…), marque, quantité, prix, statut | Inventaire **proposé** |
| Chiffrages et études (p. 3) | ~35 lignes sans prix, en attente du chantier | Inventaire **envisagé** |
| En définition / Annulé (p. 4) | Gabarits vides sur cet exemplaire | Rien |
| Pied de page | Marsaudon Composites, Lorient, téléphone, e-mail, RCS, TVA | Contact « chantier constructeur » |

Chaque ligne porte une **référence chantier** (`STRC02`, `GREM19`, `ACC37`, `Ant01`). Stockée dans
`equipment.specs`, elle vaut le jour où l'on commande une pièce : on n'écrit pas « la trinquette »,
on écrit « GREM 19 » et le chantier sait de quoi il s'agit. Aucun concurrent ne porte ce détail,
parce qu'aucun ne part du document du chantier.

### 1.2 Le statut est une colonne, pas un détail

**Validé · À valider · Chiffrage · Annulé**, avec une date de validation ou une date limite. Sur ce
spécimen, la seule ligne validée est la base ORC 50 standard (07/05/2022) ; les 60 autres attendent
une réponse du client ou un chiffrage du chantier, et les commentaires le disent en clair (« A
chiffrer une version plus light ? Carbone », « Se posent la question du prix du pack perfo »,
« 1 manuel et un elec »).

Une lecture qui ignore cette colonne installe à bord des équipements qui n'y sont jamais montés.
C'est exactement le contrat que « À valider » applique déjà aux factures : une proposition, un tap,
une écriture. Le statut du document devient l'état initial de la case à cocher.

### 1.3 Un document de commande vieillit — la règle n° 1 du lecteur

Le spécimen date de janvier 2023 ; le bateau a été livré début 2024. Entre les deux, des options
ont été prises, d'autres abandonnées, d'autres remplacées. En comparant avec ce que le carnet porte
aujourd'hui — **qui fait foi** — au moins cinq postes ont bougé :

| Poste | Le document de janvier 2023 propose | Le carnet porte aujourd'hui |
|---|---|---|
| Voilerie | Incidence Sails (GREM 16→22) | North Sails |
| Pack électronique | NKE « Croisière » | B&G |
| Traceur | Raymarine Axiom 9" | Garmin |
| Panneaux solaires | 1 125 W Back Contact | 990 W |
| Hors-bord d'annexe | Honda 6 cv | Suzuki 45 ch |

Ce n'est pas une anomalie à corriger : c'est **la propriété normale de cette famille de documents**,
et il faut la concevoir dans le lecteur plutôt que la subir. Quatre conséquences :

1. **La date du document s'affiche à côté de chaque ligne proposée**, pas seulement en tête d'écran.
   « Proposé le 31/01/2023 » change ce qu'on fait d'une ligne.
2. **Le carnet gagne toujours.** Une ligne qui contredit une donnée existante ne s'écrase jamais :
   elle s'affiche comme « déjà renseigné : *North Sails* — ce document dit *Incidence Sails* »,
   **décochée**, avec un bouton « remplacer » explicite. Le rapprochement se fait par famille
   d'équipement, pas par libellé (sinon « Traceur Garmin » et « GPS/traceur Raymarine » créent deux
   lignes au lieu d'une contradiction visible).
3. **Un document ancien ne vaut pas moins** : il reste la meilleure source pour tout ce que personne
   n'a jamais saisi — la référence chantier, le fournisseur, le numéro de coque, le contact du
   chantier. Il est mauvais sur ce qui change, bon sur ce qui ne change pas.
4. **L'ordre des documents compte.** Le plus récent prime ; un bon de livraison prime sur le devis
   qui l'a précédé. Le lecteur doit donc connaître la **famille** du document avant de lire son
   contenu (§2).

### 1.4 Ce que le spécimen révèle en passant, sur notre propre modèle

Indépendamment de son contenu, ce document éclaire un point du dépôt : `seed/orc50-checklist.json`
déclare un modèle **`is_public: true`** nommé « ORC 50 — Marsaudon Composites », et **douze de ses
93 points nomment un équipement qui appartient à Xaman #25** :

> « Traceur **Garmin** : mise à jour cartes », « **Starlink** / routeur **RUTX10** », « **B&G** :
> mises à jour firmware », « **B&G** : calibration compas », « Batteries Lithium **Super B** »,
> « Dessalinisateur **Aqua Base** », « Chauffage **Wallas** 30DT », « Emmagasineurs **Karver** »,
> « **Victron** (inverter / chargeur, MPPT, BMV) », « Check winch pied de mât SB (électrique
> **Andersen** ST62) », « **Copper Coat** : polissage et retouches (**Nautix** A88M) », « Chaîne de
> mouillage … ancre **Spade** ».

Ces douze points sont **justes pour Xaman** — c'est précisément le problème : ils sont justes pour
un seul bateau. Le modèle générique catamaran (71 points) ne nomme aucune marque ; le modèle de
niche, lui, est en réalité **le plan d'un exemplaire**, publié à tous. Le prochain ORC 50 qui
s'inscrit hérite du Starlink de Xav et n'a rien pour le matériel qu'il porte.

C'est l'argument le plus court en faveur des deux couches du §4 : ce n'est pas une fonctionnalité
nouvelle, c'est la séparation de deux choses aujourd'hui mélangées.

---

## 2. Le catalogue : ce qu'un propriétaire peut verser

C'est le cœur de ce document. Ces familles existent pour **la majorité des bateaux** ; ce que
change le neuf ou l'occasion, c'est laquelle on a sous la main. « Fiabilité » dit ce qu'on peut
écrire sans demander ; « Jour 1 » marque ce qui produit de la valeur immédiatement.

### 2.1 Vue d'ensemble

| # | Famille | Qui l'a | Ce qu'elle porte | Ce qu'elle remplit | Fiabilité | Jour 1 |
|---|---|---|---|---|:--:|:--:|
| D1 | **Devis / bon de commande / STB** | Neuf | Options, réf. chantier, marques, prix, **statuts** | `equipment`, `contacts`, identité | Intentions datées | |
| D2 | **Bon de livraison / PV de réception** | Neuf | L'inventaire **tel que livré**, n° de série | `equipment` (fait foi), `engines` | **Haute** | ● |
| D3 | **Descriptif technique du modèle** | Neuf | Coque, **moteurs exacts**, réservoirs, dimensions | `boats`, `engines`, modèle de coque | **Haute** | |
| D4 | **Certificat CE / plaque constructeur** | Tous | **Catégorie A/B/C**, personnes max, charge max | `navigation_zone` (D90), points de sécurité | **Haute** | ● |
| D5 | **Carnet de garantie** | Neuf | Dates de départ par ensemble (coque, moteurs, accastillage) | Points à date fixe | Haute | ● |
| D6 | **Fiche de vente / inventaire courtier** | Occasion | Liste d'équipements avec années | `equipment` | Moyenne (commerciale) | ● |
| D7 | **Rapport d'expertise** | Occasion, assurance | État, inventaire, **réserves et recommandations datées** | `equipment`, **points de checklist** | **Haute** | ● |
| D8 | **Acte de francisation / titre de navigation** | Tous | Immatriculation, pavillon, quartier | `registration`, `flag` | **Haute** | |
| D9 | **Attestation d'assurance** | Tous | **Dates de validité**, garanties, **zone couverte** | Point à date fixe, `navigation_zone` | **Haute** | ● |
| D10 | **Licence MMSI / ANFR** | Tous | MMSI, indicatif, **matériel radio avec n° de série** | `equipment` (VHF, AIS, balise) | **Haute** | |
| D11 | **Certificats de révision** | Tous | Radeau, extincteurs, balise, pyrotechnie, gilets : **dates** | Points à date fixe (D11 produit) | **Haute** | ● |
| D12 | **Manuels constructeur** | Tous | **Les intervalles d'entretien réels** | La bibliothèque de règles (§4) | **Haute** | |
| D13 | **Factures d'entretien** | Tous | Travaux, coûts, heures moteur | `maintenance_logs`, `purchases` | Haute | |
| D14 | **Carnet d'entretien papier** | Tous | L'historique | `maintenance_logs` (E3-7) | Variable | |
| D15 | **Photo du compteur d'heures** | Tous | Heures par moteur | `engine_hour_readings` | Haute | ● |
| D16 | **Plans (électrique, plomberie, pont)** | Neuf | Schémas | Documents attachés, rien d'automatique | — | |

D13, D14 et D15 sont **déjà couverts** par « À valider » et par l'import (E12, E3-7, E10-1). Les
treize autres sont neufs.

### 2.2 Les six qui comptent, et pourquoi

**D2 — le bon de livraison.** C'est le document que la STB *deviendra*. Il dit ce qui est monté, en
quelle quantité, avec les numéros de série. Quand il existe, il prime sur tout le reste et referme
la question de l'inventaire en un tap. À demander en premier sur un bateau neuf.

**D7 — le rapport d'expertise.** Le plus riche de tous sur un bateau d'occasion, et le seul qui
porte **des recommandations datées** : « gréement dormant à changer sous 2 ans », « anodes usées à
60 % », « vannes à manœuvrer ». Ce sont des points de checklist prêts à poser, avec leur échéance.
Un propriétaire qui vient d'acheter en a un dans sa boîte mail, et personne ne le lui redemande
jamais.

**D9 + D11 — assurance et certificats de révision.** Deux familles minuscules à lire, et **la
réponse la plus directe au problème du jour 1** (`AUDIT.md §0.3` : « au jour 1, l'app telle que
spécifiée ne rappelle rien »). Une date de péremption de radeau est une échéance vraie, pas une
estimation : `checklist_completions.next_due_at` existe déjà pour la porter (D11). Trois documents
photographiés et la file d'attente est juste.

**D4 — le certificat CE.** Sa catégorie de conception (A hauturier, B au large, C côtier) alimente
`boats.navigation_zone`, que `apply_checklist_template` lit déjà pour écarter les points hauturiers
d'un bateau côtier (D90). Une photo de la plaque du cockpit suffit.

**D12 — les manuels.** Ils ne remplissent pas *un* bateau : ils remplissent **la bibliothèque de
règles** (§4), une fois pour tous les bateaux qui portent le même matériel. C'est le seul document
de la liste qu'on lit pour le compte de tout le monde, et il donne la seule chose qu'on ne doit
jamais inventer : l'intervalle constructeur.

### 2.3 Ce que le lecteur doit savoir faire (exigences déduites)

1. **Reconnaître la famille avant de lire le contenu**, et le dire à l'écran. Un devis, un bon de
   livraison et une expertise ne produisent pas les mêmes lignes ni la même confiance.
2. **Porter la date du document sur chaque ligne** qu'il propose.
3. **Ne jamais écraser le carnet** : contradiction affichée côte à côte, décochée, remplacement
   explicite (§1.3).
4. **Lire les statuts** quand la famille en a, et n'en cocher que le validé.
5. **Rapprocher par famille d'équipement, marque et modèle** — pas par libellé.
6. **Respecter les quantités** : « 2 » sur la ligne d'un chauffage veut dire deux appareils, un par
   coque.
7. **Ne jamais verser un prix d'acquisition dans les dépenses** (§6).
8. **Stocker les références internes** (`GREM19`) sans jamais les afficher comme un nom.
9. **Être idempotent** : le même document versé deux fois produit les mêmes lignes, pas leur double
   (référence dérivée, même mécanique que D97).
10. **Ne jamais inventer un intervalle** : sans source, le point arrive marqué « proposé ».
11. **Traiter les documents comme des données personnelles** : un dossier de commande porte des
    adresses, des téléphones et un prix d'achat. Bucket du bateau sous RLS, coûts derrière la
    bascule du rapport, invisibles au `pro` invité.

---

## 3. Ce que ça change pour la mise en route

L'étape 2 de la mise en route (D67) demande déjà « sur quoi votre carnet est-il écrit aujourd'hui ? ».
Elle parle d'**historique**. Le catalogue du §2 dit qu'il manque la question d'avant : **de quoi le
bateau est-il fait ?** Deux questions, deux réponses, deux lecteurs — et la seconde est celle qui
remplit le carnet.

Proposition de formulation, dans le vocabulaire du bord plutôt que le nôtre :

| L'écran demande | Ce que ça lit | Ce que ça remplit |
|---|---|---|
| « Le dossier de votre bateau » | D1, D2, D3, D6 | Les équipements et leurs fournisseurs |
| « Vos papiers » | D4, D8, D9, D10, D11 | L'identité, la zone, et **les échéances datées** |
| « Votre carnet » (existant) | D13, D14 | L'historique |

Aucune de ces trois questions n'est obligatoire, et chacune peut être repoussée : un carnet qui
démarre avec la seule attestation d'assurance vaut déjà mieux qu'un carnet vide, parce qu'il a une
première échéance vraie.

---

## 4. Le plan d'entretien : deux couches

| Couche | Porte | Exemple | Table |
|---|---|---|---|
| **Coque** | Ce que tout exemplaire du modèle a | dérives sabres, saildrives, traverse carbone, trampoline | `checklist_templates` (existe) |
| **Équipement** | Ce que *ce* bateau porte | chauffage, dessalinisateur, batterie lithium, radeau | `maintenance_rules` (à créer) |

Une **règle** s'attache à une *famille* d'équipement (`equipment_kinds` : dessalinisateur, chauffage
à air pulsé, batterie lithium, emmagasineur, guindeau, radeau, balise, WC marin…) et précise
éventuellement une marque ou un modèle. Elle porte ce qu'un point de checklist porte (libellé,
intervalle en mois et/ou en heures, `engine_scope`, `zone_scope`, actions pas à pas), plus **ses
consommables** (filtre, anode, membrane, turbine) et **sa source** (manuel, page).

Le plan d'un bateau devient : `points du modèle de coque` + `règles de chaque équipement présent`,
recalculé quand un équipement entre (validation d'un document, ajout à la main) ou sort
(« déposé le … »). Pour que rien ne reste orphelin, un point doit savoir ce qu'il entretient :
`checklist_items.equipment_id`, aujourd'hui absent — un point connaît son moteur, pas son matériel.

**Ce que ça vaut.** La règle du chauffage Wallas s'écrit une fois et sert tous les bateaux qui en
portent un. Au bout de quarante familles, n'importe quel voilier de voyage arrive avec un plan juste
sans qu'on ait écrit son modèle. C'est ce que `SPEC.md §3` cherchait — « le modèle exact » — mais
par la bonne clé : **l'équipement, pas la coque.** Et c'est le seul actif du produit qui grandit à
chaque bateau lu au lieu d'être consommé.

---

## 5. Les trois mouvements de l'auto-pilote

Un auto-pilote doit savoir où il est, où il va, et corriger sans qu'on touche la barre.

**A — Le bateau se remplit tout seul.** Le catalogue du §2 entre par « À valider », qui sait déjà
recevoir un PDF par e-mail (`inbox_token`) ou une photo. Le lecteur gagne les familles de documents
et une seconde forme de sortie : non plus une intervention ou un achat, mais **un lot de
propositions** — équipements, fournisseurs, identité, échéances. Écran groupé par système, tout
coché sauf ce que le document ne garantit pas, « Tout ajouter ».

**B — Le plan se déduit de l'équipement.** Les deux couches du §4. Le seul mouvement qui sépare
deux choses aujourd'hui mélangées au lieu d'ajouter une couche par-dessus.

**C — L'état se tient à jour sans saisie.** Le maillon faible, et il faut le dire franchement :
**aucun document ne résout le compteur d'heures.** Trois réponses, par rendement décroissant.
La **photo de l'afficheur devient un relevé** — la lecture extrait déjà des heures moteur
(`engineHours`), il manque le classement à côté d'*intervention* et *achat*. Les **factures
arrivent seules** dès que l'adresse du bateau est donnée au motoriste, ce qui est un geste et non
du code, à écrire comme une consigne dans l'écran et dans l'e-mail de bienvenue. Et **les dates se
posent seules** depuis D5, D9 et D11.

---

## 6. Le principe qui ne bouge pas

**Auto-pilote ne veut pas dire écriture automatique.** Rien n'entre au carnet sans un tap — c'est
déjà la règle de « À valider » (D91 : *« une ligne est une proposition : rien n'est écrit avant le
tap Valider »*), et elle doit tenir pour l'inventaire comme pour les factures.

- Un carnet vaut par l'attestation : à la revente, devant un expert, devant un assureur, c'est une
  personne qui répond de la ligne.
- Un document lu de travers et écrit sans contrôle coûte **plus cher** qu'une saisie à la main : il
  faut d'abord trouver l'erreur.
- Et le §1.3 le montre : un document peut être parfaitement lu et malgré tout périmé. Aucune qualité
  de lecture ne rattrape ça — seul un humain sait que le pack a changé depuis.

Deux garde-fous en découlent. **Le prix d'acquisition n'est pas une dépense** : 934 418 € versés
dans `purchases` écraseraient la vue des douze derniers mois ; la valeur, si on la garde, va sur la
fiche bateau, derrière la bascule « inclure les coûts ». **Un intervalle n'est jamais inventé** :
une règle porte sa source, sinon le point arrive marqué « proposé », comme `source: proposal` le
fait déjà pour les 93 points de l'ORC 50.

---

## 7. Épique proposée — E17, « le carnet se remplit tout seul »

Tailles dans l'échelle du backlog (1 = moins d'une demi-journée, 2 = une demi-journée à une journée,
3 = une à deux journées). **Colonne vertébrale : E17-1 à E17-5** (14 points).

| # | Ticket | Taille |
|---|---|:--:|
| E17-1 | **Lire un document de bateau.** Reconnaissance de la famille (§2.1), sortie en **lot** (identité, équipements, fournisseurs, échéances), statut et date portés ligne à ligne. Le prompt des factures reste intact : c'est une seconde forme de sortie. | 3 |
| E17-2 | **L'écran « ce que j'ai lu ».** Lot groupé par système ; contradiction avec le carnet affichée côte à côte et **décochée** (§1.3) ; « Tout ajouter » idempotent ; rapport « N créés · M reconnus · K écartés » au format E12-1. | 3 |
| E17-3 | **Familles d'équipement.** Référentiel `equipment_kinds` (sans `boat_id`, comme `boat_models`), `equipment.kind_id`, rapprochement à la lecture, modifiable à la main. | 2 |
| E17-4 | **Bibliothèque de règles.** `maintenance_rules` : famille, marque/modèle facultatifs, intervalles, `engine_scope`, `zone_scope`, actions, **consommables**, **source**. Seed de ~25 familles. | 3 |
| E17-5 | **Le plan se compose.** `apply_checklist_template` = modèle de coque + règles des équipements présents ; `checklist_items.equipment_id` ; recalcul à l'ajout et au dépôt. | 3 |
| E17-6 | **Les papiers posent les échéances** (D4, D5, D9, D11) : catégorie CE → `navigation_zone`, dates de validité → points à date fixe. La valeur du jour 1. | 2 |
| E17-7 | **Dégraisser `orc50-v1`** de ses douze marques (§1.4) vers les règles ; migration des bateaux déjà instanciés. | 2 |
| E17-8 | **Les consommables suivent l'équipement** : les pièces d'une règle alimentent le stock et « À racheter » (E13-7) avec le bon fournisseur. Aucune double saisie. | 2 |
| E17-9 | **Le compteur se relève en photo.** Troisième classement de « À valider » : *relevé*. Appel depuis la bande des moteurs après 60 jours sans relevé. | 2 |
| E17-10 | **Le digest sait où on en est** : l'e-mail hebdomadaire (E9-6) devient contextuel — avant une sortie de l'eau, à J-30 d'une péremption, à l'entrée de l'hiver. | 2 |

**Décisions.** La première est prise : **D113 — le carnet fait foi, un document ne l'écrase jamais**
(§1.3). Les trois autres s'ouvriront avec l'épique, leurs numéros pris à ce moment-là :

1. Le plan d'entretien se compose de deux couches ; un modèle de bateau ne nomme jamais une marque.
2. Un intervalle sans source constructeur est marqué « proposé » et le reste à l'écran.
3. Le prix d'acquisition n'entre pas dans les dépenses.

---

## 8. Ce que ça donnerait sur Xaman

Douze règles tirées de l'équipement que **le carnet porte aujourd'hui**. La colonne de droite dit ce
que le plan actuel en fait : un de ces points n'existe pas, un deuxième n'est couvert qu'en partie,
un troisième compte un appareil pour deux — et **les autres n'existent que parce qu'ils ont été
tapés à la main pour ce bateau-ci**, donc manqueront à tout autre bateau portant le même matériel.

| Équipement du carnet | Point que la règle pose | Intervalle | Dans le plan actuel ? |
|---|---|---|---|
| Chauffage Wallas 30DT | Entretien brûleur, filtre à gasoil, essai avant l'hiver | 12 m | Oui, **une seule fois** pour deux coques |
| Dessalinisateur Aqua Base 65 L/h | Rinçage, préfiltres, conservation de membrane | 3 m | Oui, marque nommée |
| Batteries lithium Super B ×3 | Contrôle BMS, équilibrage, tension par cellule | 6 m | Oui, marque nommée |
| Emmagasineurs Karver | Rinçage, roulements, sangles, émerillons | 6 m | Oui, marque nommée |
| Kit sécurité cat. A 10 pers. (radeau) | **Révision — valide jusqu'au** | date fixe | Oui (36 m) |
| Balise EPIRB | Autotest, **date de batterie**, enregistrement ANFR | date fixe | Oui (12 m) |
| Victron (MPPT, inverter, BMV) | Firmware, paramètres, essai de bascule de source | 12 m | Oui, marque nommée |
| Chargeur de quai 40 A | Essai, câble de quai, isolateur galvanique | 12 m | Oui, sans la marque |
| Guindeau électrique | Graissage, barbotin, disjoncteur | 6 m | Oui |
| Lave-linge 3 kg | Filtre, fixation, vidange de saison | 12 m | Oui |
| **Tablette durcie Sailproof** | Charge, étanchéité, mise à jour | 12 m | **Non** |
| **Roof et cloisons carbone** | Laquage, liaisons, inspection de délaminage | 12 m | **En partie** (le point ne couvre que la traverse et les poutres) |

Et ce que les documents du §2 remplissent hors checklist. **Déjà appliqué au seed le 14/09**, sous
la règle D113 et sans reporter aucune des cinq divergences du §1.3 : le contact **Marsaudon
Composites** (le pied de page du spécimen porte adresse, téléphone et e-mail), six
`specs.ref_chantier` sur les équipements dont la désignation correspond mot pour mot à la ligne du
chantier, et les références du dossier dans les notes du bateau. **Reste ouvert dans E8-1** : les
deux adresses e-mail de Xavier et Emmanuel — celles du document datent de 2023, des comptes réels
existent en production, et le seed *invite* l'adresse qu'il lit ; les cinq autres intervenants ;
`flag`, `home_port`, `year` ; et le modèle exact des Yanmar, qui est dans le **descriptif technique
standard** (D3), pas dans la STB.

---

## 9. Ce qu'on ne fait pas

- **Pas de télémétrie.** Les relevés automatiques Victron / NMEA (E11-7) demandent un boîtier à
  bord ; la photo du compteur ne demande rien.
- **Pas de commande de pièces.** La référence chantier suffit à savoir quoi demander ; passer la
  commande est un autre métier.
- **Pas de cote de valeur.** Le document porte un prix d'achat ; en faire une estimation serait la
  dispersion fonctionnelle que `AUDIT.md §2` liste comme piège du secteur.
- **Pas d'exploitation automatique des plans** (D16) : on les stocke, on ne les lit pas.
- **Pas de nouveau module.** Tout se loge dans « À valider », la checklist et la fiche Bateau.

## 10. Risques et garde-fous

| Risque | Garde-fou |
|---|---|
| Un document périmé écrase une donnée juste | Le carnet fait foi : contradiction affichée, décochée, remplacement explicite (§1.3) |
| Une option jamais montée entre à l'inventaire | Le statut du document décide de l'état initial de la case |
| Un intervalle inventé passe pour une préconisation | Source obligatoire, sinon « proposé » ; test qui refuse une règle sans source |
| La bibliothèque devient un second backlog | Une famille entre quand un bateau réel la porte, jamais « au cas où » |
| Le même document versé deux fois | Référence dérivée du document (mécanique de D97) |
| Documents personnels et prix d'achat | Bucket du bateau sous RLS, coûts derrière la bascule du rapport, invisibles au `pro` |
| Coût des appels au modèle | Ces documents se lisent **une fois par bateau** ; le lecteur local (D92) reste la porte de secours |
| Deux documents de familles différentes se contredisent | Le plus récent prime, et la famille arbitre : un bon de livraison prime sur le devis |

---

## 11. Si l'on ne devait garder qu'une chose

**Demander les papiers, pas seulement le carnet.** E17-6 est le plus petit des tickets de la liste
et le seul qui donne de la valeur le premier jour : trois photos — assurance, radeau, extincteurs —
et la file d'attente cesse d'être vide, avec des dates vraies plutôt qu'estimées. Le reste (la
bibliothèque de règles, la lecture des inventaires) est plus structurant, mais se construit ensuite,
et peut commencer à la main avec les vingt-cinq familles que le carnet de Xaman porte déjà.
