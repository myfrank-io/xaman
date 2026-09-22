import type { ChecklistState } from "@/components/common/ChecklistStateBadge";
import { isDueToday as ruleIsDueToday, itemNeedsAttention } from "@/lib/attention";
import { computeChecklistStatus } from "@/lib/checklist-status";
import type { Database } from "@/types/database";

// One row of `checklist_item_status`, as the screens use it.
export type ChecklistRow = {
  id: string;
  label: string;
  description: string | null;
  actions: string[];
  categoryId: string;
  categoryIds?: string[];
  categoryNames?: string[];
  categoryName: string;
  categoryColor: string;
  engineId: string | null;
  engineLabel: string | null;
  /** false when the linked engine has no hour meter (D73): no hours are ever asked for. */
  engineTracksHours: boolean;
  intervalMonths: number | null;
  intervalHours: number | null;
  sortOrder: number;
  anchorDate: string | null;
  anchorHours: number | null;
  counterResetAt: string | null;
  currentHours: number | null;
  hasCompletion: boolean;
  lastCompletionId: string | null;
  lastCompletedAt: string | null;
  lastCompletedByName: string | null;
  lastEngineHours: number | null;
  fixedDueAt: string | null;
  status: ChecklistState;
  dueAt: string | null;
  dueHours: number | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  /**
   * The intervention someone has in hand for this point (D140, D141): planned, in progress or
   * urgent. Null when nobody has taken it. The line says it instead of a bare delay, and a
   * tick finishes this line rather than writing a second one.
   */
  openLog: OpenLog | null;
};

export type OpenLogStatus = Exclude<Database["public"]["Enums"]["log_status"], "done">;

export type OpenLog = {
  id: string;
  status: OpenLogStatus;
  /** `yyyy-MM-dd`: the planned date (`maintenance_logs.performed_at`). */
  at: string;
  /** Who it was handed to, when it was handed to someone of the directory. */
  contactName: string | null;
};

export type StatusViewRow = Database["public"]["Views"]["checklist_item_status"]["Row"];

/** The four view columns of the open intervention, as one object or nothing. */
export function toOpenLog(
  row: Pick<
    StatusViewRow,
    "open_log_id" | "open_log_status" | "open_log_at" | "open_log_contact_name"
  >,
): OpenLog | null {
  if (
    !row.open_log_id ||
    !row.open_log_status ||
    row.open_log_status === "done" ||
    !row.open_log_at
  )
    return null;
  return {
    id: row.open_log_id,
    status: row.open_log_status,
    at: row.open_log_at,
    contactName: row.open_log_contact_name,
  };
}

export function toChecklistRow(
  row: StatusViewRow,
  category: { name: string; color: string },
  engineLabel: string | null,
): ChecklistRow {
  return {
    id: row.id ?? "",
    label: row.label ?? "",
    description: row.description,
    actions: Array.isArray(row.actions) ? row.actions.map(String) : [],
    categoryId: row.category_id ?? "",
    categoryIds: row.category_ids ?? [row.category_id ?? ""],
    categoryName: category.name,
    categoryColor: category.color,
    engineId: row.engine_id,
    engineLabel,
    engineTracksHours: row.engine_tracks_hours ?? true,
    intervalMonths: row.interval_months,
    intervalHours: row.interval_hours,
    sortOrder: row.sort_order ?? 0,
    anchorDate: row.anchor_date,
    anchorHours: row.anchor_hours,
    counterResetAt: row.counter_reset_at,
    currentHours: row.current_hours,
    hasCompletion: row.has_completion ?? false,
    lastCompletionId: row.last_completion_id,
    lastCompletedAt: row.last_completed_at,
    lastCompletedByName: row.last_completed_by_name,
    lastEngineHours: row.last_engine_hours,
    fixedDueAt: row.fixed_due_at,
    status: (row.status ?? "never") as ChecklistState,
    dueAt: row.due_at,
    dueHours: row.due_hours,
    daysRemaining: row.days_remaining,
    hoursRemaining: row.hours_remaining,
    openLog: toOpenLog(row),
  };
}

