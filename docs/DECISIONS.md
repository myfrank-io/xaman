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
