import { differenceInCalendarDays, parseISO } from "date-fns";

import { hasCounter, type ChecklistRow } from "@/components/checklist/rows";
import { drivenByHours } from "@/components/dashboard/next-due";
import { itemNeedsAttention, logNeedsAttention, WEEK_DAYS } from "@/lib/attention";
import type { Database } from "@/types/database";

type LogStatus = Database["public"]["Enums"]["log_status"];

/**
 * Une ligne de la file : tout ce qui attend quelqu'un sur ce bateau (D125).
 *
 * Quatre objets, pas un de plus, et chacun porte son propre geste : un point de checklist
 * (« Fait »), une intervention ouverte, un document à valider, une pièce à racheter.
 */
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
    }
  | { kind: "inbox"; id: string; title: string; receivedAt: string | null }
  | {
      kind: "part";
      id: string;
      title: string;
      /** Ce qu'il manque pour repasser au-dessus du seuil — `severity` de la file. */
      missing: number;
      categoryName: string | null;
      categoryColor: string | null;
    };

export function entryKey(entry: UpcomingEntry): string {
  return entry.kind === "item" ? `item:${entry.row.id}` : `${entry.kind}:${entry.id}`;
}

/**
 * Les paliers de la file (D121, D125, E18-1, E18-2).
 *
 * L'écran ne montre plus six lignes suivies d'un lien : il montre tout ce qui attend quelqu'un.
 * Quarante lignes d'affilée ne se lisent pas, donc elles se rangent — par ce que la personne
 * peut en faire : aujourd'hui, cette semaine, ce mois-ci, aux heures moteur, au prochain
 * shipchandler.
 *
 * Les trois premiers paliers lisent les règles qui existent déjà : le point rouge (D88) décide
 * de « Aujourd'hui », la fenêtre de sept jours (`WEEK_DAYS`) de « Cette semaine ». C'est ce qui
 * garantit que la pastille de l'onglet et le premier palier ne peuvent pas se contredire.
 *
 * Les deux derniers ne sont pas des paliers de calendrier, et c'est pour cela qu'ils sont à
 * part : une vidange due dans 40 h tombe quand on aura motorisé, une pièce sous son seuil tombe
 * quand on ira l'acheter. Les convertir en jours aurait affiché une supposition sous un titre
 * qui se lit comme un fait.
 *
 * Un document, lui, attend **depuis** son arrivée : il est du travail d'aujourd'hui, et c'est
 * exactement ce que le bandeau disait avant d'être une ligne (D125).
 */
export type QueueGroupKey = "today" | "week" | "month" | "hours" | "restock";

export const QUEUE_GROUP_ORDER: readonly QueueGroupKey[] = [
  "today",
  "week",
  "month",
  "hours",
  "restock",
];

export type QueueGroup = { key: QueueGroupKey; entries: UpcomingEntry[] };

export function groupOf(entry: UpcomingEntry, today: string): QueueGroupKey {
  if (entry.kind === "inbox") return "today";
  if (entry.kind === "part") return "restock";
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
