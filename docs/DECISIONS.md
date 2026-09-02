# Xaman — Journal des décisions

Format : date · question · décision · raison. Claude Code ajoute une ligne à chaque choix produit non couvert par `SPEC.md`.

| Date | Question | Décision | Raison |
|---|---|---|---|
| 2026-09-02 | Stack | Next.js + Supabase + Vercel, PWA | iPad Safari en priorité, multi-tenant par RLS, MCP Supabase/Vercel déjà connectés, pas de serveur à maintenir |
| 2026-09-02 | Portée multi-acteurs V1 | Modèle multi-bateaux / organisations dès la V1, UI limitée à un bateau et 4 rôles (owner, editor, pro, viewer) | Éviter une refonte du schéma en V2 sans alourdir le MVP |
| 2026-09-02 | Offline | V1 = cache de lecture + écritures en ligne ; offline-first en V2 | Starlink à bord ; l'offline-first double la complexité (sync, conflits) |
| 2026-09-02 | Inscription publique | Pas de création libre de bateau en V1 ; l'admin plateforme crée les bateaux et invite | Un seul bateau au lancement, réduit la surface (onboarding, abus) |
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
