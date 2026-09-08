import { addYears, parseISO } from "date-fns";

import { computeChecklistStatus } from "@/lib/checklist-status";
import { toDateString } from "@/lib/format";

/**
 * What a tick has just promised. Ticking a point is the most frequent gesture of the app, and
 * until now its only answer was « Point coché » — true, and empty. The deadline the completion
 * has just created is the one thing the person wants to read back: « Prochaine : 15/03/2027 »,
 * « ou 780 h », or both.
 *
 * The rule is not written a second time here: everything comes from `computeChecklistStatus`,
 * the TS mirror of `checklist_item_status` (rule 8) — a fixed date wins over the interval (D11),
 * the hour deadline is the counter just read plus the hour interval.
 */
export type NextDueInput = {
  /** `yyyy-MM-dd` of the completion being saved. */
  completedAt: string;
  /** Engine hours read on that completion, null when the point does not count them. */
  engineHours: number | null;
  intervalMonths: number | null;
  intervalHours: number | null;
  /** « Valide jusqu'au » just typed, which replaces the date computed from the interval. */
  fixedDueAt: string | null;
};

export type NextDue = { dueAt: string | null; dueHours: number | null };

export function nextDueAfterCompletion(input: NextDueInput): NextDue {
  const status = computeChecklistStatus({
    lastCompletedAt: input.completedAt,
    lastEngineHours: input.engineHours,
    intervalMonths: input.intervalMonths,
    intervalHours: input.intervalHours,
    currentHours: null,
    fixedDueAt: input.fixedDueAt,
    // The completion is the reference; « today » only decides a state nobody reads here.
    today: input.completedAt,
  });
  return { dueAt: status.dueAt, dueHours: status.dueHours };
}

/**
 * The sentence the toast carries, or null when the tick creates no deadline at all — a one-off
 * check with no interval and no expiry date promises nothing, and says so by staying quiet.
 *
 * The words stay in `fr.json` (rule 7): the caller passes the formatters and the two sentences.
 */
export function nextDueSentence(
  input: NextDueInput,
  labels: {
    /** 15/03/2027 */
    date: (value: string) => string;
    /** 780 h */
    hours: (value: number) => string;
    /** « {date} ou {hours} » */
    both: (values: { date: string; hours: string }) => string;
    /** « Prochaine : {next} » */
    sentence: (values: { next: string }) => string;
  },
): string | null {
  const { dueAt, dueHours } = nextDueAfterCompletion(input);
  if (dueAt === null && dueHours === null) return null;
  const date = dueAt === null ? null : labels.date(dueAt);
  const hours = dueHours === null ? null : labels.hours(dueHours);
  const next =
    date !== null && hours !== null ? labels.both({ date, hours }) : ((date ?? hours) as string);
  return labels.sentence({ next });
}

/**
 * `yyyy-MM-dd` a whole number of years later, for the « + 1 an » / « + 2 ans » shortcuts of an
 * expiry date. Through date-fns so 29 February lands on 28 February rather than 1 March.
 */
export function addYearsTo(date: string, years: number): string {
  return toDateString(addYears(parseISO(date), years));
}
