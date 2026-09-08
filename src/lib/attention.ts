import { differenceInCalendarDays, parseISO } from "date-fns";

import { todayString } from "@/lib/format";
import type { Database } from "@/types/database";

type LogStatus = Database["public"]["Enums"]["log_status"];

/**
 * Ce qui mérite un point rouge — et rien d'autre (D88).
 *
 * Le point rouge ne dit qu'une chose : « il y a quelque chose à faire aujourd'hui ». En retard,
 * ou dû dans la journée. « Bientôt » (30 jours), « jamais fait », une intervention planifiée le
 * mois prochain, le stock sous le seuil et les lignes à vérifier ne sont pas des urgences du
 * jour : ils ont leurs propres écrans et leurs propres badges. Un compteur qui allume l'onglet
 * pour trente jours d'avance n'oriente plus personne — il devient le décor.
 *
 * Une seule règle, écrite ici, lue par les compteurs de la navigation, par la grille des
 * systèmes, par les onglets des écrans et par les lignes elles-mêmes : c'est ce qui garantit
 * que le point rouge de l'onglet mène bien à une ligne qui en porte un.
 */

/** Ce que la règle regarde d'un point de checklist : `checklist_item_status` a déjà fait la soustraction. */
export type AttentionItem = {
  status: string | null;
  /** `due_at - current_date`, calculé par la vue : 0 = aujourd'hui, négatif = en retard. */
  daysRemaining: number | null;
};

/** En retard (date ou heures), ou dû dans la journée. */
export function itemNeedsAttention(item: AttentionItem): boolean {
  return item.status === "overdue" || item.daysRemaining === 0;
}

/**
 * À faire dans la journée, et pas encore en retard : la ligne que « Bientôt » sous-vend.
 * Un point dont l'échéance est en heures n'a pas de jour restant — il est « bientôt » ou
 * « en retard », jamais « aujourd'hui ».
 */
export function isDueToday(item: AttentionItem): boolean {
  return item.status !== "overdue" && item.daysRemaining === 0;
}

/** Ce que la règle regarde d'une intervention. */
export type AttentionLog = {
  status: LogStatus;
  /** `maintenance_logs.performed_at` : la date prévue tant que l'intervention n'est pas faite. */
  performedAt: string | null;
};

/** Les trois statuts d'une intervention encore ouverte. */
export const OPEN_LOG_STATUSES = ["planned", "in_progress", "urgent"] as const;

export function isOpenLog(status: LogStatus): boolean {
  return (OPEN_LOG_STATUSES as readonly LogStatus[]).includes(status);
}

/**
 * Urgente (c'est ce que le statut veut dire), ou ouverte et datée d'aujourd'hui ou d'avant.
 * Une intervention prévue la semaine prochaine attend son tour sans allumer l'onglet.
 */
export function logNeedsAttention(log: AttentionLog, today: string = todayString()): boolean {
  if (log.status === "urgent") return true;
  if (!isOpenLog(log.status)) return false;
  return log.performedAt !== null && log.performedAt <= today;
}

/**
 * Jours de retard d'une date prévue : 0 = aujourd'hui, null quand elle est encore devant.
 * Le nombre est toujours écrit à l'écran — la couleur ne porte jamais seule (règle DA).
 */
export function daysLate(
  date: string | null | undefined,
  today: string = todayString(),
): number | null {
  if (!date) return null;
  const days = differenceInCalendarDays(parseISO(today), parseISO(date));
  return Number.isFinite(days) && days >= 0 ? days : null;
}
