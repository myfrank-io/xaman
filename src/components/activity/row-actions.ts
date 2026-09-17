import type { ActivityKind, ActivityRow } from "@/lib/queries/activity";
import { editPurchasePath, haulOutPath, logPath } from "@/lib/queries/boat-routes";

/** Ce que « Supprimer » fait à un fait du fil, et donc ce que la ligne doit promettre. */
export type ActivityRemoval = "trash" | "delete";

/**
 * La corbeille garde trente jours ce qui est un objet du carnet (règle 9) : intervention, achat,
 * sortie de l'eau. Un cochage et un relevé d'heures s'effacent pour de bon — ce sont des faits
 * dérivés, pas des objets — donc eux seuls demandent une confirmation avant de partir.
 */
export const ACTIVITY_REMOVAL: Record<ActivityKind, ActivityRemoval> = {
  log: "trash",
  purchase: "trash",
  haul_out: "trash",
  completion: "delete",
  reading: "delete",
};

/**
 * L'écran du fait, quand il en a un.
 *
 * Trois des cinq en ont un, et c'est exactement ce que la ligne propose d'ouvrir. Un cochage
 * mène à son point, mais le fil ne porte pas le système du point, et un relevé n'a pas d'écran à
 * lui : plutôt qu'un lien qui retombe sur une liste, ces deux-là n'offrent que de partir.
 */
export function activityOpenPath(
  boatId: string,
  row: Pick<ActivityRow, "kind" | "id">,
): string | null {
  switch (row.kind) {
    case "log":
      return logPath(boatId, row.id);
    case "purchase":
      return editPurchasePath(boatId, row.id);
    case "haul_out":
      return haulOutPath(boatId, row.id);
    default:
      return null;
  }
}
