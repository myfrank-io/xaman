import { addMonths, differenceInCalendarDays, parseISO } from "date-fns";

import { toDateString } from "@/lib/format";

// Mirror of public.checklist_compute_status() (supabase/migrations/0003_logic.sql).
// Used ONLY for optimistic UI; the view checklist_item_status is the source of truth.
// Parity is enforced by tests/unit/checklist-status.test.ts on tests/fixtures/checklist-status-cases.json.

export type ChecklistState = "never" | "ok" | "soon" | "overdue";

export const SOON_DAYS = 30;
export const SOON_HOURS = 25;

export type ChecklistStatusInput = {
  lastCompletedAt: string | null; // yyyy-MM-dd
  intervalMonths: number | null;
  lastEngineHours: number | null;
  intervalHours: number | null;
  currentHours: number | null;
  today?: string; // yyyy-MM-dd, defaults to today
};

export type ChecklistStatus = {
  dueAt: string | null;
  dueHours: number | null;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  state: ChecklistState;
};

export function computeChecklistStatus(input: ChecklistStatusInput): ChecklistStatus {
  const today = input.today ?? toDateString(new Date());
  if (!input.lastCompletedAt) {
    return {
      dueAt: null,
      dueHours: null,
      daysRemaining: null,
      hoursRemaining: null,
      state: "never",
    };
  }

  let dueAt: string | null = null;
  let daysRemaining: number | null = null;
  if (input.intervalMonths !== null) {
    const due = addMonths(parseISO(input.lastCompletedAt), input.intervalMonths);
    dueAt = toDateString(due);
    daysRemaining = differenceInCalendarDays(due, parseISO(today));
  }

  let dueHours: number | null = null;
  let hoursRemaining: number | null = null;
  if (input.intervalHours !== null && input.lastEngineHours !== null) {
    dueHours = input.lastEngineHours + input.intervalHours;
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
  } else {
    state = "ok";
  }

  return { dueAt, dueHours, daysRemaining, hoursRemaining, state };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
