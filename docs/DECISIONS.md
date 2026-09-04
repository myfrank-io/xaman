# Xaman — Journal des décisions

Format : date · question · décision · raison. Claude Code ajoute une ligne à chaque choix produit non couvert par `SPEC.md`.

| Date | Question | Décision | Raison |
|---|---|---|---|
| 2026-09-02 | Stack | Next.js + Supabase + Vercel, PWA | iPad Safari en priorité, multi-tenant par RLS, MCP Supabase/Vercel déjà connectés, pas de serveur à maintenir |
| 2026-09-02 | Portée multi-acteurs V1 | Modèle multi-bateaux / organisations dès la V1, UI limitée à un bateau et 4 rôles (owner, editor, pro, viewer) | Éviter une refonte du schéma en V2 sans alourdir le MVP |
| 2026-09-02 | Offline | V1 = cache de lecture + écritures en ligne ; offline-first en V2 | Starlink à bord ; l'offline-first double la complexité (sync, conflits) |
| 2026-09-02 | Inscription publique | ~~Pas de création libre de bateau en V1 ; l'admin plateforme crée les bateaux et invite~~ — **renversée le 2026-09-03, voir D64** | Un seul bateau au lancement, réduit la surface (onboarding, abus) |
| 2026-09-02 | Statut « Urgent » | Conservé comme statut d'intervention (conforme au briefing), pas comme drapeau séparé | Fidélité au briefing ; à rediscuter avec Xav si gênant (question ouverte §13-5) |
| 2026-09-02 | Stock de pièces | Stock simple (quantité, seuil, emplacement, +/−) dans le MVP ; inventaire avancé exclu | Le briefing liste le stock en must-have et « gestion des stocks » en hors-scope : on prend la version simple |
| 2026-09-02 | Bouteilles de gaz | Importées et gérées comme achats (`purchases.kind = gas`) avec vue dédiée, pas comme interventions | Un changement de bouteille est un achat consommable, pas un entretien ; permet le calcul de consommation |
| 2026-09-02 | Heures moteur | Table de relevés horodatés par moteur (pas de colonnes SB/BB sur l'intervention) | Générique pour tout nombre de moteurs ; historique et graphique V1.1 gratuits |
| 2026-09-02 | Import du carnet papier | Lignes incohérentes importées avec `needs_review = true`, sans relevé d'heures | Ne pas fausser les échéances avec des heures douteuses ; Xav corrige dans l'app |
| 2026-09-02 | Points de checklist par moteur | `engine_scope` sur le modèle, duplication par moteur à l'instanciation, `engine_id` sur le point | Les intervalles en heures n'ont de sens que par moteur |
| 2026-09-02 | Points sans intervalle | Autorisés ; état « À faire » puis « OK » définitif | Contrôles ponctuels (ex. après un choc) |
| 2026-09-02 | Suppression | Soft delete 30 jours sur interventions, achats, sorties d'eau | Erreur de manipulation sur tablette fréquente |
| 2026-09-02 | Annuaire | Par bateau en V1 (`contacts.boat_id`), partage par organisation en V2 | Simplicité RLS |
| 2026-09-02 | Langue | UI FR, code/schéma/commits EN, i18n prêt (`next-intl`) | Marché FR d'abord, anglais ensuite |
| 2026-09-02 | Mode de connexion | Code OTP 6 chiffres saisi dans l'app, lien magique en secours | Sur iPad, un lien ouvert depuis Mail s'ouvre dans Safari et non dans la PWA installée |
| 2026-09-02 | Bootstrap des membres | Le seed crée les comptes via l'API admin Supabase et insère directement les membres ; l'admin plateforme est owner virtuel de tous les bateaux | Sans owner initial, personne ne peut inviter ; évite une invitation impossible à délivrer |
| 2026-09-02 | Historique importé | Les 7 interventions avec heures sont toutes `needs_review`, heures en attente, aucun relevé créé au seed | La série d'heures est globalement incohérente ; Xav saisit le compteur courant le jour 1 puis valide ligne par ligne |
| 2026-09-02 | Vues SQL | Toutes en `security_invoker = true` | Une vue standard s'exécute avec les droits de son propriétaire et contourne la RLS |
| 2026-09-02 | Rôle pro et corbeille | Un pro peut modifier ses lignes mais pas les mettre à la corbeille (`with check (deleted_at is null)`) | Le soft delete est un update ; sans cette clause la règle « pro ne supprime pas » serait contournable |
| 2026-09-02 | Infra Vercel (E0-0) | Projet `xaman` créé via MCP (`prj_7d0bAaCfWquNfW14ClRUG3H7ieAX`, équipe `paul-s-projects29`, plan Hobby, compte Vercel de Paul), branche de production `main`, URL de prod `https://xaman-blue.vercel.app` (alias `xaman-paul-s-projects29.vercel.app`), framework et région de fonctions (`cdg1`, Paris) fixés par `vercel.json` | Procédure KICKOFF §2.3 ; le compte Vercel connecté n'expose qu'une équipe |
| 2026-09-02 | Infra Supabase (E0-0) | Création du projet `xaman` (région `eu-west-3`, plan gratuit 0 €/mois) **en attente** : l'organisation RANK SAS a atteint la limite de 2 projets gratuits actifs (`Chaud-Devant-Restaurants`, `burningtokens`) | Il faut mettre un projet en pause ou passer l'organisation en Pro avant de relancer `create_project` |
| 2026-09-02 | Flux git | Une seule branche de travail (`claude/projet-en-cours-u9wp2i`) avec une PR vers `main` enrichie ticket par ticket (un commit par ticket), au lieu d'une branche par ticket ; `main` reçoit le pack de spec initial puis n'évolue que par PR | Contrainte de l'environnement Claude Code distant (branche imposée) ; les previews Vercel de la PR servent à valider chaque écran |
| 2026-09-02 | Composants shadcn/ui | Composants écrits à la main dans `src/components/ui/` (sources new-york v4, Radix via le paquet unifié `radix-ui`), tailles tactiles ≥ 44 px par défaut ; `components.json` conservé pour l'outillage | Le registre `ui.shadcn.com` est inaccessible depuis l'environnement de développement (proxy) |
| 2026-09-02 | Polices | Pile système (`font-sans` Tailwind : San Francisco sur iPad) plutôt que Google Fonts via `next/font` | Aucun appel réseau au build, rendu natif sur iPad, une dépendance de moins |
| 2026-09-02 | Base locale sans Docker | L'environnement de développement de Claude Code ne peut pas tirer les images Docker (registres bloqués par le proxy) : les migrations et les tests sont validés sur un Postgres système (16) avec `tests/support/supabase-shim.sql` (rôles `anon`/`authenticated`/`service_role`, schémas `auth`/`storage`/`extensions`, `auth.uid()`…, publication `supabase_realtime`). La stack réelle (`supabase start`) reste la référence sur les postes de dev et en CI | Ne pas bloquer le projet ; le shim reproduit fidèlement ce que la RLS voit |
| 2026-09-02 | RLS dès la première migration | `0001_init.sql` active la RLS sur toutes les tables **sans politique** (refus total pour `anon`/`authenticated`) ; `0002_rls.sql` ajoute les politiques | Respecte la règle 2 de `CLAUDE.md` (aucune table exposée) tout en gardant le découpage E0-3 / E1-2 du backlog |
| 2026-09-02 | Conception des tests RLS (E1-6) | Vitest + client `pg` connecté à la base : chaque cas exécute `set local role authenticated` + `request.jwt.claims` (exactement ce que fait PostgREST), plutôt que des sessions supabase-js | Testable sur la stack Supabase comme sur un Postgres nu, plus rapide, teste la base elle-même ; les parcours par supabase-js sont couverts par les E2E (E9-3) |
| 2026-09-02 | Types générés | `pnpm db:types` (stack locale) et `pnpm db:types:url` (`DATABASE_URL`, sans Docker) écrivent tous deux `src/types/database.ts` | Même fichier généré quel que soit l'environnement |
| 2026-09-02 | Design system sans prototype | E0-4 réalisé à partir de `SPEC.md §10` (dégradé d'en-tête, couleurs d'état et de statut, catégories depuis la base) sans attendre le prototype HTML de Xav ; l'intégration du prototype se fera en retouche de tokens/composants, pas en refonte | Ne pas bloquer l'avancement ; les tokens sont centralisés dans `globals.css` |
| 2026-09-02 | Composants tactiles | Boutons, champs, selects, items de menu et onglets à **44 px** minimum ; texte des champs à 16 px à tous les breakpoints ; `NativeSelect` (picker système iOS) en plus du `Select` Radix ; dialogues à hauteur bornée et scroll interne (clavier iPad) | Règle 1 de `CLAUDE.md` |
| 2026-09-02 | Layout applicatif | Sidebar fixe à partir de `lg` (1024 px : iPad paysage, Mac), en-tête compact + barre d'onglets en dessous (iPad portrait 768 px, iPhone) avec 4 onglets principaux et une feuille « Plus » ; safe areas via utilitaires `safe-top` / `safe-bottom` | `SPEC.md §10` navigation |
| 2026-09-02 | CI GitHub Actions | Un job `checks` (lint, prettier, typecheck, `supabase db start` + `db reset`, Vitest, build) sur PR et `main` ; un job `migrate-production` sur `main` qui fait `supabase link` + `db push` **seulement si** les secrets `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` et la variable `SUPABASE_PROJECT_REF` sont définis (sinon avertissement, pas d'échec) ; la vérification « types générés à jour » est non bloquante | Ne pas casser `main` tant que le projet Supabase n'existe pas ; Vercel déploie déjà les previews par PR et `main` en prod via l'intégration git |
| 2026-09-02 | PWA / Serwist | Mode « configurator » de `@serwist/next` (`serwist.config.mts` + `serwist build` après `next build`, enregistrement par `SerwistProvider` en production uniquement) plutôt que le plugin webpack | Next.js 16 construit avec Turbopack, que le plugin webpack de Serwist ne supporte pas ; le mode configurator est compatible et produit le même `public/sw.js` (precache de l'app shell + stratégies runtime recommandées) |
| 2026-09-02 | Icônes PWA | Icône vectorielle « voilier sur dégradé navy » rendue en PNG (192, 512, 512 maskable, apple-touch-icon 180, favicon 64) via Chromium ; manifest généré par `src/app/manifest.ts` (`display: standalone`, `theme_color: #0C1B33`) | Pas de dépendance native (sharp) ; à remplacer par le logo définitif quand il existera |
| 2026-09-02 | Privilèges de colonnes | `revoke update on profiles` puis `grant update (full_name, avatar_url, locale)` ; `revoke select, update on boat_invitations` puis `grant select (toutes colonnes sauf token)` et `grant update (revoked_at)` ; `revoke all … from anon` sur toutes les tables | Postgres n'applique pas un `revoke` de colonne par-dessus un `grant` de table : il faut révoquer au niveau table puis accorder colonne par colonne. Conséquence : le client doit sélectionner des colonnes explicites (ou la vue `boat_invitations_safe`) sur `boat_invitations` |
| 2026-09-02 | Fonction `boat_role()` | Nom conservé conformément à `DATA-MODEL.md`, mais toujours appelée avec un argument typé (`boat_role(id)` sur une colonne, `boat_role($1::uuid)` en SQL brut) | `boat_role('…')` avec un littéral non typé est interprété par Postgres comme un cast vers l'enum du même nom |
| 2026-09-02 | Tests RLS | 50 cas Vitest (`tests/unit/rls.test.ts`) : lecture/écriture/suppression par rôle sur chaque table, isolation entre bateaux, token invisible, dernier owner, pro sans corbeille, fonctions d'invitation, bucket Storage ; exécutés en CI sur la stack Supabase (`supabase db start` + `db reset` + `seed.sql`) | Ticket E1-6 fait en même temps que E1-2 : la matrice se valide au moment où on écrit les politiques |
| 2026-09-02 | Inscription par OTP | Sur `/login`, `signInWithOtp` est appelé avec `shouldCreateUser: false` (message « aucun compte, demandez une invitation ») ; seule la page d'invitation `/invite/[token]` autorise la création du compte au premier code | L'inscription Supabase reste techniquement ouverte pour le parcours d'invitation, sans permettre à un inconnu de créer un compte depuis la page de connexion |
| 2026-09-02 | Middleware Next.js 16 | `src/proxy.ts` (nouveau nom du middleware) rafraîchit la session via `getClaims()` et redirige vers `/login?next=…` hors des chemins publics (`/`, `/login`, `/auth`, `/invite`, `/health`, `/dev`) ; passe-plat si Supabase n'est pas configuré | Convention Next.js 16 ; une preview sans variables reste consultable |
| 2026-09-02 | Audit du 2 septembre | Quatre audits (benchmark, produit, UX, DA) consolidés dans `docs/AUDIT.md` ; `BACKLOG.md` réordonné en lots L0–L8 (checklist → tableau de bord → journal) ; `SPEC.md §3` réécrit | Le premier écran doit démontrer le suivi, pas la saisie ; le marché francophone était mal décrit |
| 2026-09-02 | Ancrage des échéances (D1) | `checklist_items.anchor_date` / `anchor_hours` ; référence = dernière réalisation sinon ancrage ; `never` réservé aux points sans intervalle jamais faits | Sans ancrage, l'app ne rappelle rien pendant 6 à 12 mois et affiche 0 % sur un bateau bien tenu |
| 2026-09-02 | Assistant de mise en route (D2) | Compteurs → tri des points proposés → calage grossier ; ticket E4-9, reprenable depuis Paramètres | Rend l'app utile le premier soir et sort la liste des 80+ points de Xav du chemin critique |
| 2026-09-02 | Saisie unique (D3) | Un seul formulaire d'intervention qui propose les points de checklist (similarité trigram) et porte les heures ; le dialogue « Fait » propose « + Ajouter les détails » | Deux formulaires successifs ne seront pas remplis à bord ; la checklist se désynchroniserait du journal |
| 2026-09-02 | Colonnes mortes (D4, D6) | `maintenance_logs.priority` et `maintenance_logs.next_due_at` supprimées ; la prochaine échéance vit sur la réalisation (`checklist_completions.next_due_at`) | Jamais lues par une vue, un tri ou un écran ; un champ décoratif est pire qu'un champ absent |
| 2026-09-02 | Échéance à date fixe (D11) | « Valide jusqu'au » sur la réalisation, prioritaire sur l'intervalle | Radeau, fusées, EPIRB, extincteurs, assurance : sans elle l'app confirmerait un bateau conforme alors qu'il ne l'est pas |
| 2026-09-02 | Relevés et corbeille (D5) | Trigger : à la mise à la corbeille, les relevés de l'intervention sont déplacés dans `pending_engine_hours` et supprimés ; la restauration les recrée | Sinon `purge_trash()` faisait réapparaître les heures 30 jours plus tard |
| 2026-09-02 | Compteur remplacé (D12) | `engines.counter_reset_at` ; les échéances en heures antérieures au reset sont ignorées jusqu'au prochain cochage | Aucun recalage automatique par offset : source d'erreurs silencieuses |
| 2026-09-02 | Navigation (D8) | 4 onglets Tableau de bord · Checklist · Journal · Bateau ; « Plus » : Dépenses, Intervenants, Corbeille ; menu compte : Membres, Paramètres, Profil ; un seul « + » contextuel, pas de FAB ; sidebar fixe | Fréquence d'usage mesurée ; un seul chemin par action ; mémoire de position |
| 2026-09-02 | Sorties de l'eau (D9) | Onglet du Journal + point de checklist « Carénage / sortie de l'eau » (18 mois) ; plus de règle spéciale du tableau de bord | Tout ce qui doit revenir est un point de checklist |
| 2026-09-02 | Stock (D10) | Déclaratif, dernier onglet de Dépenses, dernier ticket ; sans lien d'achat ni incrément automatique | Une donnée non tenue à jour rend le reste faux |
| 2026-09-02 | Heures non pré-remplies | Champs d'heures vides + aide « dernier relevé » + puce « = reprendre » | Un pré-remplissage crée de faux relevés datés d'aujourd'hui qui faussent toutes les échéances |
| 2026-09-02 | Points `never` hors file d'attente | « À faire prochainement » exclut les points jamais faits ; état « carnet neuf » dédié | ~90 points noieraient la liste au lancement |
| 2026-09-02 | Invitations par un editor (D28) | Un editor invite en pro/viewer avec `valid_until` ≤ 90 j ; rôles et retraits restent owner | L'associé gère les chantiers en l'absence du propriétaire |
| 2026-09-02 | Annulation d'une réalisation (D15) | Toast Annuler 8 s ; suppression par owner/editor, ou par l'auteur pro sous 24 h ; relevé dérivé en cascade | La fausse manipulation la plus probable sur iPad |
| 2026-09-02 | Rappels (E9-6) | Un e-mail hebdomadaire (retards, bientôt, planifiées) remonté en V1 ; pas de push, pas de centre de notifications | Tous les concurrents notifient ; un carnet sans rappel est un carnet |
| 2026-09-02 | Preuve et transfert | Rapport d'état imprimable (`@media print`, remplace l'export PDF) et transfert du bateau en V1 | Levier économique de la revente ; matérialise « la donnée suit le bateau » |
| 2026-09-02 | Direction artistique | Ligne « le repère fixe » (Xaman = le nord) ; tokens calculés (`-fg`/`-tint`/`-border`/`-on-dark`), fond `#F7F9FB`, cartes bordées, bouton primaire `#123152`, laiton réservé à la marque ; catégories harmonisées ; logo « La Traverse » ; police système | Plein soleil : contrastes ≥ 5:1 en texte, 3:1 en pastille, lisibilité en deutéranopie |
| 2026-09-02 | Créations idempotentes (D18) | UUID généré à l'ouverture du formulaire, upsert sur la PK, bouton occupé dès le premier tap | Double tap sur un iPad qui rame = deux interventions |
| 2026-09-02 | Dates futures des réalisations et relevés | Refus au-delà de « demain » (trigger `current_date + 1`, zod identique) | La base tourne en UTC, l'iPad dans son fuseau : « aujourd'hui » à 00:30 à Paris ne doit pas être refusé |
| 2026-09-02 | Suppression d'un équipement | Jamais supprimé : `equipment.removed_at` (« déposé le … »), restaurable | Son historique d'interventions reste lisible |
| 2026-09-02 | Bouton retour du navigateur sur un formulaire modifié | Non intercepté (l'App Router possède `popstate`) ; garde « Abandonner cette saisie ? » sur ‹ et Annuler, `beforeunload` sur la fermeture, brouillon `sessionStorage` | Un `pushState` sentinelle fait recharger la page par Next ; le brouillon couvre ce chemin |
| 2026-09-02 | Voie de données des écrans L2 | Pages rendues côté serveur + Server Actions ; `router.refresh()` coalescé (300 ms) sur événement Realtime en plus de l'invalidation TanStack | Un seul chemin de lecture ; TanStack réservé aux écrans optimistes (checklist, tableau de bord) |
| 2026-09-02 | Concurrence optimiste (D27) | Les Server Actions de mise à jour acceptent `expectedUpdatedAt` et comparent `updated_at` ; 0 ligne = `errors.conflict` | Conflit visible, jamais fusionné |
| 2026-09-02 | `cn()` et l'échelle typographique maison | `extendTailwindMerge` déclare `text-body`, `text-h1`, `text-num-*`… comme tailles | tailwind-merge les prenait pour des couleurs et supprimait la couleur de texte (bouton navy à texte navy) |
| 2026-09-02 | Badges pleins (Urgent, En retard, Bientôt, En cours) | Fond = jeton `-fg` de la couleur, texte blanc | Les couleurs de pastille ne donnent que 3,2–3,6:1 en fond ; le `-fg` donne ≥ 5,9:1 |
| 2026-09-02 | Invitations par un editor (D28) | Politique `insert` : pro ou viewer, `valid_until` ≤ 90 j ; la lecture et la révocation restent owner | Limite connue : l'editor ne relit pas ses invitations ; à ouvrir si le besoin apparaît |
| 2026-09-02 | Parseur décimal | Un seul : `src/lib/numbers.ts#parseDecimal` (null = vide, undefined = invalide), utilisé par `NumericField` et les schémas zod | Deux implémentations divergeaient sur les chaînes invalides |
| 2026-09-02 | Recette visuelle des écrans sans base | Pages `/dev/ui/boat*` (hors prod) qui montent les composants réels avec des données d'exemple ; captures Playwright en 1024×768 et 768×1024 + dialogues ouverts | Pas de Supabase local : c'est le seul moyen de vérifier la règle 1 (iPad d'abord) avant le projet |
| 2026-09-02 | Captures Playwright et proxy | Toujours cibler `http://localhost:3000`, jamais `127.0.0.1` (le navigateur passe par le proxy et la page ne s'hydrate pas) | Deux heures perdues à chercher pourquoi les dialogues ne s'ouvraient pas |
| 2026-09-02 | Onglets de la page Bateau | État dans l'URL (`?tab=`), `router.replace` ; défaut = Moteurs s'il y a un moteur actif | Rechargement, retour et partage conservent l'onglet ; le retour ne repasse pas par chaque onglet |
| 2026-09-02 | Suppression d'un relevé d'heures | Possible seulement pour les relevés manuels ou importés ; ceux issus d'une intervention ou d'un cochage se modifient mais se suppriment avec leur source | Un relevé dérivé supprimé rendrait son intervention muette |
| 2026-09-02 | Point de checklist « Fait » depuis la fiche moteur | Lien vers la catégorie tant que le dialogue « Fait » (E4-5) n'existe pas | Pas de bouton mort |
| 2026-09-02 | Tests RLS du stockage et garde-fou Supabase | Le test de suppression pose `set local storage.allow_delete_query = 'true'` (ce que fait l'API Storage) et le shim local reprend le trigger `storage.protect_delete` de la migration Storage 0055 | Storage ≥ 1.x refuse les `delete` directs sur `storage.objects` ; la CI cassait alors que le local passait |
| 2026-09-02 | « Réalisé par » du dialogue « Fait » | Sélecteur natif : moi (défaut) · les membres du bateau · « Quelqu'un d'autre » avec nom libre (`completed_by_name`) ; le prestataire complet passe par « + Ajouter les détails » (intervention liée, E3-3) | Deux taps au plus pour le cas courant ; l'annuaire n'a pas sa place dans un dialogue de 10 s |
| 2026-09-02 | Calage grossier de l'assistant | Quatre réponses par point (Jamais · < 6 mois · ~1 an · > 2 ans) → `anchor_date` = aujourd'hui − 0 / 3 / 12 / 30 mois ; les points retirés passent `is_active = false` (réactivables en pied de catégorie) | Rien n'est supprimé (modèle et historique conservés) ; un ancrage estimé vaut mieux qu'un « jamais » qui masque tout |
| 2026-09-02 | Stratégie realtime | Un canal par bateau ; tout événement (8 tables) → invalidation de toutes les queries du bateau + `router.refresh()` coalescés à 300 ms ; reprise après coupure ou retour du réseau = même rafraîchissement complet | Les écrans sont des Server Components : une table de correspondance table → queries n'apporterait rien et se désynchroniserait des vues |
| 2026-09-02 | Bannière d'installation PWA | À partir de la 2ᵉ session (compteur `localStorage`, une par onglet), masquable 30 jours, dernière des priorités du bandeau du tableau de bord ; iOS = consigne Partager → Sur l'écran d'accueil, Chromium = `beforeinstallprompt` rejoué ; absente en mode standalone ; entrée « Installer l'application » du menu compte ouvre les mêmes consignes | Une seule surface d'installation, jamais au premier lancement, jamais insistante |
| 2026-09-02 | Liens du tableau de bord vers le journal | Les interventions de la file et les dernières interventions renvoient vers la liste du journal tant que la page de détail (E3-4) n'existe pas | Pas de lien mort en preview |
| 2026-09-02 | Bouton d'action dans une ligne cliquable | `ListRow` sépare le lien (texte) et l'action (bouton) dans un même conteneur ; jamais de bouton imbriqué dans un lien | HTML valide, et « Fait » ne déclenchait plus la navigation de la ligne |
| 2026-09-02 | Spécialité des intervenants | Colonne `specialty` en texte libre (DATA-MODEL §3.11) ; l'UI propose la liste fermée (7 spécialités + Autre → texte libre) et regroupe par valeur ; les libellés vivent dans `fr.json` | Le seed porte déjà des valeurs libres (« Électronicien / B&G ») ; une énumération obligerait une migration sans gain |
| 2026-09-02 | « + » sur l'écran Intervenants | Cible directe = nouvel intervenant (owner/editor) ; un `pro` garde la feuille de choix | Règle D19 : l'objet évident de l'écran |
| 2026-09-02 | Adresse de l'invité sur la page publique | `get_invitation_preview` renvoie l'adresse masquée (`x•••@domaine`) ; le formulaire de connexion n'est plus pré-rempli ; la vérification exacte reste dans `accept_invitation` | Le lien circule (SMS, capture d'écran) : il ne doit pas révéler l'adresse |
| 2026-09-02 | Durée d'accès des invitations | Puces 7 / 30 / 90 jours / sans limite → `valid_until` ; défaut : 30 j pour un pro invité par un owner, 90 j pour toute invitation d'un editor (pro/viewer seulement, jamais « sans limite ») ; prolongation « Réactiver 90 j » sur un membre expiré | D28/D29 ; la politique d'insertion en base impose la même règle |
| 2026-09-02 | Suppression de compte et dernier propriétaire | Le bouton est désactivé tant que le compte est seul owner d'un bateau, avec les liens Transférer / Supprimer le bateau ; `completed_by_name` est figé par le service role juste avant `deleteUser` | D31 ; on n'attend pas l'échec serveur pour expliquer |
| 2026-09-02 | Format de l'export | JSON complet (une clé par table, `format: xaman-boat-export`, version 1) + deux CSV `;` avec BOM UTF-8, CRLF, virgule décimale, formules neutralisées ; générés par une Server Action, téléchargés côté client (pas de zip, pas de stockage) | Excel/Numbers en français ouvrent le CSV sans assistant ; rien à héberger |
| 2026-09-02 | Transfert du bateau | Trois étapes explicites : export, invitation du nouveau propriétaire en `owner` (invitation ordinaire, rôle owner), « Quitter le bateau » actif seulement quand un autre owner est en place (`ensure_last_owner` protège) | D30 sans nouvelle table ni état intermédiaire |
| 2026-09-02 | Rapport d'état | Page serveur `/report` imprimable, coûts inclus par défaut avec bascule `?costs=0`, 12 mois d'échéances et d'interventions, 5 dernières sorties de l'eau, pied « Carnet tenu dans Xaman » ; l'app shell est masqué à l'impression | Un livrable à montrer sans dépendance PDF (Partager → Imprimer sur iPad) |
| 2026-09-02 | Envoi de l'e-mail hebdomadaire | Edge Function Deno `weekly-digest` + Resend (clé en secret de fonction) ; déclenchée par pg_cron via pg_net, URL et clé service lues dans Vault ; sans clé Resend la fonction journalise seulement | Supabase n'envoie que les e-mails d'authentification ; Resend est le plus simple à brancher et reste remplaçable |
| 2026-09-02 | Hors ligne, périmètre V1 | Bandeau permanent avec l'heure des données, formulaires jamais vidés, bouton « Hors ligne — réessayer » ; les brouillons renvoyés plus tard (D25) viennent après la fusion du journal | Chaque formulaire de création doit exister avant d'être mis en file |
| 2026-09-02 | Audit tactile automatisé | Playwright parcourt les pages `/dev/ui/*` dans trois viewports et échoue si une commande ou un champ fait moins de 44 px, un champ moins de 16 px, ou si la page déborde ; les cibles de 44 px sont obtenues par un pseudo-élément (case à cocher, interrupteur) sans grossir le dessin | La règle 1 devient vérifiable en CI plutôt que relue à l'œil |
| 2026-09-02 | Points de checklist dans le formulaire d'intervention | Liste de cases pré-cochées par similarité **dans** le formulaire ; la feuille « Cocher les points correspondants ? » après l'enregistrement disparaît | Un écran, une sauvegarde, aucune seconde décision après le toast (D3, E3-3) |
| 2026-09-02 | Score de similarité titre ↔ point | `greatest(similarity, strict_word_similarity)` sur le libellé **sans** le suffixe « — Moteur », seuil 0,5 (`0005`) | Un titre court n'atteint jamais 0,5 en similarité simple face à un libellé long, et le suffixe moteur commun faisait matcher tous les points du moteur |
| 2026-09-02 | Repli des accents | Fonction `text_fold()` à base de `translate()` plutôt que l'extension `unaccent` | Une extension de moins en production ; la fonction reste `immutable` (indexable) |
| 2026-09-02 | Date future d'une intervention | Bloquante pour Terminé / En cours (`validation.date_in_future_done`), libre pour Planifié / Urgent | D17 est normatif et la base refuse un relevé futur ; une simple note produirait une erreur serveur illisible |
| 2026-09-02 | Cochage des points depuis une intervention | Seulement quand le statut est Terminé ; pré-cochage à la création uniquement, l'édition garde les points déjà portés | Un travail planifié n'a rien acquitté ; renommer une vieille intervention ne doit pas créer de réalisations |
| 2026-09-02 | Filtre « À vérifier » du journal | `/logs?check=1` ; `?review=1` reste le lien profond vers la revue guidée `/logs/review` | Deux usages distincts, le second déjà câblé depuis le bandeau du tableau de bord |
| 2026-09-02 | « En faire un entretien récurrent » | Un intervalle en heures n'est proposé que pour les moteurs dont l'intervention a relevé les heures | Sinon le nouveau point démarrerait sans référence d'heures |
| 2026-09-02 | Achats dans l'écran de reprise | Case « vérifié » cochée par défaut, décochable ligne par ligne | Laisser une ligne pour plus tard sans quitter l'écran |
| 2026-09-02 | « + » sur le Journal | Aucun « + » dans l'en-tête de `/logs` : le bouton de la barre crée déjà une intervention ; l'état vide garde son appel à l'action | Règle D19, comme sur `/contacts` |
| 2026-09-02 | Privilèges d'exécution des fonctions | Migration `0009` : plus d'`EXECUTE` pour `PUBLIC` ni `anon` sur les fonctions de `public` (sauf `get_invitation_preview` et `boat_id_from_storage_path`), ni pour `authenticated` sur les triggers et les fonctions réservées au service | Les privilèges par défaut de Supabase donnaient `EXECUTE` à `anon` à la création ; conseillers de sécurité Supabase 0028 / 0029 |
| 2026-09-02 | Mise en production des données Xaman | Projet Supabase `xaman` (eu-west-3) provisionné par MCP : migrations 0001–0009, données chargées depuis la base locale (dump multi-lignes, contrôle MD5 table par table), compte `joseph@myfrank.io` créé par SQL (admin plateforme + owner de Xaman) | Aucun accès Postgres direct depuis l'agent ; les comptes de Xav et Emmanuel seront créés par invitation dès que leurs adresses sont connues |
| 2026-09-02 | Le gaz est-il un onglet de Dépenses ? | Non : `?tab=purchases&kind=gas` ; `?tab=gas` est un alias qui ouvre le dialogue « Bouteille de gaz » | E5-1 : le gaz est un filtre + un raccourci de saisie ; trois onglets restent lisibles sur iPad |
| 2026-09-02 | Période par défaut de la liste des achats | « Toute la période » (l'onglet Dépenses garde 12 mois glissants) | Une fenêtre de 12 mois cacherait silencieusement l'import du carnet papier |
| 2026-09-02 | « Année civile » | Année en cours seulement, pas de sélecteur d'année | Option la plus simple compatible avec SPEC ; la comparaison montre déjà N-1 |
| 2026-09-02 | Champs du dialogue « Bouteille de gaz » | Date, type de bouteille, fournisseur, montant (pas de note) | Budget du flux (f) : 5 taps ; la note reste accessible en modifiant l'achat |
| 2026-09-02 | Date d'un achat / d'une sortie de l'eau | Achat : passé ou aujourd'hui (`pastOrTodayDate`) ; `started_at` d'une sortie de l'eau peut être futur | Un ticket est toujours passé ; une sortie de l'eau se réserve à l'avance |
| 2026-09-02 | Second contrôle de création sur la vue Gaz | Bouton nommé « Bouteille de gaz », pas un « + » | Le « + » de l'écran crée un achat ; un raccourci nommé n'est pas un « + » concurrent (D19) |
| 2026-09-02 | Badge « À terre » | Remplissage « En cours », pas rouge | Le rouge est réservé à ce qui exige une action |
| 2026-09-02 | Modification d'un achat importé | Enregistrer une ligne efface `needs_review` | Lire et enregistrer une ligne, c'est la vérifier |
| 2026-09-02 | Filtre de source des dépenses | Multi-sélection ; une sélection vide revient à « toutes » | Ne jamais afficher un écran vide à cause d'un tap raté |
| 2026-09-02 | Fournisseur / chantier | Un contact de l'annuaire l'emporte sur le texte libre ; jamais les deux stockés | Une seule source de vérité par ligne |
| 2026-09-02 | Vérification d'une pièce en stock | Enregistrer la fiche ou toucher +/− met `checked_at` à aujourd'hui ; pas de bouton « vérifié » séparé | Lire et enregistrer une ligne, c'est la vérifier (même règle que les achats importés) ; un contrôle de plus serait un troisième bouton sur la ligne |
| 2026-09-02 | Suppression d'une pièce | Physique, après confirmation nommée ; pas de corbeille | Donnée déclarative sans historique (D10) ; la règle 9 (corbeille) ne vise que interventions, achats et sorties de l'eau |
| 2026-09-02 | Décrément sous zéro | `adjust_part_quantity` plafonne à 0 et le bouton − est inactif à 0 | Un stock négatif n'a pas de sens ; deux taps rapides restent atomiques côté base |
| 2026-09-02 | Création d'une pièce | Bouton nommé « Ajouter une pièce » dans l'onglet Stock ; le « + » de l'écran Dépenses crée toujours un achat | Règle D19 : un seul « + » par écran, un raccourci nommé n'est pas un « + » concurrent |
| 2026-09-02 | Badge « Sous le seuil » | Contour et teinte `state-overdue` (rouge) sur la ligne et compteur dans le filtre | Le rouge est réservé à ce qui exige une action : ici, racheter |
| 2026-09-03 | Page d'accueil `/` | Redirection vers `/login` (l'écran d'attente « en cours de construction » est supprimé) | L'app est privée : un visiteur non connecté n'a rien à y voir, et la racine était un cul-de-sac depuis la mise en production |
| 2026-09-03 | Portée des brouillons hors ligne | Créations seulement : intervention, achat, pièce, cochage d'un point ; jamais une modification | Rejouer une modification écraserait le travail d'un autre (D25) |
| 2026-09-03 | Renvoi des brouillons | Manuel, depuis la carte du tableau de bord ; aucune synchronisation de fond | Rien ne quitte l'iPad sans un geste, donc une ligne erronée peut encore être supprimée |
| 2026-09-03 | File pleine | 20 saisies maximum, message explicite au-delà | Au-delà, la personne n'est pas hors ligne un instant : elle travaille sans réseau et doit le savoir |
| 2026-09-03 | Échec au renvoi | Une ligne refusée par la base garde son erreur et reste dans la file ; un échec réseau arrête le renvoi | Rien n'est jeté en silence, et inutile d'insister quand le lien est retombé |
| 2026-09-03 | Saisie de masse | **Règle produit** : partout où l'app stocke une liste, elle doit accepter un import (fichier .csv / .xlsx, collage depuis Excel, photo, carnet d'adresses) ; ressaisir à la main n'est jamais la seule voie | Un carnet d'entretien se reprend d'un tableur ou d'un carnet papier existant ; obliger à tout retaper condamne l'adoption |
| 2026-09-03 | Architecture de l'import | Un moteur unique (analyse du fichier → correspondance des colonnes → aperçu → validation zod ligne à ligne → upsert idempotent) et un descripteur par entité, plutôt qu'un import par écran | Une seule surface à tester et à durcir ; ajouter une entité = décrire ses colonnes |
| 2026-09-03 | Formats acceptés | `.csv`, `.tsv`, collage direct depuis Excel (le presse-papiers est du TSV) et `.xlsx` via un analyseur chargé à la demande | Le collage couvre Excel sans dépendance ni fichier à exporter ; le `.xlsx` reste possible sans alourdir le bundle des autres écrans |
| 2026-09-03 | Dédoublonnage à l'import | Clé naturelle par entité (nom pour un contact, désignation pour une pièce, référence externe si fournie) ; une ligne connue est mise à jour, jamais dupliquée | Réimporter un tableau corrigé doit corriger, pas créer un doublon (règle 11) |
| 2026-09-03 | Lignes refusées | L'import s'exécute quand même : les lignes valides passent, les autres sont listées avec leur motif et récupérables en CSV | Un tableau réel a toujours trois lignes bancales ; tout rejeter pour trois lignes est un mur |
| 2026-09-03 | Barre d'actions des dialogues | Elle suit le contenu au lieu d'être collée en bas | Sur un écran court, le fond opaque de la barre collante recouvrait le texte : le dialogue d'installation montrait sa description coupée en deux |
| 2026-09-03 | Fil d'Ariane | Déduit de l'URL dans `AppShell`, jamais déclaré page par page ; absent sur la racine d'un onglet | Chaque écran en hérite sans ligne de code, et « Journal » seul au-dessus du Journal est du bruit |
| 2026-09-03 | Largeur des puces de choix | `grow basis-auto` + plancher de 44 px, groupe qui passe à la ligne ; jamais `flex-1` qui rétrécit sous le contenu | `flex-1` faisait sortir « Sorties de l'eau » de son cadre ; `min-width: max(44px, fit-content)` n'existe pas en CSS |
| 2026-09-03 | Où commence le fil d'Ariane ? | À la section du menu à laquelle l'écran appartient (onglet, entrée de la feuille « Plus », entrée du menu compte) : sur la racine d'une section, cette seule miette nomme la page (`aria-current`, non cliquable) ; plus bas, elle ramène à la liste. Les sorties de l'eau s'accrochent au Journal (D9), le rapport aux Paramètres. La feuille « Plus » n'est jamais une miette : c'est une feuille, pas un écran | Remonter d'un écran profond doit se faire dans le fil ; le menu, lui, relance le parcours au lieu de le reprendre |
| 2026-09-03 | Le tableau de bord ouvre-t-il tous les fils ? | Non : il n'a que sa propre miette, sur `/dashboard` | C'est un des quatre onglets, toujours à un tap dans la barre et dans la sidebar ; en tête de chaque fil il répéterait une commande déjà à l'écran et pousserait les miettes utiles sur une deuxième ligne en 390 px |
| 2026-09-03 | Miettes qui ne mènent nulle part | Une miette cliquable pointe toujours vers un écran servi : « Moteurs » et « Stock » visent l'onglet de leur section (`/boat?tab=engines`, `/supplies?tab=stock`) et non `/boat/engines` ni `/supplies/parts` ; la « Fiche » d'un achat ou d'une pièce, que l'app ne fait que modifier, est retirée du fil | Un fil qui propose un 404 est pire qu'un fil plus court ; une miette inerte au milieu se lit comme un lien mort |
| 2026-09-03 | Mot de passe | **Renversement de la règle 7 d'authentification** : le mot de passe devient le mode principal (`signInWithPassword`), le code OTP à 6 chiffres reste offert à côté et sert toujours aux personnes invitées, qui n'ont pas encore de mot de passe | Demande explicite de Joseph : « rajoute la possibilité de créer un compte de manière classique et d'avoir un mot de passe ». Un compte sans mot de passe se crée mal depuis une page publique, et une inscription qui exige d'aller relever sa boîte mail avant même d'entrer perd la moitié des visiteurs |
| 2026-09-03 | Confirmation de l'adresse | L'écran d'inscription gère les deux réglages Supabase : session rendue → la personne entre ; pas de session → « vérifiez votre boîte mail » | Le réglage vit dans le projet Supabase, pas dans le code ; l'activer ou le désactiver ne doit jamais casser l'écran |
| 2026-09-03 | Réinitialisation | Lien de récupération par e-mail vers `/reset-password`, écran qui refuse de s'afficher sans la session ouverte par le lien ; la réponse est la même que l'adresse existe ou non | Un « enregistrer » qui ne fait rien en silence est pire qu'un refus ; et dire quelles adresses ont un compte, c'est dire qui navigue avec qui |
| 2026-09-03 | Page d'accueil `/` (révision) | Page de présentation publique : promesse, tableau de bord dessiné, ce que fait l'app, comment ça marche, deux appels à l'action. La redirection sèche vers `/login` du matin est abandonnée ; une personne déjà connectée va toujours à `/boats` | Demander à un visiteur de s'identifier avant de lui dire à quoi il s'identifie n'ouvre aucun compte |
| 2026-09-03 | Aperçu de la page d'accueil | Dessiné avec les tokens de l'app, pas une capture d'écran | Une capture montre l'historique réel d'un bateau privé et vieillit au premier changement de design ; le dessin montre exactement ce que la personne obtiendra |
| 2026-09-03 | Lecture des `.xlsx` et des `.vcf` | Lus dans le navigateur, sans aucune dépendance : `DecompressionStream` pour le ZIP, lecteurs XML / ZIP / vCard écrits à la main (`src/lib/import/`) | Un classeur est un ZIP de XML et une fiche de contact du texte ; la règle 10 interdit une dépendance lourde pour ça, et le lecteur reste testable en Node où `DOMParser` n'existe pas |
| 2026-09-03 | Chargement de l'analyseur `.xlsx` (E12-5) | Découpage par route (il ne part qu'avec `/import`, vérifié sur les chunks du build), pas d'`import()` dynamique au moment du choix du fichier | Hors du bundle principal comme demandé, mais dans le précache du service worker : à bord, un chunk qui reste à télécharger au moment du tap casserait l'import justement quand le lien est mauvais |
| 2026-09-03 | Valeurs par défaut à l'import | Un champ marqué `allowDefault` accepte une valeur saisie une fois pour tout le fichier ; elle ne remplit que les cellules vides et satisfait un champ obligatoire | Une fiche `.vcf` ne porte pas de métier et un tableau de stock n'écrit pas l'unité sur chaque ligne : sans cela l'import est bloqué par une colonne que personne n'a |
| 2026-09-03 | Correspondance des colonnes | Une carte par colonne **du fichier** (en-tête tel qu'écrit, premières valeurs réelles, champ alimenté), et non une liste de nos champs ; un champ n'alimente qu'une colonne à la fois | On reconnaît son propre tableur, pas notre vocabulaire ; une pile de sélecteurs anonymes ne montrait jamais ce qu'il y avait dans la colonne |
| 2026-09-03 | Compte annoncé avant l'écriture | Créations / reconnaissances / refus calculés côté client avec la même fonction que la Server Action (`rejectionReason`) et les clés naturelles déjà sur le bateau, passées par la page | Annoncer un chiffre qui change après l'écriture serait pire que ne rien annoncer ; un aller-retour serveur à chaque frappe ne l'est pas non plus |
| 2026-09-03 | Zones sûres (encoche) | `safe-top` / `safe-bottom` remplacés par `safe-pt-*` / `safe-pb-*`, qui **ajoutent** l'encoche au padding du design au lieu de l'écraser | Les anciennes posaient `padding-top` / `padding-bottom` en propre : partout où elles côtoyaient un `pt-8` ou un `p-3`, ce padding tombait à zéro sur tout écran sans encoche — bureau, Android, iPad Safari hors mode autonome. L'en-tête de connexion collait au bord haut et le bloc compte collait au bord bas de la sidebar. C'est le « tout est croppé, trop haut et trop bas » signalé trois fois |
| 2026-09-03 | Écran d'authentification | La carte est centrée verticalement dans l'espace restant sous la bannière | Sur un écran haut, le formulaire perché en haut laissait 500 px de vide en dessous |
| 2026-09-03 | Adresse de retour des e-mails d'authentification | L'origine du navigateur, pas `NEXT_PUBLIC_APP_URL` | La variable est figée à la compilation et retombe sur localhost quand elle manque : un lien de confirmation envoyé depuis la production pointerait alors vers la machine de personne. Supabase vérifie toujours l'origine contre sa liste blanche, donc rien n'est élargi |
| 2026-09-03 | Reconnaître une intervention ou un achat à l'import | Clé = référence du fichier si elle existe, sinon libellé **et** date | « Vidange » en avril et « Vidange » en octobre sont deux interventions, pas une corrigée deux fois. La référence d'un export comptable l'emporte : elle survit à un libellé réécrit |
| 2026-09-03 | Historique importé | Toute intervention et tout achat entrés par import arrivent `needs_review = true` | Un carnet repris d'un tableur se relit une fois, écran par écran : dates, systèmes et prestataires se confirment là, pas au moment de l'import |
| 2026-09-03 | Prestataire inconnu à l'import | Rapproché des contacts du bateau par le nom ; sans correspondance, recopié dans les notes (« Prestataire : X ») et la ligne reste « à vérifier » | Rien n'est perdu et rien n'est inventé : créer un contact en douce à partir d'une colonne mal remplie polluerait le carnet d'adresses |
| 2026-09-03 | Lignes à la corbeille | Exclues du rapprochement : un réimport crée une ligne neuve au lieu de ressusciter ce qu'on a choisi de retirer | Le contraire ferait revenir une ligne supprimée à chaque réimport, sans que personne comprenne pourquoi |
| 2026-09-03 | Type d'achat illisible | Classé « Autre » plutôt que refusé | Le montant et la date sont ce qui compte ; le type se corrige d'un tap |
| 2026-09-03 | Nom de la section « Journal » | Renommée « Interventions » | Demande de Joseph : la section porte le nom de ce qu'elle contient. Routes, tables et identifiants inchangés (`/logs`, `maintenance_logs`) : seuls les mots lus changent |
| 2026-09-03 | Propriétaire d'une pièce jointe | La table garde le couple polymorphe `entity_type` (enum) + `entity_id` de `DATA-MODEL §3.19` plutôt que deux FK nullables `maintenance_log_id` / `purchase_id` ; l'intégrité qu'une FK aurait donnée est portée par le trigger `attachments_owner_guard()` (la ligne visée doit exister **et** porter le même `boat_id`) et la purge par `cleanup_attachments()` | La table, ses politiques RLS et `attachments_count` dans `maintenance_logs_view` existaient déjà sous cette forme depuis `0001` / `0002` ; deux FK auraient forcé à réécrire deux vues et fermé la galerie équipement et la photo du bateau (SPEC S1, V1.1), qui ne sont que deux valeurs d'enum de plus |
| 2026-09-03 | Réduction des photos | Chaque photo est ré-encodée dans le navigateur avant l'envoi (canvas, grand côté 2000 px, JPEG qualité 0,82) ; l'original n'est gardé que s'il est déjà petit (≤ 2000 px **et** ≤ 400 ko) ou si le décodage échoue. Pas de bibliothèque : `createImageBitmap` + `<canvas>` | Une photo d'iPhone pèse 4 Mo et la connexion est un partage 4G au mouillage ; une facture photographiée reste lisible à 2000 px. La décision de réduire (`planResize`) est une fonction pure testée, le canvas n'est que de l'exécution |
| 2026-09-03 | Envoi pendant la saisie | Sur une création, les objets partent au fur et à mesure (l'UUID de l'intervention est tiré à l'ouverture du formulaire) et les lignes `attachments` ne sont écrites qu'après l'enregistrement | Attendre l'enregistrement ferait patienter au pire moment ; écrire la ligne avant que l'intervention existe est refusé par la garde d'intégrité. Contrepartie assumée : un formulaire abandonné laisse un objet orphelin dans un bucket privé, que personne ne référence |
| 2026-09-03 | Suppression d'un document | Corbeille (`deleted_at`) et **conservation** de l'objet Storage ; seul un document jamais enregistré (envoyé puis retiré avant l'enregistrement du formulaire) est effacé physiquement | « Annuler » doit rendre la facture ; un objet supprimé ne revient pas |
| 2026-09-03 | Import de documents en lot | Rien n'est envoyé avant qu'on ait choisi la destination de chaque fichier (intervention existante, ou nouvelle intervention créée depuis le document) ; un fichier sans réponse reste dans la liste | Le chemin de stockage contient l'identifiant du propriétaire : envoyer d'abord obligerait à déplacer l'objet ensuite. Et un document qu'on ne sait pas classer doit rester visible, pas disparaître |
| 2026-09-03 | Le contrôle « + Ajouter » (D19) | **Renversement partiel de D19.** Le contrôle unique du cadre est nommé d'après l'acte dominant : « Noter une intervention », qui mène directement au formulaire, avec « Noter autre chose » (feuille des quatre autres actes) juste en dessous. Les écrans à objet évident nomment cet objet au lieu de dire « Ajouter » | « Ajouter » ne disait jamais *quoi* ; en portrait et sur téléphone le contrôle n'était qu'un glyphe. La règle « un seul chemin par action » est conservée : un seul contrôle de création par écran, mais il porte enfin un nom (D35) |
| 2026-09-03 | Action de création sur l'écran des interventions | **Renversement de la décision du 2026-09-02 « aucun « + » dans l'en-tête de /logs ».** L'écran porte « Noter une intervention » en haut à droite (48 px, libellé complet aux trois viewports) et le contrôle du cadre s'efface sur cet écran | Demande explicite de l'utilisateur : sur la liste, aucune action n'était visible ; le seul chemin était le bouton du coin de la sidebar. Un écran garde exactement un chemin : c'est le cadre qui cède, pas la page |
| 2026-09-03 | Libellé de cette action | « Noter une intervention » plutôt que « Ajouter une intervention » | Nomme l'acte et non l'entité, et ne répète pas le titre de l'écran (« Interventions ») ; même libellé partout (sidebar, tableau de bord, fiche moteur, fiche équipement) |
| 2026-09-03 | Bouton nommé sur le tableau de bord (D20) | **Ajout au contenu figé par D20** : sous l'en-tête sombre, un bouton « Noter une intervention » pleine largeur, **uniquement en dessous de `lg`** | À partir de `lg` la sidebar porte déjà le libellé ; en dessous, l'en-tête compact ne peut porter que des carrés de 44 px. Un contrôle nommé par viewport, jamais deux |
| 2026-09-03 | Départ de l'acte depuis le sujet | Fiche moteur et fiche équipement portent « Noter une intervention » ; le formulaire arrive avec la catégorie choisie (et le bloc des heures ouvert pour un moteur) mais le focus reste sur le titre | Là où le sujet est déjà nommé, le formulaire doit être plus court : 6 taps → 4. Le focus ne doit jamais être volé au premier champ |
| 2026-09-03 | Champ titre de l'intervention | Libellé « Qu'avez-vous fait ? » + exemple en placeholder ; titre d'écran « Noter une intervention » | Le vocabulaire du bord plutôt que le nôtre ; « Titre » ne dit pas ce qu'on attend |
| 2026-09-03 | Catégorie obligatoire à la saisie | Conservée obligatoire, mais pré-remplie chaque fois que l'écran d'origine la connaît (point de checklist, moteur, équipement, suggestion de titre) | Elle porte le pré-cochage par similarité, le liseré et les filtres ; la supprimer coûterait plus qu'elle ne rapporte. Réduire le nombre de fois où on la demande vaut mieux que la rendre facultative |
| 2026-09-03 | Dépenses et Achats (E5-1) | **Fusion en une seule liste** (D33) : les lignes de `expenses_by_category` (coût d'intervention, achat, sortie de l'eau) dans un seul tableau, chaque ligne pointant vers ce qu'elle a payé. Filtres période / « payé pour » / type d'achat / catégorie ; totaux par catégorie, comparaison, cumul et export CSV conservés ; pagination « Charger plus » conservée ; le gaz reste un filtre + un raccourci | Un achat **est** une dépense : la séparation obligeait à choisir un onglet avant de pouvoir lire ou saisir. Aucun écran ne perd de fonction |
| 2026-09-03 | Période par défaut des Dépenses | « Toute la période » (au lieu de 12 mois glissants) ; `EXPENSE_PERIODS` gagne `all`, sans comparaison possible (« — ») | La liste fusionnée hérite du besoin de l'ancien onglet Achats : une fenêtre de 12 mois masquerait l'import du carnet papier |
| 2026-09-03 | Stock de pièces (D10) | **Renversement de D10** : le stock quitte Dépenses et devient une section de **Bateau › Équipements** (D34), à côté des catégories d'équipement ; routes `/boat/parts/*`, anciennes URL `/supplies/parts/*` et `?tab=stock` redirigées | Demande répétée de l'utilisateur : Bateau porte ce que le bateau **est**, Dépenses porte l'argent. Une pièce de rechange est un objet à bord, pas un coût |
| 2026-09-03 | Accordéons de l'onglet Équipements | **Tous fermés à l'arrivée** (D36) ; aucun état mémorisé d'une visite à l'autre ; ouverture automatique s'il n'y a qu'une seule section | 36 équipements ouverts = un long défilement ; fermés, l'inventaire tient sur un écran. Ne rien mémoriser rend l'écran prévisible ; avec une seule section il n'y a rien à choisir |
| 2026-09-03 | Identité du bateau | **Renversement** de l'onglet « Identité » : l'identité devient l'en-tête de l'écran Bateau (nom + modèle · constructeur · n° de coque · type), avec un crayon pour l'éditer sur place ; le reste (année, pavillon, port d'attache, n° de voile, dimensions, notes, modèle de checklist) passe dans « Détails du bateau », replié par défaut. Les onglets ne portent plus que les listes | L'identité n'est pas une destination : la mettre à égalité avec les listes coûtait un tap pour savoir de quel bateau on parle. `?tab=identity` retombe sur la liste par défaut |
| 2026-09-03 | Lien intervention ↔ dépense | Chaque ligne de Dépenses nomme ce qu'elle a payé et y renvoie (intervention, achat, sortie de l'eau) ; le coût reste porté par l'intervention, aucune table nouvelle | « Garder le lien visible des deux côtés » sans dupliquer la donnée : la vue `expenses_by_category` fait déjà l'union |
| 2026-09-03 | Colonnes écrites par l'import | `buildDatabaseRow` est une fonction pure exportée, et `tests/unit/import-write.test.ts` écrit ce qu'elle renvoie dans le vrai schéma, dans une transaction annulée | TypeScript ne peut pas vérifier un nom de colonne qui n'existe que dans Postgres : le client Supabase reçoit l'objet en `never`. C'est ainsi qu'a été attrapée `maintenance_logs.next_due_at`, supprimée par la migration 0004 et toujours proposée par l'import — elle n'aurait échoué qu'au premier vrai fichier, en production |
| 2026-09-03 | Puce « tout » d'un groupe de bascule | Valeur propre (`"all"`), jamais la chaîne vide | Radix lit une valeur vide comme « rien de sélectionné » : « Tous les types » ne pouvait pas s'allumer et le groupe entier avait l'air inerte. Signalé à l'usage |
| 2026-09-03 | Chiffre d'une tuile du tableau de bord | Taille choisie d'après la longueur de la valeur, calée sur la tuile la plus étroite (137 px, iPad paysage) | À 32 px fixes, « 4 321,50 € » débordait déjà sa tuile aux trois tailles d'écran. Le retour à la ligne n'est pas une option : un montant français sépare ses milliers par une espace **insécable**, donc la seule coupure possible tombe entre deux chiffres et se lit comme un autre nombre |
| 2026-09-03 | Bloc des heures moteur | Le même bouton ouvre et referme ; replié avec des valeurs saisies, il dit combien | Il ne faisait que s'ouvrir : impossible de le ranger en pleine rédaction. Et un relevé qui sera enregistré ne doit jamais être invisible |
| 2026-09-03 | Ordre des onglets du bateau | Équipements d'abord, et par défaut (D39) | Trente-six équipements contre trois moteurs, et les moteurs ont déjà leur bloc sur le tableau de bord quand l'inventaire n'en a aucun |
| 2026-09-03 | Métiers d'un intervenant | La liste des puces = les sept métiers intégrés **plus** ceux déjà utilisés sur ce bateau | Un métier tapé une fois sous « Autre » ne servait qu'à ce contact ; il devient une puce pour le suivant. C'est « ajouter une catégorie » sans table ni écran de réglages |
| 2026-09-03 | « Stock » dans le filtre des interventions | Sélectionne les interventions ayant consommé une pièce, via l'achat qui les relie | Une intervention est rangée sous un système, jamais sous une pièce : c'est le seul lien que le modèle porte réellement. Sans achat rattaché, le filtre ne renvoie rien plutôt que tout |
| 2026-09-03 | Identité d'un point de checklist à l'import (E12-4) | Rapprochement **par le nom du point**, accents et casse pliés comme un en-tête de colonne (`normaliseHeader`). Un nom que le bateau ne porte pas est **refusé** (`import.errors.unknownItem`), un nom porté par deux points aussi (`ambiguousItem`) ; les deux sont listés et exportables en CSV. La colonne accepte une valeur donnée une fois pour tout le fichier (`allowDefault`) | Un tableur écrit « Vidange bâbord », jamais un UUID. Rattacher au point le plus proche mettrait une réalisation — donc une échéance — sur le mauvais point, et personne ne le verrait : refuser nomme le problème pendant que la personne a encore le fichier sous les yeux. Un carnet d'un seul point (« toutes mes vidanges ») se saisit une fois au lieu de 40 cellules |
| 2026-09-03 | Identité d'un moteur à l'import | Même rapprochement par nom, plus les **positions** (« bâbord », « BB », « tribord », « central », « hors-bord ») — mais seulement tant qu'un seul moteur porte cette position, et jamais par-dessus un libellé réellement écrit | Un carnet d'heures nomme les moteurs par leur bord, pas par le libellé saisi dans l'app ; sur un catamaran à deux moteurs bâbord l'alias ne veut plus rien dire et disparaît |
| 2026-09-03 | Compteur d'heures en baisse à l'import | **Refusé** (`import.errors.hoursBackwards`), avec le motif qui renvoie vers la fiche du moteur. La comparaison porte sur le plus haut relevé **daté avant ou le jour même** de la ligne — ceux du bateau et ceux des lignes déjà acceptées du même fichier —, jamais sur le dernier relevé connu | Contrairement au dialogue de relevé (D12), où une baisse est un simple avertissement qu'une personne lit et où elle peut cocher « le compteur a été remplacé », un import écrit 300 lignes sans que personne ne regarde. Or le remplacement du compteur n'est pas une donnée mais une **déclaration** : il pose `engines.counter_reset_at` et neutralise toutes les échéances en heures antérieures. Un tableur ne peut pas prendre cette décision, donc il ne l'inventera pas. La comparaison « avant ou le jour même » est ce qui permet d'importer un historique ancien sous un compteur déjà haut, et de rester monotone dans le sens du temps ; le sens inverse (une ligne au-dessus d'un relevé postérieur) n'est pas testé, car il ferait refuser une ligne correcte à cause d'une valeur fausse déjà en base |
| 2026-09-03 | Clé naturelle des deux nouvelles listes | Réalisation = **point résolu + jour** ; relevé = **moteur résolu + jour**. Jamais le libellé : c'est l'identifiant retrouvé qui entre dans la clé, des deux côtés (`naturalKey` reçoit le rapprochement, `existingKey` relit `checklist_item_id` / `engine_id`) | Deux lignes du même fichier orthographient le même point de deux façons ; sans passer par l'identifiant, le réimport créerait un doublon exactement dans le cas que la règle 11 vise |
| 2026-09-03 | Relevés portés par une intervention ou une réalisation | **Jamais rapprochés** : `existingKey` renvoie `""` dès que `maintenance_log_id` ou `checklist_completion_id` est renseigné, et un relevé importé cohabite avec eux | Un relevé dérivé appartient à sa ligne d'origine : la corbeille le range et le restaure (D5, 0004 §9). Qu'un tableur le réécrive le désynchroniserait de l'intervention qui l'a produit, sans trace |
| 2026-09-03 | « À vérifier » sur les deux nouvelles listes | **Non** : `checklist_completions` et `engine_hour_readings` n'ont pas de colonne `needs_review` (0001 ne l'a donnée qu'à `maintenance_logs` et `purchases`) et n'en reçoivent pas | La relecture guidée (E3-7) porte sur des lignes à corriger champ par champ ; ici la ligne est refusée ou exacte, il n'y a pas d'entre-deux à relire. Ajouter la colonne pour une file d'attente que rien ne lit coûterait une migration et une vue |
| 2026-09-03 | Heures moteur d'une réalisation | **Obligatoires** exactement là où la base les exige — un point qui porte un intervalle en heures —, refusées sinon (`noEngineHours`) ; ailleurs facultatives. « Fait par » est recopié en texte (`completed_by_name`), `completed_by` reste nul, « Valide jusqu'au » et la note sont facultatives | `check_completion_hours` (0003, `engine_hours_required`) casserait le lot entier pour une seule ligne : le motif doit être annoncé avant l'écriture, ligne par ligne. Et deviner quel compte de l'équipage désigne « Xav » dans un carnet papier mettrait un nom sur quelqu'un qui n'était peut-être pas là |
| 2026-09-03 | Le compteur suit les réalisations importées | Aucun second chemin d'écriture : l'import n'écrit que `checklist_completions`, et le déclencheur `sync_engine_hours_from_completion` (0003) en dérive le relevé | La logique de suivi vit en base (règle 8) ; la refaire côté import donnerait deux vérités à maintenir. Cela ne renverse pas la décision du 2026-09-02 (« carnet papier importé **sans** relevé d'heures ») : celle-ci visait les heures grattées au passage dans un tableau d'interventions, pas une colonne cartographiée, prévisualisée et refusable |
| 2026-09-03 | Dates futures à l'import | Refusées sur les deux nouvelles listes (`futureDate`), avec le jour de tolérance de `pastOrTodayDate` | `reject_future_date` (0004 §15) est un déclencheur sur `completed_at` et `read_at` : sans ce refus, une date mal lue ferait échouer tout le lot au lieu d'une ligne |
| 2026-09-03 | Entrées « Importer » des deux listes | Bouton `outline` dans l'en-tête de la Checklist, et à côté d'« Ajouter un moteur » dans l'onglet Moteurs | Même geste que sur Interventions et Dépenses : importer n'est pas un réglage, c'est une façon de saisir, et elle se trouve là où vit la liste |
| 2026-09-03 | Checklist et Interventions se présentent | Chaque section porte une ligne qui dit ce qu'elle est : « Ce qui doit être fait, et quand » face à « Ce qui a été fait à bord », chacune nommant le lien vers l'autre | Question posée à l'usage : « je ne comprends pas bien le lien entre les 2 ». Le modèle était juste et le lien réel en base, mais rien ne le disait à l'écran : deux onglets de même poids se lisaient comme deux listes du même genre |
| 2026-09-03 | Compte de résultats des interventions | Affiché seulement quand un filtre est actif | Sous un titre et sans filtre, « 7 résultats » n'apprend rien ; la place revient à ce que la section est. Avec un filtre, il répond à « combien mon filtre a-t-il gardé » |
| 2026-09-03 | Retour d'une réalisation vers son intervention | La date d'une réalisation, dans l'historique d'un point, mène à l'intervention qu'elle a écrite | Le chemin existait dans un seul sens (l'intervention listait les points validés) ; le plan et l'historique sont maintenant à un tap l'un de l'autre dans les deux sens |
| 2026-09-03 | Créer un point de checklist depuis la racine (A9) | La catégorie devient un champ du formulaire, pas une condition pour l'ouvrir : `/checklist/new` existe et demande la catégorie ; `/checklist/<id>/new` la présélectionne toujours | Exiger la catégorie dans l'URL faisait de la racine un cul-de-sac : on ne pouvait ajouter un point qu'en sachant d'avance dans quel système le ranger. Le formulaire possédait déjà son sélecteur de catégorie, il ne manquait que la route |
| 2026-09-03 | Suppression d'une pièce du stock | **Renversement de D10** : `parts.deleted_at`, mise à la corbeille avec « Annuler » puis restauration pendant 30 jours ; purge par `purge_trash()` (D40) | Le stock d'un bateau est une donnée réelle, pas un brouillon : une confirmation nommée n'équivaut pas à être irrécupérable. Signalé par l'utilisateur — « je viens de delete une pièce du stock et ya rien dedans » : il attendait la corbeille, la règle 9 ne la lui donnait pas |
| 2026-09-03 | Périmètre de la corbeille | « Tout ce que l'app supprime » y va, mais **seulement ce qui n'a pas déjà un chemin réversible** : interventions, achats, sorties de l'eau (déjà), + pièces (D40), intervenants (D41) et pièces jointes ; catégorie = archivée, point de checklist = désactivé, moteur = désactivé, équipement = déposé, tous réversibles depuis leur propre écran et laissés tels quels (libellés complétés pour le dire) | Deux mécanismes de retour en arrière côte à côte sur le même objet, c'est deux endroits où chercher. La règle n'est pas « une corbeille partout » mais « rien ne disparaît sans retour possible » |
| 2026-09-03 | Suppression d'un intervenant | **Renversement du choix initial** (suppression physique) : `contacts.deleted_at` (D41), corbeille de 30 jours ; les liens des interventions, achats, pièces et sorties de l'eau sont **conservés** tant que la ligne n'est pas purgée | La suppression physique déclenchait `on delete set null` sur tout l'historique : le carnet perdait le nom du chantier, sans retour possible. Le soft delete rend le geste réversible *et* préserve l'historique ; seule la purge à 30 jours coupe le lien, ce que la confirmation annonce |
| 2026-09-03 | Retrait d'un membre | **Pas de corbeille** : le retrait reste immédiat et définitif | Retirer un accès n'est pas supprimer une donnée — ses interventions restent au carnet, ce que le libellé promet déjà. Une « corbeille de membres » ferait croire qu'une personne est stockée quelque part |
| 2026-09-03 | Pièces jointes dans la corbeille | Section à part entière de `/trash` (elles portent `deleted_at` depuis 0011), et **ajoutées à `purge_trash()`** | Elles n'étaient purgées par personne : un document mis à la corbeille y restait indéfiniment. Une section à part plutôt qu'une restauration seulement depuis l'intervention : passé le toast de 8 s, l'écran d'origine ne montre plus le document, donc n'offre plus de retour |
| 2026-09-03 | Suppression définitive depuis la corbeille | Chaque ligne de `/trash` porte « Restaurer » et une corbeille icône « Supprimer définitivement », gardée derrière une confirmation nommée ; réservée à `write`, et impossible sur une ligne qui n'est pas déjà à la corbeille | Attendre 30 jours pour se débarrasser d'une ligne visiblement fausse (un import raté) est un faux service. Le garde `deleted_at is not null` fait que ce chemin ne peut jamais détruire une ligne vivante |
| 2026-09-03 | Clés naturelles et corbeille | `unique (boat_id, external_ref)` de `parts` et `contacts` devient un **index unique partiel** `where deleted_at is null` | Sans cela, réimporter un fichier après avoir mis une de ses lignes à la corbeille levait 23505 contre une ligne que plus personne ne voyait. `maintenance_logs`, `purchases` et `haul_outs` portent encore le même piège : à traiter à part |
| 2026-09-03 | Réalisations de checklist et relevés d'heures | **Restent en suppression physique** pour l'instant ; les libellés le disent désormais explicitement | Leur donner `deleted_at` traverse `checklist_item_status`, `engine_current_hours`, le trigger D5 des heures mises de côté, la contrainte `unique (checklist_completion_id)` et la copie TS `checklist-status.ts` — le chantier exact d'un autre lot en cours. À faire seul, pas en passant |
| 2026-09-03 | Écriture d'une ligne qui existe déjà (D42) | **Jamais d'`upsert`** : `update` sur l'identifiant quand la ligne existe, `upsert` réservé à la création | Les politiques d'insertion de `maintenance_logs`, `attachments`, `checklist_completions` et `engine_hour_readings` vérifient `created_by = auth.uid()`. Postgres évalue ce `with check` sur la ligne **proposée** par `insert … on conflict do update`, avant même de regarder la ligne en conflit : un upsert qui laisse `created_by` tranquille — ce que E10-4 exige, « créé par » doit continuer à nommer l'auteur — était donc refusé pour tout le monde, propriétaire compris. Signalé à l'usage : « dès que je veux enregistrer on me dit ça » ; **plus aucune intervention existante n'était modifiable**. La politique n'est pas à assouplir, c'est elle qui empêche un pro de déposer une ligne au nom d'un autre : c'est l'action qui devait changer. La création garde l'upsert, donc un double tap n'écrit toujours qu'une ligne (règle 11) |
| 2026-09-03 | Bandeau sombre du tableau de bord | Il déborde à gauche et à droite, **jamais vers le haut** | La marge négative en haut (`-mt-8`) le peignait par-dessus le fil d'Ariane : « le titre Tableau de bord est caché derrière ce bloc ». Elle datait d'un temps où le bandeau était le premier enfant de la page ; le fil est passé au-dessus depuis. La maquette `/dev/ui/dashboard` portait la même ligne en double, ce qui explique que l'audit tactile ne l'ait jamais vu — les deux sont corrigées ensemble |
| 2026-09-03 | Section d'un écran d'import (D43) | L'écran appartient à la liste que nomme son `?entity=` : le fil d'Ariane l'ouvre dessus (« Bateau › Moteurs › Importer ») et l'entrée correspondante s'allume dans le menu | `/import` est la même adresse pour les sept listes ; seul le paramètre dit laquelle. Le fil se construisant sur le chemin seul, l'écran restait orphelin et le menu ne montrait rien de sélectionné — sur l'écran le plus difficile à situer. Une entité inconnue laisse « Importer » seul plutôt que de désigner une liste au hasard |
| 2026-09-03 | Stock sur l'écran Checklist (D43) | Une carte « Stock » ferme la grille des systèmes : nombre de pièces, badge « N sous le seuil », et le chemin vers la liste | C'est ce qu'on cherche en préparant le travail que ces cartes décrivent, donc elle est là où l'œil se trouve déjà plutôt qu'à deux taps. Neutre volontairement, sans barre de progression : une étagère n'a pas d'échéance, et une couleur de catégorie l'aurait fait lire comme un neuvième système (règle 12). Absente quand le bateau n'a aucune pièce |
| 2026-09-03 | Nom de la section « Checklist » | **Conservé** ; « To Do List » écarté | Une to-do list se vide quand on la termine ; celle-ci ne se vide jamais — un point coché revient à son échéance. « Checklist » est le mot du bord pour des points de vérification récurrents, et l'UI est en français (règle 7). La confusion signalée portait sur le lien avec Interventions, réglée par les sous-titres des deux sections plutôt que par un renommage |
| 2026-09-03 | Spécialité à l'import (D44) | Choisie parmi des puces — les sept métiers intégrés **plus** ceux déjà utilisés sur ce bateau — avec « Autre » pour en nommer un nouveau ; plus de texte libre nu | Signalé à l'usage : « ne mets pas un texte libre mais un menu déroulant des spécialités avec la possibilité de créer une nouvelle catégorie ». Un champ libre invite les fautes de frappe, et chacune crée un métier de plus dans un annuaire censé en avoir peu. C'est le contrôle exact du formulaire de contact, alimenté par le **même** lecteur (`usedSpecialties`), donc les deux écrans ne peuvent pas proposer des listes différentes — et un métier nommé ici devient une puce pour le contact suivant |
| 2026-09-03 | Carte Stock quand le bateau n'a aucune pièce | **Affichée quand même**, « aucune pièce · Ajouter les pièces que vous gardez à bord » | La masquer à zéro revenait à cacher la porte d'entrée : signalé à l'usage, « dans checklist il n'y a toujours pas pièces détachées » — sur un bateau qui n'a encore rien saisi, c'est-à-dire exactement celui qui en a le plus besoin. Une carte vide n'est pas du vide : c'est le chemin |
| 2026-09-03 | Fil d'Ariane du tableau de bord | **Aucun** | Un « Tableau de bord » seul, qui nomme l'écran qu'on regarde, ne dit rien que l'onglet allumé n'ait déjà dit — et il poussait le bandeau sombre sous une ligne de gris, ce qui se voyait : « c'est pas très beau, pas très design ». Le bandeau redéborde donc vers le haut comme avant, et plus rien ne se cache derrière puisqu'il n'y a plus rien au-dessus. Le nom du bateau, dans ce bandeau, est le titre |
| 2026-09-03 | Changer son mot de passe (D45) | Une carte **Mot de passe** dans le profil, qui l'écrit directement — aucun e-mail | Signalé à l'usage : « mot de passe oublié ne fonctionne pas ». Les journaux Auth disent `/recover` → **200** et, quatorze secondes plus tôt, `/otp` → **429 email rate limit exceeded** : le code et l'URL de redirection sont bons, c'est la boîte d'envoi du projet qui est pleine (SMTP intégré Supabase, quelques messages par heure, réservé au développement). Quelqu'un déjà connecté n'a jamais eu besoin de ce détour : il est authentifié, donc le mot de passe s'écrit sur-le-champ. Cela ne remplace pas le SMTP personnalisé, qui reste à configurer côté tableau de bord, mais cela rend le changement possible sans lui |
| 2026-09-03 | Réponse de « mot de passe oublié » | Toujours « lien envoyé », **sauf** quota horaire dépassé, qui est dit | Savoir si une adresse a un compte ici ne nous appartient pas : la réponse reste identique dans tous les cas. Le quota, lui, appartient à l'application et non à l'adresse — le dire ne divulgue rien, et se taire laissait quelqu'un attendre un message qui n'allait jamais partir |
| 2026-09-03 | Pages exclues du precache du service worker | `/dev/ui/**` et `/` ne sont plus précachés (`globIgnores` dans `serwist.config.mts`) | Signalé à l'usage : « le PWA fonctionne sur mac mais pas sur mobile ». Serwist précache **toutes** les pages prérendues, et une seule qu'il n'arrive pas à charger annule l'installation entière (`bad-precaching-response`). Les maquettes `/dev/ui/**` sont prérendues mais répondent 404 en production (`devUiEnabled()`) : en production le service worker restait donc bloqué en « installing » pour toujours, rien n'était jamais mis en cache, et **chaque** chargement de page relançait les 5,8 Mo de precache — invisible en Wi-Fi sur Mac, ruineux en 4G au ponton. `/` est exclu pour une autre raison : c'est la page d'accueil publique, et le proxy y redirige un visiteur connecté vers `/boats` ; précachée, elle était servie depuis le cache et l'app installée s'ouvrait sur la page marketing au lieu du bateau |
| 2026-09-03 | `apple-mobile-web-app-capable` | Rajouté à la main dans `metadata.other` | Next.js 16 n'émet plus que `mobile-web-app-capable`, que iOS ignore. Safari lit d'abord le manifest, mais retombe sur cette balise quand il n'y arrive pas — et sans elle « Sur l'écran d'accueil » ne donne qu'un signet qui rouvre Safari avec sa barre d'adresse, au lieu de l'application. Une balise, aucun risque : les deux coexistent |
| 2026-09-03 | Type d'enregistrement du service worker | `classic` explicite (`options={{ type: "classic" }}` sur `SerwistProvider`) | `SerwistProvider` enregistre en module ES par défaut, alors que `serwist build` produit un `public/sw.js` classique : aucun `import`, et un chemin de code de Serwist appelle `self.importScripts()`, interdit dans un worker module. Les Safari anciens ignorent l'option et exécutent quand même le fichier, donc ce n'est pas la panne constatée ; c'est déclarer ce que le fichier est réellement, pour ne pas dépendre de cette tolérance |
| 2026-09-03 | Filtres de Dépenses (D46) | **Repliés**, avec la ligne des filtres actifs sur l'en-tête | Quatre groupes de puces empilés font environ 600 px : ouvrir Dépenses sur un téléphone montrait des filtres et pas un euro. L'en-tête dit ce qui est retenu, donc le pli ne cache jamais un filtre actif — et l'argent est la première chose à l'écran, ce que la page est censée montrer |
| 2026-09-03 | Plancher mobile | **320 px** vérifié en CI, en plus de 360 et 390 | L'app n'avait jamais été mesurée sous 390. C'est à 320 qu'un bloc incapable de rétrécir se révèle : trois débordements du document entier n'existaient qu'à cette largeur, et iOS Safari y répond en dézoomant toute la page |
| 2026-09-03 | Onglet « Interventions » dans la barre du bas | Libellé **conservé** ; seule la largeur est corrigée (`min-w-0`) | L'audit proposait de revenir à « Journal », plus court, pour tenir à 320 px. C'est le renommage que Joseph a demandé ce matin : la largeur se règle en laissant l'onglet rétrécir, pas en défaisant une décision produit |
| 2026-09-03 | Tableaux d'import et de reprise sur téléphone | Les cellules se replient sous `sm`, les largeurs minimales ne s'appliquent qu'à partir de `sm`, et **une ligne dit que le tableau se fait glisser** | Sept colonnes ne tiennent pas dans 328 px en restant un tableau : la prévisualisation mesurait 1 200 px, soit cinq écrans à traverser pour lire une ligne. Le repli ramène deux tableaux sur trois sous 570 px ; le troisième défile toujours, et un tableau qui défile sans le dire se lit comme un tableau à trois colonnes. Le passage en fiches empilées sur téléphone reste ouvert : c'est mieux, mais c'est une réécriture des deux écrans, et importer un tableur depuis un téléphone n'est pas le geste courant |

## 2026-09-03 — D46 : la catégorie d'un point de checklist s'affiche en chips, jamais repliée

**Question.** Sur le formulaire d'un point de checklist, le champ « Catégorie » affichait la
catégorie courante suivie d'un lien « changer ». Ouvert depuis la racine de la checklist, aucune
catégorie n'est présélectionnée : le champ se réduisait alors au seul mot « changer » sous son
libellé, sans dire ce qu'il change ni qu'un choix est obligatoire.

**Décision.** Les chips sont affichées d'emblée, l'état replié est supprimé. La règle 13 de
`CLAUDE.md` dit déjà « catégories = chips » ; huit chips tiennent en deux lignes, il n'y avait
rien à gagner à les replier. La clé `checklist.form.change` disparaît.

## 2026-09-03 — D47 : l'unité d'un champ numérique est une boîte de la ligne, pas un calque

**Question.** `Input` posait son suffixe en `absolute` et réservait `pr-10`, soit 40 px. Cela
suffit pour « h » ou « € », pas pour « h moteur » (62 px) ni « mois » : la valeur, alignée à
droite, se dessinait par-dessus son unité — le formulaire de checklist affichait « h200teur »
pour deux cents heures moteur.

**Décision.** Le champ et son unité sont deux boîtes d'une même ligne flex, la bordure et
l'anneau de focus passant sur le conteneur. La réservation devient exacte pour n'importe quelle
unité, dans n'importe quelle langue.

## 2026-09-03 — D48 : l'audit tactile mesure les boîtes, pas `document.scrollWidth`

**Question.** `globals.css` pose `overflow-x: clip` sur `html` et `body` pour qu'une boîte trop
large ne fasse pas glisser la page entière. Effet de bord : `document.scrollWidth` ne dépasse
plus jamais la fenêtre, donc la seule assertion de débordement de l'audit était vide depuis ce
commit. Elle passait sur une carte qui sortait de 129 px d'un écran de 320.

**Décision.** L'audit parcourt les boîtes et signale celles dont le bord droit dépasse la
fenêtre, en ignorant celles contenues dans un conteneur qui défile ou rogne à l'intérieur de
l'écran (les tableaux de l'import, de la relecture et du rapport défilent volontairement).
Trois débordements réels ont été trouvés et corrigés : la page d'accueil, le sélecteur de
bateau et les cartes de membres.

## 2026-09-03 — D49 : dates lointaines — molette native seule, sans puces

**Question.** La règle 13 impose « dates = puces + roulette native » (`DateField`). Quatre
champs utilisent encore un `<input type="date">` nu : date de pose d'un moteur ou d'un
équipement, « valide jusqu'au » d'une réalisation, « dernière réalisation connue » d'un point.

**Décision.** Ils restent nus. Les puces de `DateField` sont « Aujourd'hui » et « Hier » : pour
une date d'installation vieille de plusieurs années ou une échéance future, elles sont au mieux
inutiles, au pire des valeurs invalides (« valide jusqu'au » exige une date postérieure à la
réalisation). La règle vise le cas courant — « quand l'as-tu fait » — et il est respecté. Les
deux cellules de date de la table de relecture restent nues pour la même raison de place.

## 2026-09-03 — D50 : `beforeinstallprompt` est capturé avant l'hydratation

**Question.** « Le PWA ne fonctionne plus sur mac et sur mobile, ça ne télécharge rien, ça dit
juste : dans le menu du navigateur… mais il ne s'est rien passé. »

Chrome n'émet `beforeinstallprompt` qu'une fois, peu après le chargement, et jamais de nouveau
pour ce chargement de page. L'écouteur vivait dans `useInstallPrompt`, monté par `AccountMenu` —
un composant client qui n'existe qu'à l'intérieur d'un bateau, et qui monte après l'hydratation.
Sur la page d'accueil, personne n'écoutait ; ailleurs, l'événement arrivait presque toujours
avant l'écouteur. Il était perdu, le dialogue tombait sur son texte de repli, et le bouton
« Installer » n'apparaissait jamais. Le service worker de production est sain (122 entrées
préchargées, un gestionnaire `fetch`, aucune maquette `/dev/ui`) : ce n'était pas lui.

**Décision.** Un script inline dans le `<head>` du layout racine écoute dès l'analyse du HTML,
gare l'événement sur `window` et l'annonce ; le hook le relit au montage et à l'annonce.
`install()` efface aussi la copie garée, l'événement étant à usage unique.
`tests/e2e/install-prompt.spec.ts` déclenche l'événement avant l'hydratation et vérifie que le
bouton revient — il échoue si l'on retire le script.

Le texte de repli disait « dans le menu du navigateur », ce qui ne mène nulle part sur un Chrome
de bureau. Il nomme maintenant l'icône d'installation de la barre d'adresse, et ajoute la raison
la plus fréquente d'un refus silencieux du navigateur : **l'application est déjà installée**.

## 2026-09-03 — D51 : les dialogues entrent dans l'audit, un à la fois

**Question.** Un dialogue est fermé au chargement. L'audit tactile ouvre une URL et mesure ce
qu'il trouve : il n'avait donc jamais vu l'intérieur d'un seul — alors que ce sont les surfaces
les plus denses de l'application (une date, un compteur, un sélecteur et une note dans une
boîte qui doit tenir au-dessus du clavier d'un téléphone), « Marquer comme fait » en tête.

**Décision.** `/dev/ui/dialogs?d=…` en ouvre exactement un — plusieurs empilés se recouvriraient
et fausseraient la mesure. Cinq entrées dans l'audit (`complete`, `hours`, `edit-reading`,
`contact`, `recurring`) plus `/dev/ui/supplies?dialog=1` pour la bouteille de gaz, dont la
couture `defaultOpen` existait déjà sans que l'audit s'en serve.

Vérifié en plus des règles : à 320 × 568, les cinq dialogues tiennent dans l'écran et leur
bouton « Enregistrer » est atteignable. Un dialogue plus haut que l'écran dont on ne peut pas
atteindre le bouton est inutilisable, et aucune des règles de l'audit ne l'aurait dit.

**Restent sans preview**, et c'est assumé : `/invite/[token]` (une alerte et un bouton) et la
fiche d'un prestataire (`PageHeader`, `SectionCard`, `ListRow`) — leurs primitives sont toutes
auditées ailleurs, seule la composition ne l'est pas, et elle est en lecture seule.

## 2026-09-03 — D52 : on choisit un prestataire dans le carnet d'adresses du téléphone

**Question.** « On doit changer des contacts en vcf au lieu de les choisir dans nos contacts, fin
allô on est sur tél. » Exporter une vCard depuis Contacts, la retrouver dans Fichiers, puis la
sélectionner : cinq gestes pour un numéro.

**Décision.** Un bouton « Choisir dans mes contacts » ouvre le carnet d'adresses via la Contact
Picker API. Les fiches choisies produisent **exactement** la table qu'un `.vcf` produit
(`CONTACT_HEADERS`), donc elles passent par le mapping, la détection de doublons et l'aperçu
existants : aucun second chemin d'écriture.

Le bouton est **absent** — pas désactivé — là où le navigateur n'expose pas le carnet. C'est le
cas de la plupart des iPhone : Safari garde la Contact Picker derrière un drapeau
(`Réglages › Safari › Avancé › Feature Flags`). Il n'existe aucune API web de repli sur iOS, et
un bouton qui ne peut pas fonctionner coûte un geste pour rien. Chrome sur Android l'a par
défaut : Emmanuel l'aura.

Le mappage est couvert par `tests/unit/import-phone-contacts.test.ts` — le navigateur rend des
listes qui peuvent être vides, contenir des chaînes vides ou autre chose que des chaînes, et
c'est du code qu'aucune CI ne peut piloter sur un vrai téléphone.

## 2026-09-03 — D53 : un fil d'Ariane d'un seul élément n'est pas un fil d'Ariane

**Question.** Sur la checklist, le fil affichait « Checklist » au-dessus d'un titre « Checklist »
pendant que l'onglet Checklist était allumé en bas. Trois fois le même mot, et sur téléphone une
ligne entière d'un écran qui en a peu.

**Décision.** `buildTrail` rend `[]` dès qu'il n'y a qu'un élément. Le tableau de bord était déjà
exempté pour cette raison ; la règle devient générale. Un fil gagne sa ligne à partir du moment
où il mène quelque part — c'est-à-dire à partir de deux éléments.

## 2026-09-03 — D54 : le téléphone n'est pas un iPad étroit — densité mesurée, pas ressentie

**Question.** « C'est toujours pas la folie le mobile responsive. Trop gros trop zoomé, bloc pas
simple à utiliser, pas instinctif. Tu es très très loin du compte. »

Les audits précédents vérifiaient deux choses : est-ce que ça déborde, et les cibles font-elles
44 px. Les deux passaient — pendant que l'écran montrait deux éléments. **La densité n'était
mesurée par rien.** Mesures à 390 × 844 :

| Écran | Chrome avant la 1re donnée | Éléments visibles |
|---|---|---|
| Tableau de bord | 819 px sur 844 | **0** sur 6 |
| Interventions | 526 px | 1 sur 6 |
| Bateau | 403 px (48 % de l'écran) | 6 en-têtes, **0 équipement** |
| Checklist | 296 px, 175 px par tuile | 2 sur 9 |

**Décision.** Une règle unique, appliquée partout : *le téléphone montre les données, l'iPad
montre les données et leur explication.* En pratique :

1. **Le sous-titre d'un `PageHeader` est de la prose d'accueil** : `hidden sm:block` par défaut.
   Écrit pour qui découvre l'écran, payé à chaque visite pendant des années. Échappatoire
   `subtitleClassName` pour les sous-titres qui portent une donnée vivante — « 12 résultats » est
   un retour, pas de l'accueil.
2. **Une carte par élément est juste pour trois éléments, pas pour neuf.** La grille de la
   checklist devient une liste bordée sur téléphone, la grille revient à partir de `sm`. Le
   pourcentage rejoint la ligne de compte, puisque la barre n'est pas dessinée là : la
   progression est le sujet de l'écran, elle ne peut pas être ce qu'on supprime.
3. **Une ligne de liste tient sur deux lignes**, pas trois : la valeur rejoint le titre, le badge
   rejoint les métadonnées. Rien n'est retiré.
4. **Un bloc de filtres ne prend pas trois lignes** : une seule ligne qui défile sur téléphone.
5. ~~**« Importer » n'est pas une action de téléphone**~~ — **annulé, voir ci-dessous.**
6. **Une barre d'outils qui précède les données peut les suivre** : `order-last sm:order-none`.
7. **Le rythme vertical est celui de l'écran** : `gap-6` → `gap-4 sm:gap-6`, `pt-6` → `pt-3 sm:pt-6`.

**Contrainte tenue sur chaque point** : l'iPad, portrait et paysage, reste identique — mesuré
avant/après, pas supposé. Les cibles restent à 44 px ; la densité ne vient jamais d'un bouton
rétréci.

**Rejeté.** Passer le `<h1>` en `sr-only` sur téléphone (le gain mesuré était nul et on perd
l'orientation) ; et rendre le bouton d'action primaire au `PrimaryActionSheet` sur les
interventions — cela révise D35 et touche l'iPad portrait, donc cela se demande, cela ne se
décide pas ici.

**Annulé après signalement** : cacher « Importer » sur téléphone. « Ducoup sur mobile on a perdu
le bouton pour importer un intervenant. » Deux raisons, et j'avais tort sur les deux :

- **Il n'existe aucune autre route.** Le diagnostic affirmait que l'import restait joignable
  depuis la feuille « Plus » ou le menu compte. Vérifié dans `nav.ts` : il n'y a **aucune** entrée
  d'import dans la navigation. Cacher le bouton ne le déplaçait pas, il supprimait l'import de
  toute une plateforme.
- **Sur les intervenants, l'écran d'import EST le chemin téléphone.** « Choisir dans mes
  contacts » (D52) vit derrière ce bouton. Le cacher sur téléphone cachait le carnet d'adresses —
  j'ai construit le geste le plus natif de l'app puis masqué sa seule porte.

Un gain de densité ne vaut jamais la suppression d'une fonction sur une plateforme entière. La
règle 5 tombe ; les six autres tiennent.

## 2026-09-03 — D55 : une instruction d'installation par navigateur

**Question.** « Le PWA ne fonctionne plus… ça ne download rien et c'est toujours le même texte. »
Le service worker n'y était pour rien : les navigations sont en `NetworkFirst` (vérifié dans le
`sw.js` de production), donc en ligne le réseau gagne et rien n'est servi périmé.

La vraie cause : le code n'avait que **deux** branches, « iOS » et « tout le reste », et donnait
à « tout le reste » les instructions de Chrome. Sur un Mac dans Safari cela nomme une entrée de
menu qui n'existe pas — et Safari n'émet jamais `beforeinstallprompt`, donc il n'y aura jamais de
bouton non plus.

**Décision.** `detectPlatform()` distingue iOS, macOS Safari, Chromium et Firefox, et chaque cas
a sa phrase : Partager → Sur l'écran d'accueil ; Partager → Ajouter au Dock ; l'icône de la barre
d'adresse (plus « l'application est peut-être déjà installée », raison la plus fréquente d'un
refus silencieux) ; et pour Firefox, qu'il n'installe pas d'application web. La fonction est pure
et testée contre de vraies chaînes d'user-agent (`tests/unit/pwa-platform.test.ts`) — deviner ces
chaînes est exactement ce qui a produit le défaut.

**Et un tampon de version.** `NEXT_PUBLIC_BUILD` (le commit) s'affiche dans le dialogue
d'installation. « C'est toujours le même texte » était indécidable sans lui : ni lui ni moi ne
pouvions distinguer un déploiement pas encore arrivé d'un correctif qui ne marche pas — et nous
nous sommes trompés chacun une fois dans la journée.

## 2026-09-03 — D56 : pas de conteneur à défilement horizontal dans l'en-tête sombre

**Question.** Les puces moteur mesuraient 217-239 px chacune dans une boîte de 358 px : trois
moteurs prenaient trois lignes de 44 px, soit 148 px de l'en-tête d'un écran dont le premier
viewport était déjà entièrement du chrome. La correction évidente était une ligne unique qui
défile.

**Décision.** Non. Un `overflow-x: auto` posé là fait sur-déclarer `documentElement.scrollWidth`
de 64 px — un débordement que le `overflow-x: clip` de la racine masque à l'œil mais que l'audit
signale, à juste titre : une mise en page dont on ne peut pas dire si elle déborde est une mise en
page à éviter. Bisecté élément par élément avant de conclure ; ni la marge négative ni le
scroll-snap n'en étaient la cause, le conteneur lui-même l'était.

Ce qui est fait à la place est plus simple **et** meilleur : la date du relevé quitte la puce sur
téléphone. C'est elle qui faisait la largeur, elle est sur la fiche du moteur à un tap, et la
couleur ambre continue de dire « ce relevé est vieux » sans elle. Trois moteurs tiennent alors
sans rien qui défile.

**Note de méthode.** J'ai d'abord « prouvé » que la page défilait en appelant `window.scrollTo`
et en lisant `scrollX`. C'est faux : `overflow: hidden` et `clip` empêchent l'utilisateur de
défiler, pas un défilement programmatique. La bonne preuve est la mesure des boîtes.

## 2026-09-03 — D57 : « Choisir dans mes contacts » n'existera pas sur ordinateur

**Question.** « Il peut aussi être sur la version PC, on a les contacts là aussi. »

**Décision.** Impossible, et il vaut mieux le dire que le simuler. La Contact Picker API n'est
exposée que par Chrome sur **Android** (et par Safari iOS derrière un drapeau) : ni Chrome
Windows, ni Chrome macOS, ni Safari macOS, ni Firefox ne l'implémentent — il n'y a pas
d'intégration au carnet d'adresses du système sur ordinateur. Le bouton est déjà absent par
détection de fonctionnalité, ce qui reste le bon comportement.

Ce qui marche réellement sur ordinateur, et que le texte d'aide nomme maintenant : le `.vcf`.
Sur Mac comme sur PC on glisse une fiche depuis Contacts directement dans le sélecteur de
fichier, ou on en sélectionne plusieurs et on exporte la vCard — l'import lit déjà les fiches
multiples.

## 2026-09-03 — D58 : l'audit mesure enfin la densité, et pas seulement le débordement

**Question.** « Tu as tout tout tout couvert là ? » Non — et le trou n'était pas une liste
d'écrans manquants, c'était l'absence de mesure. L'audit vérifiait le débordement horizontal et
les cibles de 44 px. Les deux passaient, sur les cinq viewports, pendant que la checklist rendait
**une carte de 175 px par système** : neuf systèmes remplissaient 1 600 px, deux tenaient à
l'écran, et « trop gros trop zoomé, bloc pas simple à utiliser » a été signalé depuis le bateau
avec un audit vert derrière. La prochaine régression serait passée de la même façon.

**Décision.** Une règle, qui encode exactement la classe de défaut survenue :

> Sur un téléphone (< 640 px), une **ligne tappable répétée** — trois frères ou plus construits
> du même balisage — ne dépasse pas **120 px** de haut.

120 px vient de ce que l'application produit réellement : une ligne de liste fait 64 ou 76 px,
une fiche prestataire 64, les quatre tuiles du tableau de bord environ 110 — et la carte qui a
provoqué la plainte en faisait 175. Le seuil discrimine là où il faut. Restreint aux liens et aux
boutons, donc un accordéon déplié ou une section de formulaire n'est pas concerné ; et aux
largeurs de téléphone, puisque au-dessus de `sm` il y a la place pour des cartes.

**Vérifiée dans les deux sens** : j'ai remis la carte de 175 px, l'audit échoue en la nommant
(« repeated rows over 120px: … height 185, repeated 9 ») ; je la retire, il passe. Ce n'est pas
une supposition, et une règle qu'on n'a pas vue échouer ne vaut rien.

Les six écrans jamais mesurés — achats, sorties d'eau, corbeille, équipage, import, paramètres —
passent la règle, et leurs lignes mesurent 76 à 107 px. Ils n'avaient pas le défaut.

## 2026-09-03 — D59 : le sélecteur de contacts est sur le formulaire, pas dans l'import

**Question.** « Choisir dans mes contacts, je ne le vois toujours pas, il doit remplacer importer
sur mobile je pense. »

**Décision.** L'emplacement était mauvais, l'instinct était bon. Il vivait dans l'assistant
d'import — or importer est un geste de tableur, et sortir une fiche de son carnet d'adresses est
ce qu'on fait *en remplissant le formulaire*. Il est désormais sur le formulaire d'un nouvel
intervenant, à un tap de « Nouvel intervenant », et il **remplit les champs** au lieu d'écrire :
on voit ce qui est arrivé, on corrige la spécialité, on enregistre. Pas sur l'édition d'un
intervenant existant, où il écraserait ce qui est déjà juste.

**Mais il ne remplace pas « Importer »**, contrairement à la suggestion : sur la plupart des
iPhone il est absent (Safari garde l'API derrière un drapeau, et il n'existe aucun repli web),
donc le remplacement aurait supprimé l'import sur exactement ces appareils — l'erreur déjà
commise et annulée plus haut.

`tests/e2e/contact-picker.spec.ts` vérifie les deux faces, et l'absence compte plus que la
présence : le bouton ne doit **pas** exister quand le navigateur n'a pas de carnet à ouvrir.

## 2026-09-03 — D60 : une fonction indisponible se dit, elle ne se tait pas

**Question.** « Je ne vois pas le sélecteur de contacts » — trois fois, alors qu'il était déployé
et que le code faisait exactement ce qui était décidé : disparaître là où le navigateur n'expose
pas de carnet d'adresses (D57), ce qui est le cas de la plupart des iPhone.

**Décision.** Le raisonnement « un bouton qui ne peut pas fonctionner coûte un geste pour rien »
était juste, la conclusion « donc on ne montre rien » était fausse. **Vu de l'extérieur, « ton
navigateur ne le propose pas » et « ce n'est pas encore déployé » sont indiscernables** — d'où
la question posée trois fois, et à raison.

Là où le sélecteur est impossible, une légende prend sa place : elle nomme la raison, le réglage
qui l'active sur iPhone (`Réglages › Safari › Avancé › Feature Flags › Contact Picker API`) et
le chemin qui marche de toute façon (une fiche `.vcf`). Une légende ne se tape pas, donc
l'objection au bouton mort ne s'y applique pas.

Règle générale qui en sort : **le silence n'est pas une réponse acceptable pour une capacité
absente.** Si l'application ne peut pas faire quelque chose sur cet appareil, elle le dit à
l'endroit où on la cherche.
## 2026-09-03 — Rafraîchissement visuel (moins « vibe-code », plus premium)

Passe de direction artistique sur l'app existante, sans toucher au fonctionnel ni au responsive
(une session parallèle traite le mobile). Le socle de tokens et de contrastes mesurés est
conservé ; seules la finition et l'identité changent.

| Date | Question | Décision | Raison |
|---|---|---|---|
| 2026-09-03 | Polices (révision du 2026-09-02) | **Manrope** pour toute l'UI et les chiffres, **Fraunces** pour la couche d'affichage (titres `text-h1`, nom du bateau, états vides, connexion, rapport) ; les deux auto-hébergées par `next/font` (aucune dépendance Google au runtime, PWA hors-ligne intacte) | La pile système était le principal signal « outil généré » ; une vraie typographie (grotesque de précision + serif éditorial pour la marque) transforme la perception sans coût réseau. Les chiffres (`text-display`) restent en sans : jamais de serif sur une donnée |
| 2026-09-03 | Fond | Papier chaud (`--background #f6f5f1`, `--surface-2` réchauffé) sous des cartes blanches, au lieu du gris froid | Évoque le carnet / la carte marine ; se distingue du gris Tailwind par défaut, la carte blanche ressort en instrument |
| 2026-09-03 | Anneau de focus | Azur marin (`--ring #1b5e96`) au lieu du bleu framework `#1d4ed8` | Le bleu par défaut est un marqueur « non designé » ; l'azur appartient à la palette |
| 2026-09-03 | Badges de statut/état (révision de la règle DA « le plein = action requise ») | **Un seul langage teinté** : tous les badges (y compris En retard, Bientôt, Urgent) passent en teinte + `-fg` + liseré + icône, plus aucun aplat rouge/orange | Le mur d'aplats lisait « tableau de bord en alarme » ; la teinte garde l'instrument calme et reste lisible au soleil (contrastes `-fg`/`-border` mesurés), l'icône et le libellé portent le sens sans la couleur seule. Idem pour les pastilles de comptage (`Badge variant="danger"` ajouté) |
| 2026-09-03 | Signature d'en-tête | Filet laiton (`brass-rule`) au bas de tout bandeau navy + dégradé multi-arrêt plus profond | Le « trait doré » d'une couverture de carnet ; détail de marque discret, jamais une alerte (respecte « le laiton ne porte jamais de donnée ») |

## 2026-09-03 — D61 : la légende nomme les voies qui marchent, pas un drapeau expérimental

**Question.** « Je suis sûr que c'est faux, il y a plein de solutions pour importer des contacts
directement. » La légende de D60 conseillait `Réglages › Safari › Avancé › Feature Flags ›
Contact Picker API`.

**Vérifié.** Le fait technique de D52/D57 tient : `navigator.contacts.select()` n'existe que sur
Chromium/Android et sur Safari iOS derrière un drapeau expérimental ; aucune API web (Contact
Picker **ni** Web Share Target) ne lit le carnet d'adresses depuis Safari iOS standard. Il n'y a
donc pas d'API manquée. Mais **le conseil de D60 était faible** : nommer un drapeau WebKit
expérimental (instable, qui saute entre versions d'iOS) à un propriétaire non technique, c'est du
théâtre — personne ne l'activera, et ce n'était pas la vraie réponse à son besoin.

**Décision.** La légende ne pointe plus vers le drapeau. Elle nomme les voies **réellement**
universelles, qui existent déjà : saisir le prestataire à la main sur le formulaire, ou importer
sa fiche `.vcf` / la liste depuis un tableur. « Ne jamais retaper un prestataire » n'a jamais eu
besoin du carnet natif ; c'était un problème de visibilité, pas de capacité manquante.

`tests/e2e/contact-picker.spec.ts` vérifie désormais aussi que la légende **ne** renvoie **pas**
vers « Feature Flags » — c'est l'assertion qui manquait.

## 2026-09-03 — D62 : l'équipement rejoint la corbeille (supprimer ≠ déposer)

**Question.** « On ne peut supprimer aucun équipement. » Un équipement créé par erreur (un
« Test ») restait à l'inventaire sans issue : la fiche n'offrait que « Déposer » — poser
`removed_at`, qui sort la pièce du bateau mais garde sa fiche pour l'historique. Aucune façon
d'annuler une création.

**Constat.** La corbeille de D40/D41 couvrait tout ce que l'application peut retirer —
interventions, achats, sorties de l'eau, pièces de stock, intervenants, documents — et laissait
délibérément l'équipement de côté, au motif qu'un équipement s'archive (se dépose), il ne se
supprime pas. C'est vrai d'une pièce réelle ; ça n'offre aucune sortie pour une faute de frappe.
Les pièces détachées avaient fait exactement ce pas en 0012.

**Décision.** L'équipement reçoit le même traitement (migration `0014_equipment_trash.sql`), et
garde « Déposer » à côté pour le cas réel. Deux colonnes, deux sens :

- `removed_at` (« Déposé le ») = la pièce quitte physiquement le bateau, sa fiche et son
  historique restent à l'inventaire, on pourra la remettre à bord.
- `deleted_at` (la corbeille) = suppression d'une création erronée, 30 jours puis purge
  définitive (`purge_trash`), restaurable entre-temps.

Une pièce peut être déposée puis, plus tard, supprimée : les deux dates ne se recouvrent pas.

La fiche gagne un bouton « Mettre à la corbeille » (fantôme, `Trash2Icon`) à côté de
« Modifier » et « Déposer / Remettre à bord », avec confirmation et `undoToast` — le même geste
que pour une intervention (`LogActions`). `maintenance_logs.equipment_id` étant en
`on delete set null`, purger un équipement coupe le lien mais laisse l'historique intact.

`tests/unit/rls.test.ts` couvre l'équipement supprimé comme les pièces : qui peut le mettre à la
corbeille et le restaurer, sa lisibilité par tout membre, la purge à 30 jours, et l'historique
préservé après purge.

## 2026-09-03 — D63 : checklist « À racheter » — agir sur place, la note EST la pièce

**Question.** Xav, sur la première version : « bien mais pas dingue. Je voudrais pouvoir cliquer
depuis Checklist pour rajouter du stock ou me noter de racheter — là je suis juste redirigé vers
Équipements de la page Bateau. Réfléchis bien pour qu'il n'y ait pas de double saisie. »

**Contexte.** La checklist « À racheter » (pièces au seuil ou en dessous : `isLowStock`,
`min_quantity > 0` et `quantity <= min_quantity`) est une **vue du stock**, pas une table :
elle se remplit et se vide seule selon les mêmes lignes `parts` qu'écrivent la fiche, les +/− et
l'import. La première version cochait « racheté » (quantité à `min + 1`) et la ligne renvoyait
vers Bateau au tap. Le geste manquait de deux choses : ajuster la vraie quantité, et noter une
pièce à racheter sans quitter la checklist. *(Cette décision remplace la première note de la
fonctionnalité, dont le numéro D61 a été repris par une autre branche fusionnée en parallèle ;
elle est désormais la référence unique. Aucune migration : tout reste dérivé du stock.)*

**Décision.**

1. **Action sur la ligne, pas de navigation.** Chaque ligne « À racheter » porte des **+/−** qui
   ajoutent ou retirent du stock sur place (le RPC atomique `adjust_part_quantity`, D10) ; une
   pièce qui repasse au-dessus de son seuil quitte la liste d'elle-même. Le corps de la ligne ne
   navigue plus — il ne faisait que renvoyer vers Bateau, ce qui était le reproche. La fiche
   complète (seuil, emplacement, fournisseur) reste éditable depuis le stock sous Bateau.

2. **« Noter une pièce à racheter » = créer la pièce.** Un bouton ouvre un dialogue à un seul
   champ (la désignation) ; la pièce entre au stock avec **0 en réserve et un seuil de 1**, donc
   elle apparaît aussitôt dans « À racheter » **et** dans le stock. La note *est* la ligne de
   stock : il n'y a pas de seconde liste de courses à tenir (JAMAIS de double saisie). Le reste
   de la fiche se complète plus tard depuis Bateau. Le bouton est présent même quand rien n'est
   sous le seuil, pour que « se noter de racheter » soit toujours à portée depuis la checklist,
   sans redirection.

3. **Réservé au rôle `write`** (owner/editor), comme les +/− du stock (RPC gardé par
   `can_write_boat`) ; un lecteur voit la liste et « Voir le stock ».

La case à cocher « racheté » de la première version et son action serveur `restockPart` sont
retirées : les +/− couvrent le même besoin plus précisément (on saisit la quantité réellement
rachetée), et une pièce qui franchit son seuil disparaît de la liste comme avant.


## 2026-09-03 — D64 : un compte sans bateau ajoute le sien (renversement du 2026-09-02)

> **Scindée par D65 (2026-09-04)** : l'inscription ne demande plus le modèle de checklist, seulement l'identité du bateau. Ce qui suit reste vrai de l'ouverture du carnet, pas du choix du plan.

**Question.** « Quand je crée un compte sans avoir été invité, évidemment que je dois ajouter mon
bateau. » Quelqu'un qui s'inscrivait sans invitation atterrissait sur `/boats`, lisait « Vous
n'avez pas encore de bateau. Demandez une invitation au propriétaire du bateau » et n'avait aucun
geste possible. Ni bouton, ni route, ni Server Action : la création d'un bateau n'existait nulle
part dans `src/`.

**Constat.** Ce n'était pas un oubli, c'était **la décision du 2026-09-02** (« Inscription
publique : pas de création libre de bateau en V1 ; l'admin plateforme crée les bateaux et
invite », `SPEC.md §4.3`, `boats_insert with check (is_platform_admin())`). Elle était juste
quand il y avait un bateau et un propriétaire, et que le seul risque était d'ouvrir une surface
d'abus pour rien. Elle est devenue le premier mur de l'application.

Deux garde-fous justifiaient cette décision, et ils sont réels — ce sont eux qu'il fallait garder
en ouvrant la porte :

1. **« Un bateau a toujours au moins un owner »** (`DATA-MODEL.md §3.5`). L'ouvrir naïvement était
   d'ailleurs impossible : `boat_members_insert` exige `is_boat_owner(boat_id)`, donc après un
   simple `insert into boats` le créateur ne pouvait pas s'inscrire lui-même. Il aurait obtenu un
   bateau invisible (`boats_select` = `is_boat_member(id)`) que personne n'aurait pu rattraper.
2. **« Ne pas faire : création libre de bateaux sans modèle »** (`AUDIT.md §2`). Le produit promet
   un bateau *déjà rempli* ; un carnet vide est exactement le coût d'amorçage qui tue ces
   applications (`AUDIT.md §0.2`).

**Décision.** La table `boats` **reste fermée** en insertion. La création passe par une seule
fonction `security definer`, `create_boat(p_boat_id, p_name, p_template_id, p_engines)`
(`0015_boat_onboarding.sql`), qui écrit le bateau, la ligne `boat_members` en `owner`, les moteurs
et la checklist **dans la même transaction**. Les deux garde-fous deviennent donc des invariants
de base et non des règles d'écran : un bateau ne peut littéralement pas naître sans owner, ni sans
modèle (`p_template_id` est obligatoire et doit être `is_public`). Le plafond de 20 bateaux
possédés remplace la protection anti-abus que « seul l'admin crée » offrait gratuitement.

**Conséquence : les modèles génériques passent de « reporté » à bloquant.** Rendre le modèle
obligatoire ne tient que s'il y en a toujours un à choisir. Or il n'en existait qu'un —
« ORC 50 — Marsaudon Composites » — chargé par `pnpm seed:xaman`, qui porte les données de Xaman
et ne tourne jamais en production : **le registre y était vide**. `0016_generic_templates.sql`
livre donc les trois modèles que `AUDIT.md §3.4` avait reportés (catamaran, monocoque, moteur :
7 à 8 systèmes, 64 à 70 points, actions pas à pas sur la douzaine de gestes où les étapes sont
l'essentiel). Ils sont générés depuis `seed/generic-checklists.json` par
`scripts/gen-template-migration.mjs`, et `tests/unit/template-migration.test.ts` échoue si les
deux divergent.

**L'écran : trois réponses, pas un formulaire.** `/boats/new` demande un nom, un modèle et le
nombre de moteurs — et rien d'autre :

- **Pas de champ « type de bateau », pas de champ « constructeur ».** Le modèle les porte déjà ;
  `create_boat` les recopie. Poser une question dont la réponse est connue est précisément l'étape
  qui fait abandonner un onboarding. L'identité reste modifiable sur l'écran Bateau — un trimaran
  qui prend le modèle catamaran est enregistré `catamaran` et se corrige en un tap.
- **Le nombre de moteurs est demandé ici, et nulle part ailleurs.**
  `apply_checklist_template` ne duplique un point `engine_scope <> 'none'` que pour les moteurs
  qui **existent déjà**, et ce sont eux qui portent tous les intervalles en heures. Un bateau créé
  sans ses moteurs ouvre sur une checklist sans « Vidange huile ». C'est une bascule pré-réglée
  par le modèle (multicoque → 2, sinon 1), donc zéro tap dans le cas courant.
- **Coût de l'acte : 3 taps** (choisir le modèle = 2, « Créer le carnet » = 1), la frappe du nom
  non comptée, comme dans `AUDIT.md §7.3`.

`/boats` sans bateau **redirige** vers cet écran au lieu d'afficher une salle d'attente ; l'écran
rappelle en une ligne qu'une invitation reçue par e-mail ajoute directement au bateau de
quelqu'un d'autre. Le sélecteur de bateaux et le menu compte portent « Ajouter un bateau » — seule
porte vers un deuxième carnet, puisque `/boats` redirige tant qu'il n'y en a qu'un.

**Ce qui n'a pas changé.** Aucune politique RLS n'est assouplie. `boats_insert` reste
`is_platform_admin()` et `tests/unit/rls.test.ts` continue de le vérifier ; ce qui est neuf, c'est
la porte à côté, avec ses propres refus (bateau d'autrui, modèle inexistant, nom vide, moteur
malformé, `anon`), tous couverts. L'assistant de mise en route (E4-9) reste le pas suivant : la
création pose les points et leur ancrage `current_date` (D1), le tableau de bord du jour 1 est
donc vide **et honnête**, et le bloc « carnet neuf » emmène vers le calage.

## 2026-09-04 — D65 : l'inscription demande le bateau, l'app demande le plan d'entretien

**Question.** « Je suis sur l'onboarding donc j'ai juste besoin des infos du bateau pour créer le
compte, l'entretien c'est après que ça intervient dans l'app. C'est 2 choses différentes. »

**Constat.** D64 posait une seule question qui en était deux. Le champ « Modèle » choisissait un
`checklist_template`, et le bateau en tirait son constructeur, son modèle **et son type de coque** :
déclarer ce qu'est le bateau et choisir son plan d'entretien étaient le même geste. Deux coûts :

1. **Quelqu'un dont le bateau n'a pas de plan publié devait le ranger sous « générique » dès
   l'inscription.** Un Neel 47 n'était pas un Neel 47, c'était « Catamaran — modèle générique ». Le
   trimaran enregistré en catamaran, signalé comme un défaut assumé dans la PR de D64, n'était pas
   un détail : c'était le symptôme.
2. **Les champs d'identité étaient plafonnés aux modèles que nous publions**, alors que l'identité
   est justement la partie qu'un grand annuaire externe pourrait un jour remplir. Un catalogue de
   8 000 modèles est juste pour « quel bateau », et ne dit rien de « quel entretien ».

**Décision.** Les deux questions sont séparées, et posées à deux moments.

- **`/boats/new` ne parle que du bateau** : nom, type de coque, constructeur et modèle en **texte
  libre** (avec suggestions), nombre de moteurs. Le mot « checklist » n'y apparaît pas.
- **Le plan d'entretien se choisit depuis la Checklist**, quand il veut dire quelque chose, avec
  les compteurs affichés (« 8 systèmes · 70 points d'entretien ») et le modèle générique de la
  coque pré-sélectionné.

**Ce que la création fait quand même : les systèmes.** `boat_categories` n'est pas du mobilier de
checklist. `checklist_items.category_id` est `not null on delete restrict` et la catégorie est
obligatoire à la saisie d'une intervention (`SPEC M3`) : un bateau sans catégorie a un Journal et
un écran Dépenses **inutilisables**. La création copie donc les huit systèmes du modèle générique
de la coque (`apply_template_categories`, `generic_template_for_boat_type`, migration `0017`) —
sans jamais montrer le mot « modèle ». C'est ce qui permet de tenir la demande (« l'inscription ne
demande que le bateau ») sans livrer un carnet cassé.

`boats.checklist_template_id` reste **null**, et ce null est le marqueur honnête que l'app lit
ensuite. Les catégories créées portent les mêmes `external_ref` que celles qu'`apply_checklist_
template` insère : un plan choisi plus tard les **relie** au lieu de les dupliquer, et un
renommage fait entre-temps survit (vérifié : 8 catégories, 78 points, « Propulsion » conservé).

**Texte libre plutôt que liste fermée.** Le constructeur et le modèle acceptent n'importe quoi.
Les suggestions viennent des seuls modèles publiés — le bateau d'un autre propriétaire est la
donnée d'un autre locataire, que la RLS masque de toute façon. Insensibles à la casse et aux
accents (« beneteau » trouve « Bénéteau », et le tap remet les accents), 5 au maximum, les modèles
restreints au constructeur déjà saisi. **Pas de `<datalist>`** : Safari iOS le rend partiellement
et il n'est pas stylable (D26) — des puces, comme les suggestions de titre du formulaire
d'intervention.

**Ce que ça ouvre.** Le champ « Modèle » étant devenu un champ d'identité, y brancher un annuaire
externe ne promettrait plus rien sur l'entretien — le piège identifié en étudiant la question
(8 000 entrées dont 4 ont un vrai plan) disparaît. Et le texte libre enregistre dès maintenant ce
que les gens déclarent posséder : la liste classée des modèles à écrire, avec la demande réelle
derrière.

**Coût de l'acte** : 1 tap (type de coque, si ce n'est pas un monocoque) + « Ouvrir le carnet ».
Le nombre de moteurs se règle seul depuis la coque. Le plan, plus tard, coûte 1 tap de plus.
