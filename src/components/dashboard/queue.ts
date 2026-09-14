import { differenceInCalendarDays, parseISO } from "date-fns";

import { hasCounter, type ChecklistRow } from "@/components/checklist/rows";
import { drivenByHours } from "@/components/dashboard/next-due";
import { itemNeedsAttention, logNeedsAttention, WEEK_DAYS } from "@/lib/attention";
import type { Database } from "@/types/database";

type LogStatus = Database["public"]["Enums"]["log_status"];

/** Une ligne de la file : un point de checklist, ou une intervention encore ouverte. */
export type UpcomingEntry =
  | { kind: "item"; row: ChecklistRow }
  | {
      kind: "log";
      id: string;
      title: string;
      status: LogStatus;
      dueAt: string | null;
      categoryName: string;
      categoryColor: string;
    };

export function entryKey(entry: UpcomingEntry): string {
  return entry.kind === "item" ? `item:${entry.row.id}` : `log:${entry.id}`;
}

/**
 * Les paliers de la file (D121, E18-1).
 *
 * L'écran ne montre plus six lignes suivies d'un lien : il montre tout ce qui attend quelqu'un.
 * Quarante lignes d'affilée ne se lisent pas, donc elles se rangent — par ce que la personne
 * peut en faire : aujourd'hui, cette semaine, ce mois-ci, et ce qui tombera aux heures moteur.
 *
 * Les trois premiers paliers lisent les règles qui existent déjà : le point rouge (D88) décide
 * de « Aujourd'hui », la fenêtre de sept jours (`WEEK_DAYS`) de « Cette semaine ». C'est ce qui
 * garantit que la pastille de l'onglet et le premier palier ne peuvent pas se contredire.
 *
 * Le quatrième n'est pas un palier de calendrier, et c'est pour cela qu'il est à part : une
 * vidange due dans 40 h ne tombe pas un jour, elle tombe quand on aura motorisé. La convertir en
 * jours pour la ranger sous « Cette semaine » aurait affiché une supposition (1 h ≈ 1,2 j) sous
 * un titre qui se lit comme un fait.
 */
export type QueueGroupKey = "today" | "week" | "month" | "hours";

export const QUEUE_GROUP_ORDER: readonly QueueGroupKey[] = ["today", "week", "month", "hours"];

export type QueueGroup = { key: QueueGroupKey; entries: UpcomingEntry[] };

export function groupOf(entry: UpcomingEntry, today: string): QueueGroupKey {
  if (entry.kind === "log") {
    // Urgente, ou datée d'aujourd'hui ou d'avant : la règle du point rouge, mot pour mot.
    if (logNeedsAttention({ status: entry.status, performedAt: entry.dueAt }, today))
      return "today";
    const days = entry.dueAt
      ? differenceInCalendarDays(parseISO(entry.dueAt), parseISO(today))
      : null;
    return days !== null && days <= WEEK_DAYS ? "week" : "month";
  }
  const row = entry.row;
  if (itemNeedsAttention({ status: row.status, daysRemaining: row.daysRemaining })) return "today";
  // Sans compteur relevé, l'échéance en heures ne s'affiche pas : elle ne peut pas classer non plus.
  const hours = hasCounter(row) ? row.hoursRemaining : null;
  if (row.daysRemaining === null || drivenByHours(row.daysRemaining, hours)) return "hours";
  return row.daysRemaining <= WEEK_DAYS ? "week" : "month";
}

/** Les paliers non vides, dans l'ordre, chacun gardant l'ordre que la file leur a donné. */
export function groupQueue(entries: readonly UpcomingEntry[], today: string): QueueGroup[] {
  const groups = new Map<QueueGroupKey, UpcomingEntry[]>();
  for (const entry of entries) {
    const key = groupOf(entry, today);
    const found = groups.get(key);
    if (found) found.push(entry);
    else groups.set(key, [entry]);
  }
  return QUEUE_GROUP_ORDER.filter((key) => groups.has(key)).map((key) => ({
    key,
    entries: groups.get(key) ?? [],
  }));
}
