# Xaman — Ce qu'un document de chantier permet d'automatiser

> **Proposition, 13 septembre 2026.** Rien n'est tranché ici : aucun numéro de décision (`DECISIONS.md`)
> ni de ticket (`BACKLOG.md`) n'est pris tant que ce document n'est pas validé. L'épique E17 décrite
> au §6 prendra sa ligne dans le tableau des compteurs le jour où elle s'ouvre.
>
> **Source lue** : *Spécification Technique de Besoin*, Marsaudon Composites, ORC 50 #25, document
> créé le 31/01/2023, 4 pages — c'est-à-dire le dossier de commande de **Xaman lui-même**. La
> question posée : « on peut récupérer ça sur la majorité des bateaux, qu'est-ce qu'on en fait ? »

---

## 0. En dix lignes

1. Ce document n'est pas une fiche technique : c'est un **tableau de commande d'options**, avec une
   référence chantier, une marque, un prix et **un statut** par ligne. Environ **60 lignes** sur Xaman.
2. Ce statut est le cœur du sujet : **« Validé » · « A valider » · « Chiffrage » · « ANNULE »**. Une
   lecture qui l'ignore installe à bord des équipements qui n'y sont jamais montés.
3. Le seed actuel de Xaman a été écrit sans ce filtre, et **il contredit le document sur cinq points**
   (voilerie, électronique, traceur, puissance solaire, hors-bord de l'annexe) — §1.3.
4. Second défaut, plus grave : le modèle de checklist `orc50-v1`, marqué `is_public`, porte
   **treize marques propres à Xaman #25** (Garmin, Starlink, B&G, Super B, Aqua Base, Karver…).
   Le deuxième ORC 50 qui s'inscrit hérite du Starlink de Xav — §1.4.
5. Ces deux défauts ont la même cause et la même réponse : **le plan d'entretien d'un bateau ne se
   déduit pas de son modèle, il se déduit de ce qui est réellement à bord.**
6. D'où l'architecture proposée : **deux couches**. Le modèle de coque (ce que tout ORC 50 a) +
   une **bibliothèque de règles par famille d'équipement** (ce que ce bateau-ci a). Le plan est leur
   composition, recalculée quand un équipement entre ou sort.
7. La bibliothèque de règles est **l'actif qui compose** : écrite une fois pour un chauffage Wallas,
   elle sert tous les bateaux qui en portent un. C'est le seul différenciateur qui grandit tout seul.
8. Le document donne aussi, gratuitement, ce que personne n'a envie de retaper : **l'annuaire des
   fournisseurs** (une trentaine de marques citées), les références chantier pour commander une pièce, et
   **les deux adresses e-mail** que le ticket E8-1 attend depuis le début.
9. Ce que le document **ne** donne pas : le modèle exact des Yanmar (il est dans le descriptif
   standard, pas dans la STB), les numéros de série, et l'état du bateau aujourd'hui.
10. Le principe qui ne bouge pas : **auto-pilote ne veut pas dire écriture automatique.** L'app
    prépare, une personne confirme d'un tap. C'est déjà la règle de « À valider » (D91) ; un carnet
    d'entretien ne vaut que par l'attestation humaine qui le signe.

---

## 1. Ce que contient réellement ce document

### 1.1 Sa structure

| Bloc | Contenu | Ce qu'on en tire |
|---|---|---|
| En-tête (p. 1) | Client, sociétés, téléphones, **e-mails**, référence du devis | Membres, annuaire |
| Identité (p. 1) | « ORC 50#25 », base standard, descriptif indice B signé le 07/05/2022 | `builder`, `model`, `hull_number` |
| Commercial (p. 1) | 775 000 € HT, éco-contribution, TVA, **934 418,40 € TTC** | Valeur assurée — **pas une dépense** (§4) |
| Échéancier (p. 1) | 6 acomptes **prévisionnels**, 07/05/2022 → solde à la livraison, **06/01/2024** | `year`, **départ de garantie** |
| Options validées / à valider (p. 2) | ~25 lignes chiffrées avec référence (`STRC01`, `GREM17`, `ACC33`…) | Inventaire d'équipements |
| Chiffrages et études (p. 3) | ~35 lignes sans prix, en attente du chantier | Inventaire **probable**, à confirmer |
| En définition / Annulé (p. 4) | Gabarits vides sur cet exemplaire | Rien |
| Pied de page | Marsaudon Composites, Lorient, téléphone, e-mail, RCS, TVA | Contact « chantier constructeur » |

### 1.2 Le piège : c'est un document de négociation

Chaque ligne porte un statut et une date. Sur cet exemplaire, **aucune option n'est au statut
« Validé »** hormis la base standard : tout le reste est « A valider » (page 2, échéance 01/02/2023)
ou « Chiffrage » (page 3, en attente du chantier). Le document est daté du 31/01/2023 et le bateau a
été livré début 2024 : **entre les deux, des options ont été prises, d'autres abandonnées, d'autres
changées.** Les colonnes de commentaires le disent en clair (« A chiffrer une version plus light ?
Carbone », « Se posent la question du prix du pack perfo », « 1 manuel et un elec »).

Conséquence pour le produit : **une STB se lit comme une proposition, jamais comme un inventaire.**
Le document qui fait foi est le **bon de livraison** ou l'inventaire de fin de chantier. La lecture
doit donc remonter le statut ligne à ligne et l'app doit le montrer — ce qu'elle sait déjà faire, car
c'est exactement le contrat de « À valider » : une proposition, un tap, une écriture.

### 1.3 Ce que la lecture apprend sur le seed actuel

Cinq contradictions entre `seed/xaman-boat.json` et le document. Elles ne sont pas toutes des
erreurs — le bateau a pu changer d'option après janvier 2023 — mais **aucune n'est tracée**, et
personne ne sait aujourd'hui laquelle des deux versions est vraie.

| Sujet | Seed Xaman | STB 31/01/2023 |
|---|---|---|
| Voilerie | **North Sails** | **Incidence Sails** (GREM 16 à 22, plus-value 34 953 € HT) |
| Pack électronique | **B&G** (centrale, instruments, pilote) | **NKE** « Croisière » + calculateur pilote NKE |
| Traceur | **Garmin** | **Raymarine Axiom 9"** + Navionics+ Europe de l'Ouest |
| Panneaux solaires | **990 W** | **1 125 W** Back Contact sur bossoirs (55 kg) |
| Hors-bord d'annexe | **Suzuki 45 ch** | **Honda 6 cv** sur annexe Highfield UL310 Hypalon |

Trois écarts mineurs de plus : le gennaker A0 (131 m² Stormlite au document, 220 m² au seed), le spi
asymétrique (A5 au document, A4 au seed), et le chauffage Wallas 30DT (**deux** unités, une par
coque, au document ; une seule au seed).

### 1.4 Le défaut que ce document met au jour

`seed/orc50-checklist.json` déclare un modèle **`is_public: true`** nommé « ORC 50 — Marsaudon
Composites ». Il contient 93 points, dont **douze** nomment une marque qui n'appartient qu'à
**Xaman #25** :

> « Traceur **Garmin** : mise à jour cartes », « **Starlink** / routeur **RUTX10** », « **B&G** :
> mises à jour firmware », « **B&G** : calibration compas », « Batteries Lithium **Super B** »,
> « Dessalinisateur **Aqua Base** », « Chauffage **Wallas** 30DT », « Emmagasineurs **Karver** »,
> « **Copper Coat** : polissage léger et retouches (**Nautix** A88M) », « Check winch pied de mât SB
> (électrique **Andersen** ST62) », « **Victron** (inverter / chargeur, MPPT, BMV) », « chaîne de
> mouillage … ancre **Spade** ».

Deux conséquences, l'une produit, l'autre de justesse :

- **Le prochain ORC 50 qui s'inscrit hérite du Starlink de Xav**, et n'a aucun point pour le
  matériel qu'il porte réellement. Le modèle générique catamaran (71 points) est propre de ce
  point de vue : aucune marque. Le modèle de niche, lui, est en réalité *le plan d'un bateau*.
- **Deux de ces marques sont fausses** au regard du document source (B&G, Garmin). Un point de
  checklist qui nomme un appareil inexistant ne sera jamais coché, donc restera rouge, donc
  décrédibilisera la file d'attente — le mécanisme même sur lequel repose le produit.

C'est le meilleur argument pour la couche de règles du §3 : **ce n'est pas une fonctionnalité
nouvelle, c'est la réparation d'une confusion de couches déjà présente dans le dépôt.**

---

## 2. Les cinq gisements d'un document de ce type

Généralisable : sur un bateau neuf c'est la STB ou le bon de livraison ; sur un bateau d'occasion,
la fiche du courtier, l'inventaire de vente ou le rapport d'expertise. Les cinq gisements sont les
mêmes.

| # | Gisement | Ce qu'il remplit dans Xaman | Sur ce document |
|---|---|---|---|
| G1 | **Identité** | `boats` : chantier, modèle, n° de coque, année, valeur | 6 champs, dont le n° de coque **25** |
| G2 | **Inventaire** | `equipment` : nom, marque, modèle, `specs`, référence chantier | ~60 lignes |
| G3 | **Fournisseurs** | `contacts` : chantier, voilerie, accastilleur, motoriste | une trentaine de marques |
| G4 | **Le plan d'entretien** | `checklist_items`, via les règles du §3 | ~25 familles d'équipement |
| G5 | **Les dates** | `checklist_completions.next_due_at` (D11) : garantie, révisions, péremptions | livraison 06/01/2024 |

G2 mérite une précision : chaque ligne porte une **référence chantier** (`STRC02`, `GREM19`,
`ACC37`, `Ant01`). Stockée dans `equipment.specs`, elle vaut de l'or le jour où l'on commande une
pièce : on n'écrit pas « la trinquette », on écrit « GREM 19 » et le chantier sait exactement de
quoi il s'agit. C'est le genre de détail qu'aucun concurrent ne porte, parce qu'aucun ne part du
document du chantier.

---

## 3. Trois mouvements, pour mettre l'app en auto-pilote

Un auto-pilote a besoin de trois choses : savoir **où il est** (l'état), savoir **où il doit aller**
(le plan), et **corriger sans qu'on touche la barre** (l'entrée de données). Xaman a le plan, un
état partiel, et un seul canal d'entrée. Voici ce que le document change, mouvement par mouvement.

### A. Le bateau se remplit tout seul

**Aujourd'hui.** Le carnet arrive vide. La mise en route (D67, trois étapes) demande le nom, la
coque, le nombre de moteurs et le plan. Les équipements se saisissent un par un, ou s'importent en
CSV (E12) — ce que personne n'a sous la main. Le seed de Xaman a été écrit **à la main** à partir
de cette STB, avec les cinq erreurs du §1.3 pour preuve que c'est un travail de copiste.

**Proposé.** L'étape 2 de la mise en route demande déjà « sur quoi votre carnet est-il écrit
aujourd'hui ? ». On y ajoute une réponse : **« J'ai le dossier du chantier »**. Le document part
dans « À valider », qui sait déjà le recevoir par e-mail (`inbox_token`) ou par photo, et le lecteur
gagne un type de document : `spec`. Sa sortie n'est ni une intervention ni un achat, mais **un lot
de propositions** — équipements, fournisseurs, identité, dates.

L'écran de validation reprend la forme que l'app connaît : groupé par système, **tout coché**, le
statut du document en tête de chaque ligne (*Validé* · *À valider* · *Chiffrage* · *Annulé*), les
lignes non validées **décochées par défaut** avec la mention « proposé au chantier, non confirmé ».
Un bouton : « Tout ajouter ». Idempotent (règle 11) : l'`external_ref` de chaque équipement est
dérivée du document et de sa ligne, donc deux validations écrivent la même liste, pas deux.

**Ce que ça vaut.** Le coût d'amorçage est « le premier tueur de ces produits » (`SPEC.md §3.3`).
C'est le seul mouvement qui l'attaque à la racine : 60 lignes d'inventaire en un tap, à partir d'un
PDF que le propriétaire a déjà dans sa boîte mail.

### B. Le plan se déduit de l'équipement

**Aujourd'hui.** Le plan vient d'un modèle par bateau-modèle. Il y en a quatre génériques et un de
niche, et ce dernier est en réalité le plan d'un bateau précis (§1.4).

**Proposé.** Deux couches qui se composent.

| Couche | Porte | Exemple | Table |
|---|---|---|---|
| **Coque** | Ce que tout exemplaire du modèle a | dérives sabres, saildrives, traverse carbone, trampoline | `checklist_templates` (existe) |
| **Équipement** | Ce que *ce* bateau porte | chauffage Wallas, dessalinisateur, batteries lithium, radeau 10 pers. | `maintenance_rules` (à créer) |

Une **règle** est attachée à une *famille* d'équipement (`equipment_kinds` : dessalinisateur,
chauffage à air pulsé, batterie lithium, emmagasineur, guindeau, radeau, EPIRB, WC marin…), et
précise éventuellement une marque ou un modèle. Elle porte ce qu'un point de checklist porte
(libellé, intervalle en mois et/ou en heures, `engine_scope`, `zone_scope`, actions pas à pas) et,
en plus, **ses consommables** (le filtre, l'anode, la membrane, la turbine).

Le plan d'un bateau devient : `points du modèle de coque` + `règles de chaque équipement présent`.
Il se recalcule quand un équipement entre (validation d'un document, ajout à la main) et quand il
sort (`déposé le …`) — et un point ne reste jamais orphelin, parce qu'il sait ce qu'il entretient
(`checklist_items.equipment_id`, aujourd'hui absent : un point connaît son moteur, pas son matériel).

**Ce que ça vaut.** Trois choses, dans l'ordre d'importance :

1. **L'actif compose.** La règle du Wallas 30DT s'écrit une fois et sert tous les bateaux qui en
   portent un. Au bout de 40 familles, n'importe quel voilier de voyage arrive avec un plan juste,
   sans qu'on ait écrit son modèle. C'est ce que `SPEC.md §3` cherchait — « le modèle exact » — mais
   par la bonne clé : **l'équipement, pas la coque.** Ready4Sea revendique une base de modèles ;
   personne ne descend au matériel réellement embarqué.
2. **La promesse devient vraie pour le 2ᵉ bateau.** Aujourd'hui elle n'est vraie que pour Xaman,
   parce que quelqu'un a tapé ses 93 points à la main.
3. **Ça répare le §1.4** au lieu d'ajouter une couche par-dessus.

### C. L'état se tient à jour sans saisie

Le maillon faible, et il faut le dire franchement : **aucun document ne résout le compteur
d'heures.** Or la moitié des points moteurs ont un intervalle en heures, et un cochage sans heures
est refusé en base (`check_completion_hours`). Trois réponses, par ordre de rendement :

1. **La photo du compteur devient un relevé.** « À valider » lit déjà les heures moteur d'un
   document (`engineHours` dans la suggestion, rapprochées de `engine_id`). Il manque le troisième
   classement, à côté de *intervention* et *achat* : **relevé**. Une photo de l'afficheur, un tap,
   le compteur avance. La bande des moteurs du tableau de bord porte l'appel quand un compteur n'a
   pas bougé depuis 60 jours (le bandeau existe déjà, il ne propose que la saisie au clavier).
2. **Les factures arrivent toutes seules.** L'adresse e-mail du bateau existe. Ce qui manque est un
   geste, pas du code : la donner au motoriste, au chantier, au voilier, une fois. À écrire dans
   l'écran « À valider » comme une consigne (« transférez vos factures à cette adresse »), et dans
   le premier e-mail de bienvenue.
3. **Les dates se posent seules.** Garantie du chantier (livraison + 24 mois), révision du radeau,
   péremption des fusées et de la batterie d'EPIRB, assurance, visite. Le modèle sait déjà porter
   une échéance à date fixe (`next_due_at`, D11) ; il manque que **la lecture du document la pose**.
   Sur cette STB : le solde à la livraison, prévu au 06/01/2024, date le départ de la garantie.

Et une quatrième, plus tard : les relevés automatiques Victron / NMEA sont déjà au backlog en E11-7.
Ils ne sont pas le chemin court — ils demandent un boîtier à bord, ce que la photo ne demande pas.

---

## 4. Le principe qui ne bouge pas

**Auto-pilote ne veut pas dire écriture automatique.** Rien n'entre au carnet sans un tap. C'est
déjà la règle de « À valider » (D91 : *« Une ligne est une proposition : rien n'est écrit avant le
tap Valider »*), et elle doit tenir pour l'inventaire comme pour les factures. Trois raisons :

- Un carnet d'entretien vaut par l'attestation : à la revente, à l'assurance, devant un expert,
  c'est une personne qui répond de la ligne, pas un lecteur automatique.
- Un document lu avec erreur et écrit sans contrôle est **plus coûteux** qu'une saisie manuelle : il
  faut d'abord trouver l'erreur.
- La lecture du §1.3 le prouve : cinq contradictions sur un seul document. La bonne réponse n'est pas
  de mieux lire, c'est de **montrer ce qu'on a lu, avec son statut et sa source**, et de laisser
  trancher.

Deux garde-fous qui en découlent :

- **Le prix d'achat n'est pas une dépense.** 934 418,40 € versés dans `purchases` écraseraient la
  vue des dépenses sur douze mois et fausseraient tous les totaux. La valeur d'acquisition, si on la
  garde, va sur la fiche bateau, derrière la bascule « inclure les coûts » du rapport.
- **Un intervalle n'est jamais inventé.** Une règle porte sa source (manuel constructeur, page,
  version). Sans source, le point arrive marqué « proposé » — comme `source: proposal` le fait déjà
  pour les 93 points de l'ORC 50 — et jamais présenté comme une préconisation du constructeur.

---

## 5. Ce que ça donnerait sur Xaman, concrètement

Seize règles tirées des équipements lus dans cette STB. La colonne de droite dit ce que le plan
actuel en fait : deux de ces points n'existent nulle part, un troisième compte un appareil pour
deux — et **les treize autres n'existent que parce qu'ils ont été tapés à la main pour ce
bateau-ci**, c'est-à-dire qu'ils manqueront à tout autre bateau portant le même matériel.

| Équipement lu | Point que la règle pose | Intervalle | Dans le plan actuel ? |
|---|---|---|---|
| Chauffage Wallas 30DT (**×2**) | Entretien brûleur, filtre à gasoil, essai avant l'hiver | 12 m | Oui, **une seule fois** pour deux appareils |
| Dessalinisateur Aquabase 65 L/h | Rinçage, préfiltres, conservation de membrane | 3 m | Oui (nommé « Aqua Base ») |
| Batteries lithium Super B 210 Ah ×3 | Contrôle BMS, équilibrage, tension par cellule | 6 m | Oui (nommé « Super B ») |
| Emmagasineurs Karver (KFX10, KF6.0) | Rinçage, roulements, sangles, émerillons | 6 m | Oui (nommé « Karver ») |
| Radeau 10 pers. cat. A | **Révision — valide jusqu'au** | date fixe | Oui (36 m) |
| EPIRB / balise | Autotest, **date de batterie**, enregistrement ANFR | date fixe | Oui (12 m) |
| Convertisseur Victron 3 000 W | Firmware, paramètres, essai de bascule de source | 12 m | Oui (nommé « Victron ») |
| Chargeur de quai Cristec 40 A | Essai, câble de quai, isolateur galvanique | 12 m | Oui, **sans la marque** |
| **Lave-linge Daewoo 3 kg** | Filtre, fixation, vidange de saison | 12 m | Oui |
| **Guindeau électrique** | Graissage, barbotin, disjoncteur | 6 m | Oui |
| **Hi-fi JL Audio + 4 HP étanches** | Contrôle des HP de cockpit (sel, joints) | 12 m | **Non** |
| **Bossoirs alu, charge utile 200 kg** | Fixations, palans, **contrôle de charge** avec les panneaux | 6 m | Oui |
| **Portes composites étanches (STRC08)** | Joints, verrous, étanchéité | 12 m | **Non** |
| **Winch électrique Andersen ST62** | Révision annuelle **électrique** (distincte du winch manuel) | 12 m | Partiellement |
| **Commandes moteur électriques ZF** | Calibration, connexions, essai aux deux postes | 12 m | Oui |
| **Antifouling Nautix A88M / Coppercoat** | Deux plans d'entretien **opposés** selon celui qui a été appliqué | 12 m / 18 m | Oui, mais le document ne tranche pas |

Et ce que le document remplit **hors checklist**, en une validation :

- **`contacts`** : Marsaudon Composites (chantier constructeur, Lorient, téléphone et e-mail au pied
  de page), Incidence Sails (voilerie), et les marques à joindre pour une pièce — Karver, Lorima,
  NKE, Raymarine, Icom, Victron, Cristec, Wallas, Aquabase, Highfield, Honda, Spade, Andersen,
  Nautix. Les six fiches de l'annuaire sont aujourd'hui à `"name": "TODO"`.
- **`boats`** : `hull_number = 25`, `builder`, `model`, `year` (livraison prévue au 06/01/2024).
- **`members`** : les deux adresses e-mail que **E8-1** attend (`seed/xaman-boat.json` porte encore
  `TODO-xavier@example.com` et `TODO-emmanuel@example.com`). Elles sont au premier bloc du document.
- **Ce qu'il ne donne pas** : le modèle exact des Yanmar (`"model": "TODO"` dans le seed) — il est
  dans le *descriptif technique standard indice B*, pas dans la STB. Deux documents, pas un.

Autrement dit : **E8-1 — l'un des deux seuls tickets Must encore intouchés, avec la QA iPad E9-4 —
se referme en grande partie par la lecture d'un document que Xav a déjà.**

---

## 6. Épique proposée — E17, « le carnet se remplit tout seul »

Tailles dans l'échelle du backlog (1 = moins d'une demi-journée, 2 = une demi-journée à une journée,
3 = une à deux journées). **La colonne vertébrale est E17-1 à E17-5** (14 points) ; le reste suit et
peut attendre.

| # | Ticket | Taille |
|---|---|:--:|
| E17-1 | **Lire un document d'inventaire.** Type `spec` dans « À valider » ; sortie = un lot (identité, équipements, fournisseurs, dates), avec le **statut de chaque ligne** et sa référence chantier. Le prompt existant reste intact : c'est une seconde forme de sortie, pas une modification de la première. | 3 |
| E17-2 | **L'écran « ce que j'ai lu ».** Lot groupé par système, tout coché sauf les lignes non validées, source et statut visibles ligne à ligne, « Tout ajouter » idempotent (`external_ref` dérivée, règle 11), rapport « N créés · M reconnus · K écartés » au format de E12-1. | 3 |
| E17-3 | **Familles d'équipement.** Référentiel `equipment_kinds` (sans `boat_id`, comme `boat_models`), `equipment.kind_id`, rapprochement automatique à la lecture et modifiable à la main sur la fiche. | 2 |
| E17-4 | **Bibliothèque de règles.** `maintenance_rules` : famille, marque/modèle facultatifs, libellé, intervalles, `engine_scope`, `zone_scope`, actions, **consommables**, **source** (manuel, page). Seed de ~25 familles couvrant le gros du parc. | 3 |
| E17-5 | **Le plan se compose.** `apply_checklist_template` devient « modèle de coque + règles des équipements présents » ; `checklist_items.equipment_id` ; recalcul à l'ajout et au dépôt d'un équipement ; jamais de doublon, jamais de point orphelin. | 3 |
| E17-6 | **Dégraisser `orc50-v1`.** Les treize marques du §1.4 sortent du modèle public vers les règles ; le modèle ne garde que ce que *tout* ORC 50 porte. Migration de données pour les bateaux déjà instanciés. | 2 |
| E17-7 | **Les consommables suivent l'équipement.** Les pièces d'une règle alimentent le stock et la liste « À racheter » (E13-7) avec le bon fournisseur. Aucune double saisie — c'est la demande de Xav, mot pour mot. | 2 |
| E17-8 | **Le compteur se relève en photo.** Troisième classement de « À valider » : *relevé*. Appel depuis la bande des moteurs quand un compteur dort depuis 60 jours. | 2 |
| E17-9 | **Le digest sait où on en est.** L'e-mail hebdomadaire (E9-6) devient contextuel : avant une sortie de l'eau, à J-30 d'une péremption, à l'entrée de l'hiver. Un seul e-mail, toujours. | 2 |

**Décisions à ouvrir** (numéros à prendre dans `DECISIONS.md` au moment de l'ouverture, pas avant) :

1. Un document d'inventaire propose, il n'écrit pas — les lignes non validées par le chantier
   arrivent décochées.
2. Le plan d'entretien se compose de deux couches ; un modèle de bateau ne nomme jamais une marque.
3. Un intervalle sans source constructeur est marqué « proposé » et le reste à l'écran.
4. Le prix d'acquisition n'entre pas dans les dépenses.

---

## 7. Ce qu'on ne fait pas

- **Pas de télémétrie.** Victron / NMEA reste en E11-7. Ça demande un boîtier ; la photo du compteur
  ne demande rien, et `SPEC.md §5.4` a déjà tranché.
- **Pas de commande de pièces ni de place de marché.** La référence chantier suffit à *savoir quoi
  demander* ; passer la commande est un autre métier.
- **Pas d'estimation de valeur ni de cote.** Le document porte un prix d'achat ; en faire une cote
  serait la « dispersion fonctionnelle » que `AUDIT.md §2` liste comme piège du secteur.
- **Pas de reconnaissance de plaques ou de numéros de série par photo** tant que la lecture de
  documents n'est pas solide.
- **Pas de nouveau module.** Tout ce qui précède se loge dans « À valider », la checklist et la
  fiche Bateau. Aucun onglet supplémentaire (`AUDIT.md §3.2`, D8).

## 8. Risques et garde-fous

| Risque | Garde-fou |
|---|---|
| La lecture installe un équipement jamais monté | Le statut du document est lu, affiché, et décoche la ligne |
| Un intervalle inventé passe pour une préconisation | Source obligatoire, sinon « proposé » ; test qui refuse une règle sans source |
| La bibliothèque de règles devient un second backlog | Une famille entre quand un bateau réel la porte, jamais « au cas où » |
| Le lot écrit deux fois | `external_ref` dérivée du document (même mécanique que D97) |
| Le document contient des données personnelles et un prix | Il vit dans le bucket du bateau, sous RLS ; les coûts restent derrière la bascule du rapport ; le `pro` invité ne les voit pas |
| Le coût des appels au modèle | Un document d'inventaire est lu **une fois par bateau** ; le lecteur local (D92) reste la porte de secours |
| La STB contredit le carnet déjà saisi | La validation rapproche au lieu d'écraser : une ligne déjà connue est « reconnue », pas recréée (E12-1) |

---

## 9. Si l'on ne devait garder qu'une chose

**Écrire la bibliothèque de règles (E17-3, E17-4, E17-5) et vider `orc50-v1` de ses marques.**
C'est la seule des neuf propositions qui répare un défaut existant, qui rend la promesse du produit
vraie pour le deuxième bateau, et dont la valeur grandit à chaque bateau lu au lieu d'être consommée.
La lecture du document (E17-1, E17-2) est ce qui la remplit vite — mais on peut commencer à la
remplir à la main, avec les vingt-cinq familles que porte déjà le carnet de Xaman.