/**
 * Une échéance en heures n'est lisible que derrière un compteur : un point sans moteur n'en
 * dépend pas, un point dont le moteur n'a jamais été relevé ne peut pas dire « dans 40 h ».
 * La ligne, la carte « À faire maintenant » et les paliers de la file lisent cette règle-ci.
 */
export function hasCounter(row: ChecklistRow): boolean {
  return row.engineId === null || row.currentHours !== null;
}

export function isPunctual(row: ChecklistRow): boolean {
  return row.intervalMonths === null && row.intervalHours === null;
}

export function isTodo(row: ChecklistRow): boolean {
  return row.status === "overdue" || row.status === "soon" || row.status === "never";
}

/** En retard, ou à faire dans la journée : la seule chose qui allume un point rouge (D88). */
function needsAttention(row: ChecklistRow): boolean {
  return itemNeedsAttention({ status: row.status, daysRemaining: row.daysRemaining });
}

/** À faire dans la journée, pas encore en retard : « Bientôt » sous-vend cette ligne. */
export function isDueToday(row: ChecklistRow): boolean {
  return ruleIsDueToday({ status: row.status, daysRemaining: row.daysRemaining });
}

export function countAttention(rows: readonly ChecklistRow[]): number {
  return rows.filter(needsAttention).length;
}

const STATE_RANK: Record<ChecklistState, number> = { overdue: 0, soon: 1, never: 2, ok: 3 };

// Urgency for « À traiter » and the category list: worst overdue first, then closest deadline.
function urgency(row: ChecklistRow): number {
  const days = row.daysRemaining ?? 9999;
  const hours = row.hoursRemaining === null ? 9999 : row.hoursRemaining * 1.2;
  return Math.min(days, hours);
}

export function sortRows(rows: ChecklistRow[], byUrgency = false): ChecklistRow[] {
  return [...rows].sort((a, b) => {
    const rank = STATE_RANK[a.status] - STATE_RANK[b.status];
    if (rank !== 0) return rank;
    if (byUrgency && a.status !== "never") {
      const diff = urgency(a) - urgency(b);
      if (diff !== 0) return diff;
    }
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.label.localeCompare(b.label, "fr");
  });
}

// Optimistic re-status after a completion (ux-flows §3b): the TS mirror of the SQL view.
export function applyCompletion(
  row: ChecklistRow,
  completion: {
    id: string;
    completedAt: string;
    completedByName: string;
    engineHours: number | null;
    nextDueAt: string | null;
  },
): ChecklistRow {
  const currentHours =
    completion.engineHours !== null && row.engineId ? completion.engineHours : row.currentHours;
  const status = computeChecklistStatus({
    anchorDate: row.anchorDate,
    anchorHours: row.anchorHours,
    lastCompletedAt: completion.completedAt,
    lastEngineHours: completion.engineHours,
    intervalMonths: row.intervalMonths,
    intervalHours: row.intervalHours,
    currentHours,
    fixedDueAt: completion.nextDueAt,
    counterResetAt: row.counterResetAt,
    hasCompletion: true,
  });
  return {
    ...row,
    currentHours,
    hasCompletion: true,
    lastCompletionId: completion.id,
    lastCompletedAt: completion.completedAt,
    lastCompletedByName: completion.completedByName,
    lastEngineHours: completion.engineHours,
    fixedDueAt: completion.nextDueAt,
    status: status.state,
    dueAt: status.dueAt,
    dueHours: status.dueHours,
    daysRemaining: status.daysRemaining,
    hoursRemaining: status.hoursRemaining,
    // The tick finished whatever was planned on the point (D140): nothing is in hand any more.
    openLog: null,
  };
}

/** The point handed over, before the server says so (« Confier au chantier », D141). */
export function applyOpenLog(row: ChecklistRow, openLog: OpenLog): ChecklistRow {
  return { ...row, openLog };
}
