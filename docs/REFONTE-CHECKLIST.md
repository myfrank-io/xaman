# Brief — refonte de la checklist

> Écrit le 2026-09-14 à la demande de Joseph : « on ne comprend rien du tout, c'est pas simple,
> trop de saisies et pas simple d'usage ». Ce fichier **est le prompt** : il se donne tel quel à
> une session neuve. Il dit ce qui ne va pas et ce qu'on veut ; il ne dessine pas la solution —
> c'est le travail de qui le prend.

## La demande

Refondre **toute** la partie checklist de Xaman. Aujourd'hui c'est l'écran le plus important de
l'app (c'est le différenciateur produit, `SPEC.md` §3) et c'est celui que personne ne comprend.
L'objectif n'est pas d'ajouter des fonctions : c'est d'en retirer, et de rendre évident ce qui
reste.

## Ce qu'il faut lire avant de toucher quoi que ce soit

`docs/SPEC.md` (§3, §6.1–6.4), `docs/AUDIT.md` (D8, D21, D88), `docs/DATA-MODEL.md` (§6.2, la vue
`checklist_item_status` — **la logique d'état est en base et y reste**), `docs/DECISIONS.md`
(D1, D4, D5, D11, D14, D16, D21, D73, D84, D88, D95). Puis le code :

```
src/app/(app)/boats/[boatId]/checklist/**          les écrans
src/components/checklist/*                         2 800 lignes
src/lib/checklist-status.ts                        la copie TS de la logique de la vue
src/messages/fr.json → "checklist"                 147 clés
```

## Ce qui ne va pas — constaté dans le code, à vérifier à l'usage

1. **Trois portes pour la même chose.** La grille des 9 systèmes, la liste plate « À traiter »
   (`ChecklistViewTabs`), et la file du tableau de bord montrent les mêmes points autrement. On
   ne sait jamais où on est ni laquelle fait autorité. S'y ajoutent `StartupWizard`,
   `ChoosePlanBlock` et « Recaler ma checklist » dans les paramètres.
2. **Cocher coûte cinq saisies.** `CompleteItemDialog` demande : la date, « réalisé par » (moi /
   un membre / quelqu'un d'autre + son nom), les heures moteur, « valide jusqu'au », une note.
   Le commentaire du fichier promet « 2 taps sans heures, 3 avec » — ce n'est plus vrai. Cocher
   « j'ai fait ça » devrait coûter **un geste**, le reste étant déduit et corrigeable après coup.
3. **Le vocabulaire est celui de la base, pas celui du bord.** « point », « intervalle »,
   « ancrage », « recaler », « ponctuel », « jamais fait », « compteur inconnu », « valide
   jusqu'au ». Un skipper dit « à faire », « fait le … », « tous les ans », « au moteur ».
4. **La ligne est surchargée.** `ChecklistItemRow` porte un badge d'état de 112 px, le titre, une
   ligne de méta qui concatène jusqu'à six informations (catégorie · intervalle · fait le · par
   qui · à N heures · valide jusqu'au), une échéance à droite et un bouton « Fait ». Sur un
   téléphone il ne reste rien pour le titre.
5. **Le mur du premier jour.** Les 93 points de l'ORC 50 arrivent tous en « jamais fait ». Un
   écran qui s'ouvre sur 93 lignes rouges n'oriente personne, et `boat_todo_queue` les exclut
   déjà pour cette raison — preuve que le problème est connu et contourné, pas réglé.
6. **Deux façons de dire « c'est fait ».** Cocher un point et noter une intervention sont deux
   gestes séparés, et rien à l'écran ne dit lequel choisir ni ce que l'autre implique.

## Ce qu'on veut

- **Un écran, une question** : « qu'est-ce que je fais aujourd'hui, sur ce bateau ? ». Tout le
  reste (l'inventaire des 93 points, le plan, le recalage) est une consultation, pas la porte.
- **Cocher en un geste.** La date d'aujourd'hui, la personne connectée, et les heures moteur
  quand elles sont déjà connues : rien de tout ça ne se demande. Ce qui a été deviné se corrige
  après, depuis la ligne, sans rouvrir un formulaire.
- **Des mots de marin.** Si une phrase a besoin d'être expliquée, c'est la phrase qui est fausse.
- **Le premier jour utilisable.** Un carnet neuf doit proposer un ordre de marche, pas un mur.
- **iPad d'abord**, règles 1, 8, 12 et 13 de `CLAUDE.md` : la logique d'état reste en base
  (`checklist_item_status`), la copie TS reste à parité, ≥ 44 px, pas de `type="number"`, jamais
  de saisie perdue.

## Ce qui ne se négocie pas

- `checklist_item_status` et `checklist_compute_status` **ne bougent pas** : c'est la source de
  vérité des états, testée en parité avec `src/lib/checklist-status.ts` sur
  `tests/fixtures/checklist-status-cases.json`. La refonte est au-dessus de cette ligne.
- Les heures moteur restent exigées là où la base les exige (`check_completion_hours`, D73 pour
  les moteurs sans compteur).
- Le cochage hors ligne reste (E9-1b) : c'est le seul geste qui doit survivre à une liaison
  morte, avec son annulation.
- Rien ne se supprime en dur : corbeille et `deleted_at` comme partout (règle 9).

## Livrable attendu

1. **Une décision** dans `docs/DECISIONS.md` (numéro pris sur la ligne « Prochain numéro »,
   incrémentée dans le même commit) qui tranche : quelle est la porte unique, ce que devient la
   grille, ce que coûte un cochage, ce que deviennent les trois écrans en trop.
2. **Des tickets** dans `docs/BACKLOG.md` sous une épique dédiée, un par écran, avec DoD.
3. **Le code**, écran par écran, avec sa maquette dans `/dev/ui/**` et l'audit tactile qui passe
   en 1024×768, 768×1024 et 320 px.
4. **Les tests** : logique métier en unitaire, parcours en E2E (`tests/e2e/journeys/checklist.spec.ts`
   existe déjà et doit continuer à passer, ou être réécrit avec le parcours).

Avant d'écrire une ligne de code : ouvrir l'app sur le bateau Xaman avec ses 93 points, faire le
parcours « je rentre de navigation, trois choses sont à faire », et écrire ce qu'on a vu. C'est
ce compte rendu qui justifie la refonte, pas ce document.
