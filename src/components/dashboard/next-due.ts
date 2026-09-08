/**
 * La prochaine échéance quand il n'y a plus rien à faire — la phrase sous « Rien à faire dans
 * les 30 prochains jours ».
 *
 * Elle lisait la première ligne de `checklist_item_status` triée par jours restants, nulls en
 * dernier : sur un bateau dont les échéances proches sont en heures moteur, cette ligne revenait
 * sans un seul jour à écrire, et l'état vide affichait un titre suivi de rien. On regarde donc un
 * échantillon et on garde la plus proche des deux échéances, jours ou heures — et l'appelant a
 * de quoi dire laquelle, ou dire qu'il n'y en a aucune.
 */

/** Une heure moteur vaut à peu près 1,2 jour : la conversion de `boat_todo_queue` (rank 3). */
export const HOURS_TO_DAYS = 1.2;

export type NextDueRow = {
  label: string | null;
  days_remaining: number | null;
  hours_remaining: number | null;
};

export type NextDue = { label: string; days: number | null; hours: number | null };

/** La ligne la plus proche, en jours ou en heures ; null quand aucune n'a d'échéance datée. */
export function pickNextDue(rows: readonly NextDueRow[]): NextDue | null {
  let best: NextDue | null = null;
  let bestDays = Number.POSITIVE_INFINITY;
  for (const row of rows) {
    const days = row.days_remaining;
    const hours = row.hours_remaining;
    const inDays = Math.min(
      days ?? Number.POSITIVE_INFINITY,
      hours === null ? Number.POSITIVE_INFINITY : hours * HOURS_TO_DAYS,
    );
    // Ni jour ni heure : la ligne existe, son échéance non. Elle ne peut rien annoncer.
    if (!Number.isFinite(inDays) || inDays >= bestDays) continue;
    bestDays = inDays;
    best = { label: row.label ?? "", days, hours };
  }
  return best;
}
