import { addMonths, differenceInCalendarDays, parseISO } from "date-fns";

import { toDateString } from "@/lib/format";

// Mirror of public.checklist_compute_status() and of the two `coalesce` of the view
// public.checklist_item_status (supabase/migrations/0004_tracking.sql).
// Used ONLY for optimistic UI; the view checklist_item_status is the source of truth.
// Parity is enforced by tests/unit/checklist-status.test.ts on tests/fixtures/checklist-status-cases.json.

export type ChecklistState = "never" | "ok" | "soon" | "overdue";

export const SOON_DAYS = 30;
export const SOON_HOURS = 25;

export type ChecklistStatusInput = {
  /** checklist_items.anchor_date — reference used until the item has a completion (D1) */
  anchorDate?: string | null; // yyyy-MM-dd
  /** checklist_items.anchor_hours — engine hours at anchoring time */
  anchorHours?: number | null;
  lastCompletedAt: string | null; // yyyy-MM-dd
  lastEngineHours: number | null;
  intervalMonths: number | null;
  intervalHours: number | null;
  currentHours: number | null;
  /** checklist_completions.next_due_at of the last completion — always wins over the interval (D11) */
  fixedDueAt?: string | null; // yyyy-MM-dd
  /** engines.counter_reset_at — cancels an hour deadline whose reference predates it (D12) */
  counterResetAt?: string | null; // yyyy-MM-dd
  /** defaults to `lastCompletedAt !== null` */
  hasCompletion?: boolean;
  today?: string; // yyyy-MM-dd, defaults to today
};

export type ChecklistStatus = {
  dueAt: string | null;
  dueHours: number | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  state: ChecklistState;
};

/** Date the deadlines are counted from: the last completion, else the item's anchor. */
export function checklistReferenceAt(input: ChecklistStatusInput): string | null {
  return input.lastCompletedAt ?? input.anchorDate ?? null;
}

/**
 * Engine hours the hour deadline is counted from: the last completion, else the anchor —
 * neutralised when the counter was replaced after that reference (the two scales no longer match).
 */
export function checklistReferenceHours(input: ChecklistStatusInput): number | null {
  const referenceAt = checklistReferenceAt(input);
  if (
    input.counterResetAt &&
    referenceAt &&
    differenceInCalendarDays(parseISO(referenceAt), parseISO(input.counterResetAt)) < 0
  ) {
    return null;
  }
  return input.lastEngineHours ?? input.anchorHours ?? null;
}

export function computeChecklistStatus(input: ChecklistStatusInput): ChecklistStatus {
  const today = input.today ?? toDateString(new Date());
  const hasCompletion = input.hasCompletion ?? input.lastCompletedAt !== null;
  const referenceAt = checklistReferenceAt(input);
  const referenceHours = checklistReferenceHours(input);

  let dueAt: string | null = null;
  if (input.fixedDueAt) {
    dueAt = input.fixedDueAt;
  } else if (input.intervalMonths !== null && referenceAt !== null) {
    dueAt = toDateString(addMonths(parseISO(referenceAt), input.intervalMonths));
  }
  const daysRemaining =
    dueAt === null ? null : differenceInCalendarDays(parseISO(dueAt), parseISO(today));

  let dueHours: number | null = null;
  let hoursRemaining: number | null = null;
  if (input.intervalHours !== null && referenceHours !== null) {
    dueHours = referenceHours + input.intervalHours;
    if (input.currentHours !== null) {
      hoursRemaining = round1(dueHours - input.currentHours);
    }
  }

  let state: ChecklistState;
  if (
    (daysRemaining !== null && daysRemaining < 0) ||
    (hoursRemaining !== null && hoursRemaining < 0)
  ) {
    state = "overdue";
  } else if (
    (daysRemaining !== null && daysRemaining <= SOON_DAYS) ||
    (hoursRemaining !== null && hoursRemaining <= SOON_HOURS)
  ) {
    state = "soon";
  } else if (input.intervalMonths === null && input.intervalHours === null && !hasCompletion) {
    // one-off check never done: information only, never in the dashboard queue
    state = "never";
  } else {
    state = "ok";
  }

  return { dueAt, dueHours, daysRemaining, hoursRemaining, state };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
