# Xaman — Cahier des charges MVP

> Carnet d'entretien numérique et partagé pour bateaux.
> Version 1.0 — 2 septembre 2026 — Rédigé pour être exécuté par Claude Code.
> Documents liés : `CLAUDE.md` (conventions), `DATA-MODEL.md` (schéma), `BACKLOG.md` (tickets), `seed/` (données Xaman + checklist ORC 50).

---

## 0. Résumé exécutif

Xaman est une application web (PWA) qui remplace le carnet d'entretien papier d'un bateau par un dossier vivant, partagé entre toutes les personnes qui interviennent sur ce bateau : propriétaires, associés, équipage, professionnels (mécanicien, voilier, chantier) et, plus tard, loueurs, locataires, clubs de voile et constructeurs.

Le premier bateau est **Xaman**, un catamaran Marsaudon Composites ORC 50 (#25), navigué en Méditerranée par Xavier (propriétaire) et Emmanuel Lesaffre (associé). Joseph porte le produit. Le MVP livre exactement ce dont Xaman a besoin aujourd'hui, mais construit dès le départ sur un modèle multi-bateaux / multi-acteurs pour que la généralisation ne nécessite aucune refonte.

**Contrainte n°1 : l'application doit fonctionner parfaitement sur iPad Safari** (appareil principal à bord), puis iPhone, Mac et Android.

**Périmètre V1 (décisions du 2 sept. 2026)**

| Sujet | Décision |
|---|---|
| Stack | Next.js (App Router, TypeScript) + Supabase (Postgres, Auth, Storage, RLS) + Vercel, packagée en PWA |
| Livraison | **Web app hébergée sur Vercel** (une URL, utilisable dans Safari / Chrome), installable en PWA ; projets Supabase et Vercel créés par Claude Code via leurs MCP au démarrage |
| Multi-acteurs | Modèle de données multi-bateaux / multi-organisations dès la V1 ; UI V1 = un bateau, 4 rôles simples (owner, editor, pro, viewer) |
| Offline | V1 : app consultable sans réseau (cache de lecture), écritures en ligne uniquement. Offline-first en V2 |
| Livrable | Pack prêt pour Claude Code : CLAUDE.md, SPEC.md, DATA-MODEL.md, BACKLOG.md, seeds JSON |
| Langue | UI en français (structure i18n prête pour l'anglais) ; code, schéma et commits en anglais |

---

## 1. Contexte et problème

Aujourd'hui, l'entretien de Xaman est tenu dans un carnet papier. Conséquences : historique difficile à consulter, pas de partage entre Xav et Emmanuel, pas de rappels d'échéances, pas de vue des dépenses, aucune trace exploitable pour un professionnel qui monte à bord ou pour une revente.

Un prototype en artifact Claude (React/HTML) a été testé : il ne fonctionne pas dans l'app Claude sur iPad et le `localStorage` ne permet pas le partage entre appareils. Il faut donc une vraie application hébergée, avec une base partagée.

Le besoin de Xaman est celui de tout propriétaire de bateau. Et la donnée d'entretien intéresse bien d'autres acteurs que le propriétaire : c'est l'opportunité produit.

## 2. Vision produit

**« La donnée suit le bateau, pas la personne. »**

Un bateau = un dossier unique (fiche technique, journal des interventions, checklists d'entretien, consommables et pièces, sorties de l'eau, intervenants, documents). Ce dossier est partagé avec les bonnes personnes, avec les bons droits, et il reste attaché au bateau quand les personnes changent (vente, changement d'équipage, nouveau mécano).

Trois convictions qui structurent le produit :

1. **Checklists par modèle de bateau.** Un ORC 50 n'a pas les mêmes points de contrôle qu'un First 36. Xaman fournit des checklists pré-remplies par constructeur/modèle, avec les actions détaillées pas à pas, que l'utilisateur complète avec ses propres points. C'est le principal différenciateur face aux concurrents : ceux qui pré-remplissent le font par type de bateau ou par équipement générique, jamais au modèle exact avec les gestes détaillés (voir §3).
2. **Multi-acteurs natif.** Un pro invité voit ce qu'il doit voir et enregistre ses interventions directement dans le journal du bateau. Demain : un loueur gère sa flotte, un locataire coche la checklist de départ, un club suit ses bateaux, un chantier publie la checklist officielle de son modèle.
3. **Utilisable à bord.** iPad en plein soleil, doigts mouillés, connexion Starlink intermittente : gros boutons, contraste élevé, saisie en moins de 30 secondes, lecture possible sans réseau.

## 3. Positionnement concurrentiel

> Réécrit le 2 sept. 2026 à partir du benchmark consolidé (`docs/AUDIT.md`, source « benchmark »). La version initiale de cette section affirmait qu'il n'existait que deux concurrents (VesselFile, BoatMatey) et qu'« aucun n'est en français » : c'était faux. Les prix sont ceux affichés publiquement à cette date ; les mentions « à vérifier » n'ont pas pu être reconfirmées (fiches de stores inaccessibles).

### 3.1 Le marché

Le marché du carnet d'entretien nautique compte **au moins douze acteurs pertinents, dont cinq francophones**. Il se lit en quatre segments qui n'ont ni les mêmes acheteurs ni les mêmes prix :

| Segment | Acteurs | Prix d'entrée | Ce qu'il faut en retenir |
|---|---|---|---|
| Superyacht / PMS professionnel | Seahub, Nauticoncept (B2B), BoatOn Book flotte | 1 500–3 000 $/an et plus, devis, 3–10 k€/an | Vivier de patterns (ordres de travail, procédures, rôles), pas un concurrent |
| Prosumer / conformité | Vessel Vanguard, Yacht Manager App | 299 $/an, formules | Templates par type de bateau, rôles, hors ligne |
| **Plaisancier exigeant — zone Xaman** | **Ready4Sea**, **BoatOn Book**, **Boatwise**, VesselFile, BoatMatey | **< 30 €/an**, **4,99 €/mois**, **49 €/an**, freemium | Encombré mais mal servi : généralistes, anglophones ou orientés flotte |
| Grand public / gratuit | Eloyot, YachtWave, Boatlogger, TheBoatApp, Seanapps (Bénéteau) | Gratuit + option | Diagnostic, logbook, télémétrie constructeur |
| **Le statu quo** | Carnet papier (ex. Nautilog), Excel / Google Sheets, Notes, mémoire | ~0 € | **≈ 90 % du parc. C'est le concurrent réel.** |

Trois noms cités dans la commande initiale n'existent pas sous cette forme : « Sailwise » (le produit réel est **Boatwise**), « PropellerPro » (Propeller est une plateforme de location) et « Nautilog » (un carnet **papier**, pas une application).

### 3.2 Les cinq acteurs à connaître

| | **Ready4Sea** (FR) | **BoatOn Book** (FR) | **Boatwise** (EU, EN) | **Eloyot** (FR) | **Seanapps** (Bénéteau, FR) | **Xaman** |
|---|---|---|---|---|---|---|
| Cible | Plaisanciers voile et moteur ; depuis 2025 aussi voitures, camping-cars, maisons, piscines | Du plaisancier aux flottes pro (GMAO) | « Independent boat owners » | Plaisanciers, usage achat / vente / assurance | Propriétaires de bateaux Bénéteau (boîtier connecté) | Propriétaires et copropriétaires de voiliers de voyage, entretien à deux mains |
| Journal d'entretien | Oui, interventions rattachées au plan | Oui, échéance calculée, alertes J-30 / J-7 | Oui, l'historique se construit tâche par tâche | Oui, interventions en quelques clics | Préconisations issues des capteurs | Oui, une seule saisie < 30 s, heures moteur auto-relevées |
| Heures moteur | Relevés manuels par « unit » | Présentes dans la logique d'échéance (à vérifier) | **Absentes** (éliminatoire pour un catamaran bimoteur) | Non | **Automatiques** (NMEA 2000 / horamètre) | Par moteur, relevé indépendant ou depuis une intervention |
| Échéances | Date, calendrier synchronisable | Date, algorithme de prochaine échéance | Date, documents à expiration, alerte **avant** | Non (diagnostic à un instant T) | Temps réel capteurs | Date **ou** heures, premier atteint, **affiché en clair** |
| Checklists / référentiel | **Base de modèles** de bateaux et d'équipements → plan d'entretien (granularité : générique + équipement) | Inventaire par équipement | **Jeu de départ par type** de bateau | ~50 points génériques avec fiches pédagogiques d'expert | ~35 points de contrôle = capteurs | **Modèle exact** (ORC 50) + **actions détaillées** rédigées par un praticien, progression par système |
| Stock / dépenses | Partiel | Stock avec seuils, budget dépenses et revenus | Pièces avec alerte stock bas, coûts par tâche | Photos et factures | — | Achats, gaz, stock simple avec seuil, dépenses ventilées |
| Partage / rôles | Peu mis en avant | **3 rôles** : Marin, Propriétaire (**lecture seule**), Prestataire (tâches assignées) | Non mis en avant | Non | Concessionnaire | **Propriétaire auteur, pro invité** restreint et révocable, appliqué en base (RLS) |
| Plateformes | iOS, Android, web ; pensé téléphone | Web, tablette, mobile, temps réel, **hors ligne** | Web | iOS, Android | iOS, Android + boîtier | PWA iPad-first, temps réel, lecture hors ligne (saisie hors ligne V2) |
| Langue | Français | Français | Anglais | Français | Français | **Français** |
| Prix | **< 30 €/an**, version gratuite | **4,99 €/mois** (≈ 60 €/an), sans engagement | **8 €/mois ou 49 €/an**, essai 14 j | Gratuit + Eloyot+ (rapport) | App gratuite, kit Retrofit (prix à vérifier) | Gratuit pour Xaman ; modèle à définir |
| Données | À vérifier | À vérifier | À vérifier | Rapport PDF | Liées au boîtier | **Export JSON/CSV complet, garanti et affiché** |

VesselFile (US) et BoatMatey (UK) restent des références solides sur le journal et les rappels (BoatMatey a un module haul-out ; VesselFile un transfert à la vente), mais elles sont anglophones et leurs tarifs premium n'ont pas pu être reconfirmés.

### 3.3 Ce que cela change pour Xaman

1. **Le concurrent réel est le papier et le tableur.** Les retours de forums convergent : une app « trop sophistiquée perd la valeur d'un outil quick and dirty », et « construire la base de données demande un effort significatif ». **Le coût d'amorçage est le premier tueur de ces produits, pas le manque de fonctions.** D'où la promesse : le bateau arrive **déjà rempli** avec son modèle exact.
2. **« Premier atteint » (date ou heures) est un table stake**, pas une innovation : Mercury, MaintainX, Drivvo le font. Ce qui est rarement bien fait, et que Xaman soigne, c'est **l'afficher en clair** (« 15/03 ou 780 h, au premier atteint — reste 42 j / 61 h »).
3. **Les checklists par modèle sont partiellement occupées** (Ready4Sea revendique une base de modèles ; Boatwise et Yacht Manager ont des templates par type). Le différenciateur défendable est **le modèle exact + les actions détaillées pas à pas**, que personne ne fait sur les modèles de niche.
4. **Le multi-acteurs existe partout** (BoatOn a trois rôles, Nauticoncept relie technicien / concession / propriétaire). Ce qui n'existe pas en grand public : un **propriétaire auteur principal** (BoatOn le met en lecture seule), un **pro invité vraiment contraint** (lit tout, écrit ses lignes, ne supprime rien, ne voit pas les membres) et une **révocation qui laisse l'intervention dans le journal**. C'est un argument de confiance, à énoncer comme une promesse.
5. **Ne jamais se positionner sur « l'état du bateau »** (terrain de Seanapps et de la télémétrie), mais sur **« la mémoire des interventions et le partage entre ceux qui entretiennent »**.
6. **La dispersion fonctionnelle est le piège documenté du secteur** (Ready4Sea couvre désormais les piscines). Xaman occupe la place laissée libre : **un bateau, à bord, à deux.**
7. **Les prix du marché plafonnent l'ambition tarifaire** : < 30 €/an (Ready4Sea), 49 €/an (Boatwise), 60 €/an (BoatOn). Toute offre payante future doit se situer dans cette fourchette et ne jamais faire payer le partage.

**Pitch.** Xaman est le carnet d'entretien partagé des voiliers de voyage : le bateau arrive déjà rempli avec son modèle exact, une intervention se saisit en moins de trente secondes sur un iPad mouillé, l'associé voit la ligne apparaître en direct, le mécano invité ne peut rien effacer, et les données s'exportent en un clic, toujours.

**À vérifier avant toute décision de pricing** (bloquant) : les tarifs exacts de VesselFile, BoatMatey, Ready4Sea Standard/Premium et Seanapps ; la granularité réelle de la base de modèles Ready4Sea (modèle exact ou catégorie) ; les avis de stores FR.

## 4. Utilisateurs et rôles

### 4.1 Personas V1 (actifs dans le MVP)

| Persona | Exemple | Ce qu'il fait dans Xaman |
|---|---|---|
| Propriétaire (`owner`) | Xavier | Tout : données, membres, invitations, suppression du bateau |
| Associé / co-gestionnaire (`editor`) | Emmanuel, Joseph | Tout sur les données du bateau ; pas de gestion des membres |
| Professionnel invité (`pro`) | Mécano Yanmar, voilier | Lit tout, crée/édite **ses** interventions et cochages, ne supprime pas, ne voit pas les membres |
| Lecteur (`viewer`) | Acheteur potentiel, expert | Lecture seule |
| Admin plateforme | Joseph | Crée des bateaux, gère les modèles de checklist, supervise (via Supabase Studio en V1, pas d'UI dédiée) |

### 4.2 Personas futurs (modélisés, non activés en V1)

Ces rôles sont réservés dans l'énumération `boat_role` et dans la table `organizations` ; aucune UI n'est livrée en V1.

| Persona | Besoin | Ce que le modèle V1 prévoit |
|---|---|---|
| Loueur / société de charter | Gérer une flotte, checklists départ/retour, coûts par bateau | `organizations` (type `charter`) possédant N bateaux |
| Locataire | Accès temporaire à la checklist de départ/retour et aux consignes | Rôle `renter` avec `valid_from` / `valid_until` sur `boat_members` |
| Club de voile | Flotte, membres, planning d'entretien mutualisé | `organizations` (type `club`) |
| Constructeur / chantier | Publier la checklist officielle d'un modèle, voir l'état de la flotte de ses clients (avec consentement) | `checklist_templates` avec `owner_organization_id` et `is_public` |
| Mécanicien / prestataire multi-bateaux | Voir tous les bateaux sur lesquels il intervient | Un utilisateur `pro` membre de N bateaux (déjà possible en V1) |

### 4.3 Matrice de droits V1

| Action | owner | editor | pro | viewer |
|---|:-:|:-:|:-:|:-:|
| Lire toutes les données du bateau | ✔ | ✔ | ✔ | ✔ |
| Créer / modifier interventions, relevés d'heures, cochages de checklist, pièces jointes | ✔ | ✔ | ses propres lignes uniquement (création + modification, sans mise à la corbeille) | ✘ |
| Créer / modifier achats, pièces en stock, sorties d'eau, contacts, équipements, moteurs | ✔ | ✔ | ✘ | ✘ |
| Ajouter / modifier / désactiver un point de checklist ou une catégorie | ✔ | ✔ | ✘ | ✘ |
| Supprimer / mettre à la corbeille une donnée | ✔ | ✔ | ✘ | ✘ |
| Modifier la fiche bateau | ✔ | ✔ | ✘ | ✘ |
| Voir la liste des membres | ✔ | ✔ | ✘ (voit seulement le nom des auteurs des lignes) | ✘ |
| Inviter / retirer un membre, changer un rôle | ✔ | ✘ | ✘ | ✘ |
| Exporter les données du bateau | ✔ | ✔ | ✘ | ✘ |
| Supprimer le bateau | ✔ | ✘ | ✘ | ✘ |

Toutes ces règles sont appliquées **en base par RLS** (voir `DATA-MODEL.md`), jamais uniquement côté client. L'admin plateforme est traité en base comme un `owner` virtuel de tous les bateaux (`boat_role()` renvoie `owner`), ce qui lui permet de créer le premier bateau et ses membres.

## 5. Périmètre fonctionnel

Priorisation MoSCoW. **Must** = livré dans le MVP, **Should** = dans le MVP si le planning le permet (fin de V1), **Could** = V1.1, **Won't** = hors V1.

### 5.1 Must — cœur du MVP

#### M1. Authentification et accès
- Connexion **sans mot de passe** (Supabase Auth, e-mail OTP) : l'utilisateur saisit son e-mail et reçoit un e-mail contenant un **code à 6 chiffres** à taper dans l'app (et, en secours, un lien magique). Le code est le mode principal : sur iPad, un lien cliqué depuis Mail s'ouvre dans Safari et non dans la PWA installée, alors que le code se saisit dans l'app où l'on est. Session persistante sur l'appareil (PWA installée comprise).
- Profil minimal : nom affiché, e-mail, langue (fr par défaut).
- **Invitation à un bateau** par e-mail avec un rôle. La page d'invitation affiche le nom du bateau, l'inviteur et le rôle (fonction serveur dédiée, sans exposer la table), le destinataire se connecte avec son e-mail et devient membre. Lien valable 14 jours, révocable.
- Gestion des membres (owner) : liste, changement de rôle, retrait.
- Première mise en route : Joseph (admin plateforme) exécute le seed, qui **crée les comptes** de Xavier (`owner`), Emmanuel (`editor`) et Joseph (`editor` + admin plateforme) via l'API admin Supabase (chacun reçoit un e-mail d'invitation Supabase) et les inscrit directement comme membres du bateau. **Depuis D64, un compte sans bateau ajoute le sien** : `/boats/new` demande un nom, un modèle et le nombre de moteurs, puis `create_boat` crée le bateau, inscrit la personne comme `owner`, crée les moteurs et instancie le modèle. Le modèle reste obligatoire (aucun bateau vide) et la table `boats` reste fermée en insertion — la fonction est la seule porte. Un compte sans bateau n'est donc plus une page d'attente.

#### M2. Fiche bateau
- Identité : nom, constructeur, modèle, numéro de coque, année, type (catamaran, monocoque, moteur…), pavillon, port d'attache, longueur/largeur/tirant d'eau, photo.
- **Moteurs** : liste des moteurs du bateau (Xaman : Yanmar SB, Yanmar BB, hors-bord annexe Suzuki 45 ch), chacun avec marque, modèle, série, et **compteur d'heures courant** (dernier relevé). Saisie rapide d'un relevé d'heures depuis la fiche.
- **Équipements** par système (les 8 catégories du bateau) : nom, marque, modèle, série, date d'installation, caractéristiques libres, notes. Le seed Xaman pré-remplit tout ce qui figure dans la STB Marsaudon (structure, gréement, voiles, électricité, électronique, équipements, mouillage, antifouling Copper Coat…).
- Notes libres (ex. : « pas d'antifouling classique annuel — polissage et retouches »).

#### M3. Journal des interventions (journal de bord d'entretien)
Chaque intervention contient : **titre** (ex. « Vidange moteur SB »), **catégorie** (un des systèmes du bateau ; obligatoire à la saisie, nullable en base pour l'import), **statut** (Planifié / En cours / Terminé / Urgent), **priorité** (Basse / Normale / Haute), **date de l'intervention**, **prochaine échéance** (date, optionnelle), **heures moteur** au moment de l'intervention (un champ par moteur, optionnel — le remplir crée automatiquement un relevé d'heures), **coût** (€), **prestataire** (choisi dans l'annuaire, ou « nous-mêmes »), **notes libres**, et (Should) photos / pièces jointes.

Fonctions :
- Liste avec résumé (titre, catégorie colorée, statut en badge coloré, date, coût), triée par date décroissante, **filtres** par catégorie et statut, **recherche texte** (titre + notes), vue détail au clic.
- Ajout / modification / suppression (suppression = corbeille commune aux interventions, achats et sorties de l'eau, restauration possible 30 jours ; `deleted_at`).
- Depuis une intervention terminée, possibilité de **cocher les points de checklist** correspondants (lien intervention ↔ cochage) — Must ; le pré-cochage automatique par mots-clés est Should.
- Import initial : les 10 entrées du carnet papier de Xaman (2025-2026) sont importées via le seed. Toutes les lignes portant des heures moteur reçoivent le drapeau « à vérifier » car la série d'heures est globalement incohérente (voir §9.3) ; leurs heures sont conservées en attente et transformées en relevés quand Xav marque la ligne comme vérifiée.

#### M4. Checklist d'entretien par catégorie — **le point clé UX**
Navigation attendue :
1. L'utilisateur voit les **8 catégories** (cartes colorées avec barre de progression et nombre de points en retard).
2. Il choisit une catégorie (ex. Voiles & Gréement) et voit la **liste des points** avec, pour chacun : libellé, intervalle recommandé (« 6 mois », « 200 h moteur »), dernière réalisation (date + qui), **état** calculé (À faire / OK / Bientôt / En retard). Un filtre « À traiter » masque les points OK.
3. Il **coche** un point : un dialogue demande la date (défaut : aujourd'hui), qui (défaut : l'utilisateur), les heures moteur si le point est lié à un moteur (**obligatoires** si le point a un intervalle en heures, pré-remplies avec le compteur courant), une note. Le cochage est historisé (on garde toutes les réalisations passées).
4. Il **ajoute un nouveau point** directement dans la catégorie : libellé, intervalle (mois et/ou heures moteur), description, étapes détaillées optionnelles. Le point est persistant et visible par tous les membres.
5. Il peut modifier ou désactiver un point (les points désactivés restent dans l'historique).
6. Chaque point peut avoir des **actions détaillées déroulables** (étapes pas à pas), fournies par le modèle ou saisies à la main.

Règles de calcul de l'état d'un point (définies précisément dans `DATA-MODEL.md`, vue `checklist_item_status`) :
- Jamais fait → « À faire » (gris ; valeur technique `never`).
- Échéance par date = dernière réalisation + `interval_months` (mois calendaires) ; échéance par heures = heures à la dernière réalisation + `interval_hours` sur le moteur lié. Si les deux existent, **la première atteinte compte**.
- En retard (rouge) si l'échéance est dépassée ; Bientôt (orange) si dans les 30 jours ou 25 h ; OK (vert) sinon. Un point sans intervalle déjà fait reste OK.
- Progression d'une catégorie = points OK ou Bientôt / points actifs (« — » si la catégorie n'a aucun point actif). Le nombre de points en retard est affiché séparément.
- Une catégorie désactivée disparaît de la checklist, du dashboard et des filtres ; les données qui la référencent restent visibles avec un badge « catégorie archivée ».

Modèle de checklist :
- La checklist d'un bateau est **instanciée depuis un modèle** (`checklist_template`) au moment de la création du bateau. Pour Xaman : modèle « ORC 50 — Marsaudon Composites ». Les points marqués `engine_scope: inboard` (ou `outboard`, `all`) dans le modèle sont dupliqués pour chaque moteur concerné du bateau (« Vidange huile — Moteur SB », « … — Moteur BB »).
- Le seed contient les points du briefing (Voiles & Gréement, dont les 8 winches) et une proposition de points standards pour les 7 autres catégories, chaque point étant marqué `source: briefing` ou `source: proposal`. **La liste complète de Xav (80+ points) remplacera les propositions** dès qu'elle est fournie ; le format JSON du seed est fait pour ça.
- Un bateau sans modèle correspondant démarre avec un modèle « Générique voilier » ou « Générique moteur » (V1 : structure présente, contenu minimal).
- Un moteur ajouté après l'instanciation ne reçoit pas automatiquement ses points ; la fiche moteur propose l'action « Générer les points de checklist de ce moteur » (rejoue le modèle pour ce seul moteur).

#### M5. Consommables & pièces
- **Suivi gaz** : date, type de bouteille, fournisseur, montant. Vue dédiée (liste des changements de bouteille, nombre moyen de jours entre deux changements toutes bouteilles confondues en V1, date estimée du prochain changement).
- **Journal d'achats** : date, désignation, montant, fournisseur (annuaire ou texte libre), catégorie (système du bateau), type (gaz / pièce / consommable / prestation / autre), lien optionnel vers une intervention, notes.
- **Stock de pièces de rechange** : désignation, référence, quantité en stock, seuil d'alerte, emplacement à bord, fournisseur, notes. Alerte visuelle (badge) quand le seuil est défini (> 0) et que la quantité lui est inférieure ou égale. Gestion manuelle des quantités (+ / −). *Arbitrage : le briefing liste le stock en must-have et « gestion des stocks de pièces » en hors-scope ; on livre le stock simple ci-dessus, et on exclut l'inventaire avancé (emplacements multiples, codes-barres, décrément automatique depuis les interventions).*
- **Dépenses ventilées** : total par catégorie et par type sur une période (mois, année, personnalisée), en combinant coûts des interventions, achats et sorties de l'eau. Export CSV.

#### M6. Sorties de l'eau (carénages)
- Journal des sorties de l'eau : date de sortie, date de remise à l'eau (durée calculée), chantier (annuaire), travaux effectués (texte), coût, notes. Liens vers les interventions réalisées pendant la sortie.
- Rappel dans le dashboard de la date de la dernière sortie et du nombre de mois écoulés.

#### M7. Annuaire des intervenants
- Liste des prestataires du bateau : nom, société, spécialité (chantier carénage, voilier, électronicien B&G, motoriste Yanmar, gréeur, mécanicien Suzuki, autre…), téléphone (cliquable → appel), e-mail (cliquable), adresse / port, notes.
- Utilisé comme référence dans interventions, achats et sorties de l'eau. Consultable depuis le bateau, y compris hors réseau (cache).

#### M8. Dashboard du bateau
- En-tête sombre (dégradé `#0C1B33` → `#1E3A5F`) avec le nom du bateau et 4 stats en temps réel : points en retard, interventions planifiées/urgentes, heures moteur (par moteur), dépenses de l'année.
- Grille des 8 catégories avec couleur, progression et compteur de retard → accès direct à la checklist de la catégorie.
- Liste « À faire prochainement » : points de checklist en retard ou bientôt + interventions planifiées / urgentes / en cours. Tri : interventions urgentes, puis points en retard (retard le plus grand d'abord), puis interventions en cours et planifiées par date, puis points « bientôt » par jours / heures restants.
- Dernières interventions (5).

#### M9. Partage temps réel entre membres
- Toute donnée saisie par un membre est visible par les autres au rechargement, et **en direct** sur les écrans ouverts (Supabase Realtime sur les 8 tables métier listées dans `DATA-MODEL.md §7`, filtré par bateau).

#### M10. PWA iPad-first
- Manifest (nom, icônes, `display: standalone`, couleur de thème), installable sur l'écran d'accueil iPad / iPhone / Android.
- Service worker : cache de l'app shell et des dernières données lues (mode consultation hors réseau). Bandeau « Hors ligne — consultation seule » ; les formulaires sont désactivés hors ligne avec message clair. Aucune perte silencieuse de saisie : si l'envoi échoue, le formulaire reste rempli et propose de réessayer.
- Cibles : iPad (Safari, paysage et portrait, 768–1366 px), iPhone, Mac, Android Chrome. Zones tactiles ≥ 44 px, pas d'interaction dépendant du survol, contraste élevé (usage en plein soleil), police ≥ 16 px dans les champs (évite le zoom auto iOS).

#### M11. Export des données
- Export complet du bateau en JSON (toutes les tables) et en CSV (une archive zip avec un fichier par table) depuis les paramètres du bateau. Principe : l'utilisateur est propriétaire de ses données.

### 5.2 Should — dans la V1 si possible

- **S1. Pièces jointes** : photos et documents (PDF) sur interventions, équipements, sorties de l'eau, achats (facture). Supabase Storage, bucket privé par bateau, prise de photo directe depuis l'iPad. Limite 10 Mo / fichier.
- **S2. Sélecteur de bateau** : si un utilisateur est membre de plusieurs bateaux, un sélecteur en haut de l'app. Coût faible, valide le multi-tenant tôt.
- **S3. Historique des relevés d'heures** par moteur (liste), base du graphique V2.
- **S4. Doublon d'intervention** (« refaire cette intervention ») pour saisir vite une opération récurrente.
- **S5. Journal d'activité** simple : qui a modifié quoi (via `created_by` / `updated_by` + `updated_at`, affiché dans les détails).

### 5.3 Could — V1.1

- Notifications / rappels d'échéance (e-mail hebdomadaire de synthèse ; push web sur PWA installée).
- Export PDF de la checklist d'une catégorie ou du journal sur une période.
- Graphique des heures moteur dans le temps et par intervention.
- ~~Création libre d'un bateau par un nouvel utilisateur (onboarding public) et choix du modèle de checklist.~~ **Livré (D64)** : `/boats/new`, `create_boat` (`0015`).
- ~~Modèle de checklist générique (voilier / moteur) complet.~~ **Livré (D64)** : trois modèles génériques (catamaran, monocoque, moteur) dans `0016`. Reste hors V1 : un modèle par constructeur au-delà de l'ORC 50.

### 5.4 Won't — hors V1

- Offline-first avec écriture hors réseau et synchronisation (V2 ; le modèle de données est compatible : identifiants UUID générés côté client, horodatages, pas de compteurs auto-incrémentés).
- Applications natives iOS / Android (la PWA couvre le besoin).
- UI organisations / flottes / loueurs / locataires / clubs / constructeurs (modèle prévu, voir §4.2).
- Inventaire avancé de pièces (emplacements multiples, codes-barres, décrément automatique).
- Facturation / abonnement / paiement.
- Intégration des instruments (B&G, Victron, NMEA) — piste V3 intéressante (relevé d'heures automatique).
- Marketplace de modèles de checklists communautaires.

## 6. Parcours utilisateur clés

### 6.1 Première connexion d'Emmanuel (invité)
1. Reçoit un e-mail « Xavier vous invite sur Xaman (ORC 50) en tant qu'éditeur ».
2. Clique → page d'invitation (nom du bateau, inviteur, rôle) → e-mail pré-rempli → reçoit un code à 6 chiffres → le saisit → connecté et membre.
3. Atterrit sur le dashboard de Xaman. Bannière « Ajouter Xaman à l'écran d'accueil » (instructions Safari : Partager → Sur l'écran d'accueil).

### 6.2 Vidange à quai (moins d'une minute)
1. Dashboard → bouton « + Intervention ».
2. Titre « Vidange moteur SB » (suggestions à la frappe depuis les titres existants), catégorie Moteurs pré-sélectionnée si l'on vient de cette checklist, statut Terminé, date aujourd'hui, heures moteur SB pré-remplies avec le dernier relevé (modifiables), coût, prestataire, note, photo (Should).
3. Enregistrer → l'intervention apparaît en tête du journal ; un relevé d'heures SB est créé ; proposition : « Cocher les points de checklist correspondants ? » avec les points de la catégorie Moteurs (SB) pré-cochés s'ils matchent le titre (heuristique simple sur les mots-clés « vidange », « filtre », etc. — Should).

### 6.3 Check printanier des voiles (la navigation clé)
1. Dashboard → carte « Voiles & Gréement » (progression 40 %, 3 en retard).
2. Liste des points ; les points en retard en haut. Tap sur « Check winch GV SB » → étapes déroulées (démontage, nettoyage, graissage cliquets).
3. Bouton « Fait » → dialogue (date, qui, note) → validé, l'état passe au vert, la barre de progression avance.
4. Tap « + Ajouter un point » → « Vérifier la drisse hookée du Code 0 — 6 mois » → visible immédiatement par Xav.

### 6.4 Le mécano Yanmar monte à bord
1. Xav l'invite en `pro` depuis Membres.
2. Le mécano ouvre Xaman sur son téléphone, voit l'historique des moteurs, les heures, les équipements, la checklist Moteurs.
3. Il enregistre son intervention (titre, heures, coût, notes) et coche les points réalisés. Il ne peut pas supprimer ni voir les membres.
4. Xav retire l'accès quand il veut ; l'intervention reste dans le journal.

### 6.5 Consultation en mer sans réseau
1. Starlink coupé. L'app s'ouvre (cache), bandeau « Hors ligne ».
2. L'annuaire, la fiche bateau, la checklist et le journal sont consultables dans l'état de la dernière synchronisation.
3. Les boutons d'ajout sont grisés avec l'explication ; dès le retour du réseau, tout redevient actif.

## 7. Exigences non fonctionnelles

| Domaine | Exigence |
|---|---|
| Compatibilité | Safari iOS/iPadOS (2 dernières versions majeures), Chrome Android, Safari/Chrome macOS. Test systématique en viewport iPad paysage 1024×768 et portrait 768×1024, plus iPhone 390×844 |
| Performance | Chargement initial < 3 s sur Starlink (~50 Mbps, latence 40-80 ms) ; navigation entre écrans < 300 ms (données en cache TanStack Query) ; enregistrement d'une intervention < 1 s ressenti |
| Sécurité | RLS activée sur **toutes** les tables ; aucune clé service côté client ; politiques Storage par bateau ; invitations à jeton aléatoire à usage unique ; pas de données personnelles au-delà nom/e-mail |
| Confidentialité | Données hébergées dans l'UE (région Supabase `eu-west` ou `eu-central`) ; export et suppression de compte possibles (RGPD) |
| Fiabilité | Sauvegardes quotidiennes Supabase (PITR si plan le permet) ; migrations versionnées dans le repo ; aucune modification de schéma à la main en prod |
| Accessibilité | Contraste AA minimum, tailles tactiles ≥ 44 px, navigation clavier sur Mac, labels de formulaires explicites |
| i18n | Toutes les chaînes dans `src/messages/fr.json` (format `next-intl`), pas de texte en dur dans les composants ; dates au format français (`dd/MM/yyyy`), monnaie EUR |
| Observabilité | Logs Vercel + Supabase ; capture d'erreurs front (Sentry ou équivalent, optionnel V1) ; page de statut simple `/health` |
| Qualité | TypeScript strict ; lint + typecheck + tests unitaires en CI (GitHub Actions) ; tests E2E Playwright sur les parcours §6.1 à §6.4 en viewport iPad (le §6.5 est couvert par le critère §11-8, test manuel) |

## 8. Architecture et stack

### 8.1 Choix

| Couche | Choix | Pourquoi |
|---|---|---|
| Framework | **Next.js** (dernière version stable, App Router, TypeScript strict) | PWA, SSR pour le chargement initial, écosystème, déploiement Vercel natif |
| UI | **Tailwind CSS + shadcn/ui** (Radix) | Composants accessibles, rapides à adapter au design de référence, bons sur tactile |
| Données client | **TanStack Query** avec persistance (`persistQueryClient` → IndexedDB) | Cache de lecture hors ligne, invalidation simple, base pour l'offline V2 |
| Formulaires | **react-hook-form + zod** | Validation partagée client / serveur (mêmes schémas zod utilisés dans les Server Actions) |
| Backend | **Supabase** : Postgres, Auth (e-mail OTP : code + lien), Storage, Realtime, RLS | Multi-tenant sûr par RLS, pas de serveur à maintenir, MCP déjà connecté |
| Accès données | `@supabase/ssr` + `supabase-js` ; lectures via client Supabase (RLS), écritures via **Server Actions** validées par zod puis Supabase (RLS aussi) | Une seule source de vérité pour les droits : la base |
| PWA | **Serwist** (successeur de next-pwa) : manifest + service worker (app shell precache, runtime cache) | Maintenu, compatible App Router |
| Hébergement | **Vercel** (front) + **Supabase** (données), région UE | Déploiement par branche, previews sur PR |
| Migrations | **Supabase CLI** (`supabase/migrations/*.sql`), types générés (`supabase gen types`) | Schéma versionné, types TS synchronisés |
| Tests | Vitest (unitaires : calcul des états de checklist, schémas zod), Playwright (E2E iPad) | Le calcul d'état est la logique la plus sensible |
| Outillage | pnpm, ESLint, Prettier, GitHub Actions, Conventional Commits | Standard |

### 8.2 Principes d'architecture
- **Multi-tenant par `boat_id`** : toute table métier porte `boat_id` ; toute politique RLS passe par `is_boat_member(boat_id)` / `boat_role(boat_id)`. Les organisations sont un niveau au-dessus (`boats.organization_id`, nullable), sans effet en V1.
- **Identifiants UUID générés côté client** (`crypto.randomUUID()`) pour toutes les insertions : prérequis de l'offline V2, permet aussi l'optimistic UI.
- **Dates** : dates d'intervention / réalisation en `date` (pas de fuseau) ; horodatages techniques en `timestamptz`.
- **Soft delete** (`deleted_at`) sur les interventions, achats, sorties de l'eau ; filtré par défaut dans les vues.
- **Audit léger** : `created_by`, `created_at`, `updated_by`, `updated_at` sur toutes les tables métier (trigger `set_updated_at`).
- **Calculs en base** : états de checklist, heures courantes par moteur, dépenses ventilées = vues SQL (`DATA-MODEL.md`), pour que web, exports et futures apps partagent la même logique.
- **Realtime** : un abonnement par `boat_id` sur les 8 tables de `DATA-MODEL.md §7` → invalidation des queries concernées.
- **Vues SQL en `security_invoker`** : toute vue est créée `with (security_invoker = true)` pour que la RLS des tables sous-jacentes s'applique ; sinon une vue s'exécute avec les droits de son propriétaire et contourne la RLS.
- **Privilèges de colonnes** : les colonnes sensibles (`boat_invitations.token`, `profiles.is_platform_admin`) sont retirées du rôle `authenticated` (`revoke select/update (col)`), en plus de la RLS.
- **Seeds** : `seed/*.json` chargés par un script `pnpm seed:xaman` (idempotent, clé naturelle = `external_ref`), utilisable en local, preview et prod.

### 8.3 Structure du projet (cible)

```
xaman/
  CLAUDE.md
  KICKOFF.md       procédure de bootstrap infra (E0-0)
  .env.example
  docs/            SPEC.md, DATA-MODEL.md, BACKLOG.md, DECISIONS.md
  seed/            xaman-boat.json, orc50-checklist.json, xaman-history.json
  supabase/
    migrations/    0001_init.sql, 0002_rls.sql, 0003_views.sql, ...
    seed.sql       (données de dev uniquement)
  src/
    app/           routes App Router : (auth)/login, (auth)/invite/[token], (app)/boats/[boatId]/{dashboard,logs,logs/trash,checklist,supplies,haul-outs,contacts,boat,members,settings}, (app)/settings/profile, dev/ui (hors prod)
    components/    ui/ (shadcn), boat/, logs/, checklist/, supplies/, layout/
    lib/           supabase/{client,server,middleware}.ts, queries/, actions/, schemas/ (zod), checklist-status.ts, format.ts
    messages/      fr.json (en.json plus tard)
    types/         database.ts (généré)
  scripts/         seed.ts (données réelles : pnpm seed:xaman), export.ts
  supabase/seed.sql  (dev et CI uniquement : 5 utilisateurs de test + bateau de test pour les tests RLS et E2E)
  tests/           unit/, e2e/
```

## 9. Données initiales (seed Xaman)

### 9.1 Bateau
Voir `seed/xaman-boat.json` : identité (Marsaudon Composites ORC 50 #25 « Xaman », catamaran), 3 moteurs (Yanmar SB, Yanmar BB, Suzuki 45 ch annexe), équipements par système issus de la STB (coque sandwich PVC / vinylester, cloisons et roof carbone, dérives sabres carbone, mât carbone Lorima, haubans textiles kevlar, winch électrique Andersen ST62, voiles North Sails Hydranet — GV 88 m², J1 60 m², J2 37,8 m², J3 20 m², Code 0 87,5 m², spi léger 220 m², spi lourd 170 m² —, emmagasineurs Karver, 3 × batteries lithium Super B 210 Ah, panneaux solaires 990 W, chargeur de quai 40 A, Victron, pack B&G, traceur Garmin, dessalinisateur Aqua Base 65 L/h, guindeau électrique, chauffage Wallas 30DT, réfrigérateur 230 L, congélateur 130 L, lave-linge 3 kg, kit sécurité cat. A 10 personnes, ancre Spade 25 kg + chaîne Ø10 60 m, antifouling Nautix A88M + Copper Coat), annuaire des intervenants (6 spécialités, noms et contacts à compléter), membres (e-mails de Xavier et Emmanuel à compléter avant le seed).

### 9.2 Checklist ORC 50
Voir `seed/orc50-checklist.json` : 8 catégories avec couleur, points du briefing (`source: briefing`) et propositions (`source: proposal`) à valider par Xav. Les points moteurs portent `engine_scope: inboard` (Yanmar) ou `outboard` (annexe).

### 9.3 Historique du carnet papier
Voir `seed/xaman-history.json` : 10 entrées (avril 2025 → juillet 2026) — 7 interventions moteurs importées dans le journal, 3 changements de bouteille de gaz importés dans les achats (`kind = gas`). **Anomalies détectées à faire corriger par Xav** :
- `20/13/25` : mois invalide (importé au 20/10/2025 ; 20/10 ou 20/12 ?).
- `31/11/25` : le 31 novembre n'existe pas (importé au 30/11/2025).
- Heures moteur non monotones dans l'ordre chronologique : SB 502 (23/04/25) → 625 (28/08/25) → 708 (« 20/13/25 ») → « 315 → 347 » (30/12/25) → ~580 (06/03/26) ; BB 868 (18/04/25) → 876 (23/04/25) → 658 (28/08/25) → 642 (« 20/13/25 ») → 347 (30/12/25) → ~580 (06/03/26) → 1008 (25/03/26). Hypothèses : colonnes SB/BB inversées sur certaines lignes, compteur remplacé ou relevé sur un autre afficheur.

Règle d'import : **les 7 interventions portant des heures sont importées avec `needs_review = true`**, leurs heures sont stockées en attente (`pending_engine_hours`) et **aucun relevé d'heures n'est créé**, pour ne pas fausser les échéances. Après le seed, les compteurs sont donc vides : le jour du lancement, Xav saisit les heures courantes des deux moteurs (relevé rapide, E2-2), puis valide ligne par ligne dans l'app (« Marquer comme vérifié » crée les relevés correspondants, éventuellement corrigés).

## 10. Design de référence

- En-tête sombre dégradé `#0C1B33 → #1E3A5F`, texte blanc, stats en temps réel.
- 8 catégories avec couleurs distinctives. Les couleurs de catégories **vivent en base** (`boat_categories.color`, seedées depuis le modèle, modifiables par owner/editor) et sont appliquées partout : badges, cartes, filtres. Les tokens du design system ne couvrent que l'en-tête et les couleurs d'état. Valeurs initiales du modèle ORC 50 :

| Catégorie | Couleur |
|---|---|
| Moteurs | `#D97706` (ambre) |
| Dérives & Safrans | `#0EA5E9` (bleu ciel) |
| Voiles & Gréement | `#7C3AED` (violet) |
| Coque & Pont | `#64748B` (ardoise) |
| Électronique / Nav | `#2563EB` (bleu) |
| Énergie | `#EAB308` (jaune) |
| Hydraulique & Circuits | `#0D9488` (sarcelle) |
| Sécurité | `#DC2626` (rouge) |

- Statuts d'intervention : Planifié (bleu), En cours (ambre), Terminé (vert), Urgent (rouge). États de checklist : À faire (gris), OK (vert), Bientôt (orange), En retard (rouge).
- Cards d'interventions avec badge de statut ; checklist avec barre de progression par catégorie ; actions déroulables au tap.
- Navigation : barre latérale repliable sur iPad paysage / Mac, onglets en bas sur iPhone et iPad portrait. Bouton d'action principal (« + ») toujours accessible.
- Le prototype HTML de Xav est disponible comme référence visuelle ; à demander avant de démarrer le design system (ticket E0-4).

## 11. Critères d'acceptation globaux du MVP

Le MVP est accepté quand, sur un iPad en Safari :
1. Xavier, Emmanuel et Joseph se connectent par code e-mail et voient le même bateau Xaman avec ses données seedées.
2. Une intervention créée par Emmanuel apparaît chez Xavier sans recharger la page.
3. La checklist Voiles & Gréement affiche ses points avec un état calculé, on peut cocher un point, ajouter un point personnalisé, dérouler les actions détaillées, et la barre de progression se met à jour.
4. Une vidange saisie avec heures moteur met à jour le compteur du moteur sur la fiche bateau et sur le dashboard.
5. Un changement de bouteille de gaz, un achat et une pièce en stock sous le seuil sont saisis et la vue « dépenses par catégorie » les reflète ; l'export CSV fonctionne.
6. Une sortie de l'eau et un intervenant sont enregistrés ; l'intervenant est joignable d'un tap.
7. Un utilisateur `pro` invité peut saisir une intervention mais ne peut ni supprimer ni voir les membres ; un `viewer` ne peut rien modifier (vérifié par tests RLS, pas seulement par l'UI).
8. En mode avion, l'app s'ouvre et affiche les dernières données ; les formulaires sont désactivés proprement.
9. L'export JSON complet du bateau est téléchargeable.
10. Lint, typecheck, tests unitaires et E2E passent en CI ; déploiement Vercel de `main` = production.

## 12. Ordre de réalisation et estimation

Ordre recommandé (détail dans `BACKLOG.md`) : E0 socle → E1 auth & membres → E2 fiche bateau, moteurs et **script de seed** (les données Xaman servent à tester tout le reste) → E3 journal → E4 checklist → E5 consommables → E6 sorties d'eau & intervenants → E7 dashboard → E8 finalisation du seed & mise en production → E9 PWA, export, QA iPad. Les Should sont pris en fin de V1.

Ordre de grandeur avec Claude Code et un pilote produit disponible pour valider chaque écran : **4 à 6 semaines** pour atteindre les critères du §11 (la checklist et la RLS sont les deux chantiers les plus longs). Une première version démontrable à Xav (E0 → E4) est atteignable en 2 à 3 semaines.

## 13. Questions ouvertes (à trancher avec Xav, n'empêchent pas de démarrer)

1. Liste complète des 80+ points de checklist ORC 50 (remplace les `proposal` du seed).
2. Prototype HTML de référence (base du design system).
3. E-mails de Xavier et Emmanuel pour le seed des membres ; noms et contacts des intervenants.
4. Correction des anomalies du carnet papier (§9.3).
5. Le statut « Urgent » est-il bien un statut (comme dans le briefing) ou faut-il le traiter comme un drapeau indépendant du statut ? V1 : statut, conformément au briefing.
6. Domaine : `xaman.app` / `getxaman.com` / autre (à vérifier, non déterminant pour le MVP).
