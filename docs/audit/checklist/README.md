# Checklist — audit et refonte E4-12

Audit du 21 septembre 2026 de la page Xaman en production, puis de son code.

| Constat | Effet | Correction |
|---|---|---|
| La racine ne montre que des cartes de systèmes | Aucun contrôle directement visible ou cochable | Liste de contrôles groupée par système dès l'arrivée |
| Le bloc de réapprovisionnement précède le suivi | L'action principale passe après le stock | Réapprovisionnement placé après les contrôles |
| Les pourcentages d'échéances peuvent être pris pour des contrôles réalisés | Un ancrage ne prouve pourtant pas une réalisation | Compteur de cases réellement réalisées et OK, sans intervention ouverte |
| Aucun filtre ou recherche sur l'ensemble des points | Il faut ouvrir chaque système pour retrouver un point | Recherche insensible aux accents, filtres d'état et de système combinables |
| Les détails d'une réalisation demandent l'ouverture d'un système | Lecture lente des derniers contrôles | Date, auteur, intervalle, échéance et prestataire prévu sur les lignes |

La case ouvre le dialogue existant. Enregistrer utilise la Server Action existante : date,
auteur, heures exigées et historique restent appliqués. Une case déjà à jour n'efface pas
l'historique. Le libellé mène au détail existant (étapes, historique, édition, nouvelle réalisation).
Le compteur de la nouvelle liste est explicitement distinct de la progression SQL par échéances
(qui conserve sa sémantique pour les autres écrans). Voir D148.

## Vérification

- Galerie des composants réels `/dev/ui/checklist` inspectée dans Chrome aux formats
  1024 × 768, 768 × 1024 et 390 × 844. Pas de défilement horizontal constaté sur mobile.
- Cases : zones mesurées à 44 × 44 px. Libellés longs lisibles sur plusieurs lignes.
- Filtre « À jour », recherche `GENOIS` sans accent, catégorie sans résultat, réinitialisation,
  repli/dépli d'un groupe et ouverture/annulation du dialogue vérifiés dans le navigateur.
- Tests unitaires : ancrage sans réalisation, échéance proche/dépassée, intervention ouverte,
  contrôle ponctuel, recherche combinée, retour immédiat et annulation avant/après réception serveur.
- Lint, TypeScript et build Next.js vérifiés. Les suites nécessitant Postgres sont ignorées
  sans `DATABASE_URL`. Aucune écriture effectuée dans le carnet de production.
- Reste à la recette de déploiement : écriture de bout en bout avec Supabase et Safari iPad réel.
