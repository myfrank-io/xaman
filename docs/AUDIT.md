# Xaman — Audit consolidé et décisions (2 septembre 2026)

> Synthèse des quatre rapports produits le 2 septembre 2026 (benchmark concurrentiel, audit produit, spécification UX, direction artistique) et des décisions retenues. Les rapports complets ne sont pas versionnés ; ce document est la référence. Il complète `SPEC.md` (qui garde le périmètre) et `DATA-MODEL.md` (qui garde le schéma) ; en cas de contradiction, **ce document prime** sur les deux pour les points qu'il tranche, et `DECISIONS.md` en tient le journal.

## 0. Verdict en dix lignes

1. Le socle (schéma, RLS, PWA, tests) est solide ; le différenciateur (checklist par modèle avec actions détaillées) est réel mais **la granularité** est ce qui reste défendable : Ready4Sea, Boatwise et Yacht Manager App vendent déjà des modèles par type de bateau.
2. **Le vrai concurrent est le carnet papier et Excel** ; le coût d'amorçage tue ces produits, pas le manque de fonctions. Xaman gagne sur le **temps jusqu'à la première valeur** : un bateau pré-rempli, une vidange saisie en moins de 45 s, un associé qui voit la ligne apparaître.
3. **Au jour 1, l'app telle que spécifiée ne rappelle rien** : un point jamais coché est `never`, hors file d'attente ; 95 points → « rien à faire » et « 0 % ». Correction : **ancrage** des échéances (`anchor_date` / `anchor_hours`) + **assistant de mise en route**.
4. Le suivi repose sur **un seul modèle mental** : le plan (points de checklist à intervalle), l'acquittement (réalisations), le récit (interventions). Tout ce qui doit revenir devient un point de checklist — y compris le carénage, le radeau, les extincteurs, l'assurance.
5. Les **échéances à date fixe** (péremption : radeau, fusées, EPIRB, extincteurs, assurance) manquaient au modèle : `checklist_completions.next_due_at` (« valide jusqu'au ») prime sur l'intervalle.
6. **Une seule saisie** « + J'ai fait… » remplace la séquence intervention → dialogue de cochage → heures ; le pré-cochage se fait par similarité trigram, pas par mots-clés.
7. **Le premier écran est la file d'attente**, pas le journal : ordre de réalisation inversé (checklist → tableau de bord → journal).
8. **Moins de surface** : priorité supprimée, `next_due_at` des interventions supprimé, navigation 9 → 4 onglets + « Plus », sorties de l'eau = onglet du journal + point de checklist, gaz = filtre, stock déclassé, pas de tableau croisé, pas de zip.
9. **Les rappels passent en V1** (un e-mail hebdomadaire) ; la **preuve** (rapport d'état imprimable) et le **transfert du bateau** matérialisent « la donnée suit le bateau » — c'est le levier économique (62 635 changements de propriétaire par saison en France contre 9 708 bateaux neufs).
10. **La DA se calcule** : contrastes ≥ 5:1 en texte, 3:1 en pastille, trois variantes par couleur sémantique (`-fg`, `-tint`, `-on-dark`), 5 des 8 couleurs de catégories harmonisées (deutéranopie et plein soleil), logo « La Traverse » (X de deux coques coupé par la ligne de flottaison), typographie système.

## 1. Sources et méthode

| Rapport | Auteur | Contenu | Fiabilité |
|---|---|---|---|
| Benchmark concurrentiel | agent analyste (recherche web partielle : les pages sources étaient bloquées, faits issus d'extraits de résultats datés du 02/09/2026, marqués vérifié / partiel / mémoire) | 12 fiches, tableau 37 fonctions × 11 acteurs, 10 patterns best-in-class, 8 opportunités | Bonne sur les faits de marché, faible sur les avis utilisateurs (non lus) |
| Audit produit | agent PM | JTBD par persona, audit module par module, 20 incohérences, modèle de suivi, 24 cas limites, simplifications chiffrées, backlog révisé | Élevée ; deux « pièges » signalés étaient déjà corrigés dans le code (I4, I7, I8) |
| Spécification UX | agent UX | Architecture d'information, tableau de bord (wireframes paysage/portrait), 10 flux pas à pas, patterns de formulaire, états, lisibilité soleil, 29 changements de code, ~300 clés `fr.json` | Élevée ; contrastes mesurés |
| Direction artistique | agent DA | Plateforme de marque, ton de voix, palette calculée (WCAG + simulation daltonisme), typographie, logos (3 directions), tokens CSS prêts à coller | Élevée sur la couleur ; les chapitres composants/icônes n'ont pas été rédigés (repris de la spec UX) |

Divergences entre rapports, tranchées ici : la 4ᵉ entrée de navigation (UX : Bateau ; produit : Dépenses) → **Bateau** ; la 2ᵉ (UX : Journal ; produit : Checklist) → **Checklist** ; les sorties de l'eau (UX : « Plus » ; produit : onglet du journal) → **onglet du journal** ; tuiles moteur dans l'en-tête (UX : bande dédiée ; produit : 2 tuiles) → **bande de puces moteur sous les vignettes**.

## 2. Ce que le marché change à la SPEC

- `SPEC.md §3` était faux : au moins **cinq acteurs francophones actifs** (Ready4Sea, BoatOn Book, Eloyot, Seanapps/Bénéteau, Nauticoncept) et un cousin européen très proche (**Boatwise**, 49 €/an). « Sailwise », « PropellerPro » et « Yachtlog » n'existent pas sous ce nom ; « Nautilog » est un carnet papier. La section est réécrite.
- Le « premier atteint » (date **ou** heures) est un **table stake**, pas un argument ; ce qui n'est fait nulle part, c'est de **l'afficher clairement** (« dans 12 j » ou « dans 40 h », celle qui déclenche).
- Le multi-acteurs existe partout ; ce qui n'existe pas en grand public, c'est un **rôle pro réellement contraint** (lit tout, écrit ses lignes, ne supprime rien, ne voit pas les membres), **daté** (`valid_until`) et **appliqué en base**. C'est un argument de confiance, à rendre visible dans l'UI (phrase de garantie à l'invitation).
- Tous les concurrents notifient ; un carnet sans rappel est un carnet. **Un e-mail hebdomadaire unique** (retards, bientôt, planifiées) entre dans la V1.
- Ce qu'il ne faut pas faire : journal de navigation, app native, création libre de bateaux sans modèle, messagerie, IA de diagnostic, tarification par utilisateur.

## 3. Décisions produit (référence D-xx)

### 3.1 Le modèle de suivi
| # | Décision | Détail | Schéma |
|---|---|---|---|
| D1 | **Ancrage des échéances** | `reference_at = coalesce(dernière réalisation, anchor_date)`, `reference_hours = coalesce(dernières heures, anchor_hours)` ; `anchor_date = current_date` à l'instanciation, modifiable (« dernière réalisation connue : ~ »). Jour 1 : rien n'est rouge et c'est vrai ; mois 6 : les points semestriels basculent seuls | `checklist_items.anchor_date`, `anchor_hours` (0004) |
| D2 | **Assistant de mise en route** (E4-9) | 3 étapes < 5 min : compteurs des moteurs → tri des points proposés (garder / retirer) → calage grossier (Jamais · < 6 mois · ~1 an · > 2 ans) écrit `anchor_date` marqué « estimé ». Reprenable depuis Paramètres. **Sort E8-1 du chemin critique** : Xav trie dans l'app | — |
| D3 | **Saisie unique « + J'ai fait… »** | Un formulaire : titre avec suggestions porteuses de catégorie et de moteur, chips de catégorie, statut par défaut Terminé, heures par moteur **non pré-remplies** (aide « dernier : 1 234 h le 28/08 » + puce « = reprendre »), coût, réalisé par (Nous-mêmes / prestataire + création inline), notes, **points de checklist concernés pré-cochés par `similarity()` > 0,5** dans la catégorie ; les cochages créés portent la date et les heures de l'intervention sans relevé supplémentaire | — |
| D4 | **`maintenance_logs.next_due_at` supprimé** | Jamais lu ; la « prochaine échéance » devient `checklist_completions.next_due_at` (D11) et les interventions planifiées portent leur date dans `performed_at` | 0004 |
| D5 | **Relevés et corbeille** | À la mise à la corbeille, les relevés de l'intervention sont déplacés dans `pending_engine_hours` et supprimés ; la restauration les recrée. Plus de compteur qui change tout seul 30 jours plus tard | trigger (0004) |
| D6 | **Priorité supprimée** | Colonne et énumération retirées, champ retiré des formulaires | 0004 |
| D7 | **Statut** | Segmenté [À faire · En cours · Terminé] + bascule « Urgent » (écrit `status = 'urgent'`) ; défaut Terminé | — |
| D11 | **Échéance à date fixe** | Champ facultatif « Valide jusqu'au » dans le dialogue « Fait » ; `due_at = coalesce(next_due_at, reference_at + interval_months)` | `checklist_completions.next_due_at` (0004) |
| D12 | **Compteur remplacé** | `engines.counter_reset_at` : le dialogue de relevé propose « le compteur a été remplacé » quand la valeur baisse ; les échéances en heures antérieures au reset sont ignorées jusqu'au prochain cochage | 0004 |
| D13 | **Points sans intervalle** | Groupe « Contrôles ponctuels » en bas de catégorie, exclus de la progression et de la file, bouton « Refaire » | vues (0004) |
| D14 | **Moteur désactivé** | Ses points sortent de la vue de statut ; suppression physique d'un moteur refusée s'il a des relevés ou des points | trigger (0004) |
| D15 | **Annulation d'une réalisation** | « Annuler » dans le toast (8 s) ; suppression depuis l'historique par owner/editor, ou par l'auteur `pro` dans les 24 h ; le relevé dérivé disparaît avec (cascade) | RLS + FK (0004) |
| D16 | **Historique des relevés éditable** (E2-2) | Liste par moteur avec édition/suppression (owner/editor) ; rien n'est dénormalisé, la correction se propage | — |
| D17 | **Dates** | Réalisations et relevés jamais futurs (trigger) ; intervention future seulement si planifiée/urgente (zod) ; avertissement au-delà de 10 ans | 0004 + zod |
| D18 | **Créations idempotentes** | UUID généré à l'ouverture du formulaire, Server Actions en `upsert` sur la PK, bouton occupé dès le premier tap | convention |

### 3.2 Navigation et écrans
| # | Décision | Raison |
|---|---|---|
| D8 | **4 onglets** : Tableau de bord · **Checklist** · Journal · Bateau ; feuille « Plus » : Dépenses (ex-Consommables), Intervenants, Corbeille ; menu compte : Membres, Paramètres, Mon profil, Installer, Déconnexion | Fréquence d'usage ; la checklist est le cœur ; le relevé d'heures (onglet Bateau) est l'écriture n° 2 |
| D9 | **Sorties de l'eau** = onglet du Journal + point de checklist « Carénage / sortie de l'eau » (18 mois) | Un module de moins, le rappel entre dans le modèle unique |
| D10 | **Stock** : liste plate déclarative (nom, quantité, seuil, emplacement, +/−), dernier onglet de Dépenses, dernier ticket ; sans lien d'achat ni incrément automatique | Une donnée non tenue à jour rend le reste faux |
| D19 | **Un seul « + » contextuel** par écran (pied de sidebar / en-tête compact), feuille de choix quand l'écran est ambigu ; vignettes moteur tappables ; **pas de FAB** | Règle « un seul chemin par action » |
| D20 | **Tableau de bord** : phrase d'état, 4 vignettes (En retard · Bientôt · Interventions · Dépenses 12 mois), bande des moteurs (date du relevé, « à mettre à jour » > 60 j, « compteur inconnu »), un seul bandeau contextuel, « À faire prochainement » (6/5/4 lignes, tri exécutable, **points `never` exclus**, bouton « Fait » en ligne), grille des 8 systèmes à **ordre fixe**, 5 dernières interventions, récapitulatif ; état « carnet neuf » explicite le jour 1 ; état « tout est à jour » sans bouton | Spec UX §2 |
| D21 | **Grille de catégories à ordre fixe** + onglet « À traiter » trié par urgence (Tout · En retard · Bientôt · Jamais fait) | La mémoire de position vaut plus que le tri |
| D22 | **Étapes détaillées cochables** localement (`sessionStorage`), remises à zéro au cochage du point | Valeur d'usage réelle, zéro schéma |
| D23 | **Actions interdites à un pro : absentes**, pas grisées ; le grisé est réservé au hors-ligne (style dédié, pas `opacity-50`) | Lisibilité soleil |
| D24 | **Reprise du carnet** : écran tableau des lignes importées (7 interventions × 2 moteurs, 3 achats) avec « Intervertir SB ↔ BB », « ignorer les heures », correction de date, validation en une fois | Remplace la validation ligne à ligne |
| D25 | **Brouillons hors ligne** (créations seulement, renvoi manuel, 20 max) + formulaire jamais vidé | « Utilisable en mer » sans offline-first |
| D26 | **Formulaires** : jamais `type="number"` (`inputMode`), dates = puces + roulette native, chips de catégorie, prestataire = segmenté + annuaire + création inline, suggestions de titres sans `<datalist>`, barre d'action collante au-dessus du clavier (`visualViewport`), brouillon `sessionStorage`, garde « abandonner cette saisie ? » | Spec UX §4 |
| D27 | **Concurrence optimiste** par `updated_at` sur les mises à jour ; conflit montré, jamais fusionné | Visible plutôt que silencieux |

### 3.3 Accès et partage
| # | Décision |
|---|---|
| D28 | Un **editor peut inviter en `pro` ou `viewer`** avec une date de fin obligatoire (≤ 90 jours) ; rôles et retraits restent owner. L'invitation porte `valid_until`, copié dans `boat_members` à l'acceptation |
| D29 | Invitation d'un pro : durée d'accès (7 / 30 / 90 j / illimité), phrase de garantie, « Copier le lien » / `navigator.share()` en complément de l'e-mail ; membre expiré grisé avec « Réactiver 90 j » |
| D30 | **Transfert du bateau** (E1-8) : avertissement sur ce qui part (coûts compris), export préalable, invitation `owner`, retrait de l'ancien |
| D31 | Suppression de compte : les noms sont figés dans `completed_by_name` avant suppression ; le refus « dernier propriétaire » propose « Transférer » ou « Supprimer le bateau » |
| D32 | Aucun compte requis pour attribuer une intervention : « Réalisé par » = Nous-mêmes / intervenant de l'annuaire / autre |

### 3.4 Ce qui est retiré ou reporté
Priorité · `maintenance_logs.next_due_at` · tableau croisé des dépenses · zip d'export (JSON + 2 CSV) · export PDF de catégorie (remplacé par le rapport d'état) · sélecteur de bateau (reporté) · modèle générique (reporté : un modèle par constructeur) · prédiction gaz (remplacée par des faits, estimation à partir de 3 intervalles) · incrément de stock depuis un achat · sidebar repliable · pré-remplissage des heures · tri de la grille par retard.

### 3.5 Ce qui est ajouté
Ancrage + assistant (E4-9) · date fixe (E4-11) · annulation d'une réalisation (E4-10) · suggestion trigram (E3-3b) · rapport d'état imprimable (E9-2b) · reprise du carnet (E3-7 élargi) · historique d'heures éditable (E2-2) · `equipment_id` sur les interventions (E3, fiche équipement = mini-carnet) · transfert du bateau (E1-8) · accès pro daté + lien partageable (E1-5) · brouillons hors ligne (E9-1) · e-mail hebdomadaire (E9-6, ex-E11-1) · points de checklist administratifs et de sécurité (contenu du seed).

## 4. Direction artistique (résumé exécutable)

- **Marque** : *Xaman* = le nord, *Xaman Ek'* = l'étoile du Nord (à confirmer par Xav). Ligne directrice : **le repère fixe**. Registre instrument / carte / plaque de constructeur ; interdits : voilier-silhouette, vagues, cordages, bois, brochure.
- **Promesse** : « Tout ce que le bateau a vécu, à portée de doigt mouillé. » Ton : vouvoiement, voix active, un fait par phrase, vocabulaire du bord, zéro point d'exclamation, zéro emoji.
- **Couleur** : rampe de neutres teinte 215° convergeant vers le navy ; fond `#F7F9FB`, cartes blanches **bordées** (l'ombre s'annule au soleil) ; bouton primaire `#123152` ; accent laiton `#8A6A22` / `#E3B879` réservé à la marque, jamais à une donnée ; trois variantes par couleur sémantique (`--x` pastille ≥ 3:1, `--x-fg` texte ≥ 5:1, `--x-on-dark`) ; plein réservé à ce qui exige une action (Urgent, En retard, Bientôt, En cours) ; rouge d'urgence `#C81E2B`.
- **Catégories harmonisées** (deutéranopie ΔE 2,4 → 6,5 ; minimum sur blanc 1,92 → 3,19) : Moteurs `#D97706` (inchangé), Dérives `#0284C7`, Voiles `#A21CAF`, Coque `#52606F`, Électronique `#1D4ED8`, Énergie `#A16207`, Hydraulique `#0F766E`, Sécurité `#C81E2B`. Une couleur de catégorie ne circule jamais seule (icône + libellé) et n'est jamais une couleur de texte.
- **Typographie** : système (SF Pro sur iPad), chiffres tabulaires partout, 12 px minimum, graisse ≥ 500 sous 14 px.
- **Logo** : direction A « La Traverse » (X formé par deux coques coupé par la ligne de flottaison), rectiligne, monochrome par construction ; icône d'app sur navy plein ; logotype `XAMAN` en capitales géométriques.
- Les tokens (`design-tokens.css`) sont intégrés dans `src/app/globals.css` ; convention `-fg` / `-tint` / `-border` / `-on-dark` obligatoire ; utilitaires `num`, `pressable`, `cat-scope`.

## 5. Ordre de réalisation révisé

Voir `BACKLOG.md` (lots L0 → L8). Principe : **démontrer le suivi avant la saisie** — checklist (L3) → premier écran (L4) → récit (L5). Jalon J2 « Ça suit » = sur un iPad, l'assistant est passé, la file d'attente est juste, cocher un point la met à jour, un second appareil le voit sans recharger.

## 6. Métriques de succès
- Activation : événements de suivi saisis par semaine et par bateau (cochages + interventions + relevés).
- Budget d'interaction (critères d'acceptation E2E) : vidange avec heures ≤ 7 taps / < 45 s ; cocher un point sans heures ≤ 3 taps / < 10 s ; relevé d'heures ≤ 3 taps / < 15 s.
- Vérité de l'état : aucun compteur « 0 h » (toujours « compteur inconnu »), aucune ligne douteuse masquée (badge « À vérifier »).
