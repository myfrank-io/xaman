import { differenceInCalendarDays } from "date-fns";

import { toDate, toDateString } from "@/lib/format";

/**
 * Gas bottle facts (E5-3, audit §3.4): the prediction was dropped and replaced by facts.
 * Everything here is derived from the dates of the `kind = 'gas'` purchases — nothing else.
 * Pure module: no database, no React, unit-tested in `tests/unit/gas.test.ts`.
 */

/** Below three intervals an average is an anecdote, not an estimate (audit §3.4). */
export const MIN_INTERVALS_FOR_ESTIMATE = 3;

export type GasFacts = {
  /** Most recent change, `yyyy-MM-dd`, or null when nothing was ever recorded. */
  lastAt: string | null;
  /** Days elapsed since `lastAt` (0 when it happened today). */
  daysSinceLast: number | null;
  /** Change before `lastAt`, useful for « précédent changement ». */
  previousAt: string | null;
  /** Number of gaps between consecutive changes: N changes give N − 1 intervals. */
  intervalCount: number;
  /** Mean gap in days, rounded, null while there is no interval at all. */
  averageDays: number | null;
  /** `lastAt + averageDays`, only from MIN_INTERVALS_FOR_ESTIMATE intervals on. */
  nextEstimatedAt: string | null;
};

function addDaysToDate(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * @param dates purchase dates in any order, `yyyy-MM-dd`; invalid entries are ignored.
 * @param today reference day for « il y a N j » (defaults to the device's day).
 */
export function gasFacts(dates: readonly string[], today: string | Date = new Date()): GasFacts {
  const sorted = dates
    .map((value) => toDate(value))
    .filter((date): date is Date => date !== null)
    .sort((a, b) => a.getTime() - b.getTime());

  const empty: GasFacts = {
    lastAt: null,
    daysSinceLast: null,
    previousAt: null,
    intervalCount: 0,
    averageDays: null,
    nextEstimatedAt: null,
  };
  if (sorted.length === 0) return empty;

  const last = sorted[sorted.length - 1] as Date;
  const previous = sorted.length > 1 ? (sorted[sorted.length - 2] as Date) : null;
  const reference = toDate(today) ?? new Date();

  // Only the gaps between two consecutive purchases count: a single bottle has no interval.
  const gaps: number[] = [];
  for (let index = 1; index < sorted.length; index += 1) {
    gaps.push(differenceInCalendarDays(sorted[index] as Date, sorted[index - 1] as Date));
  }

  const averageDays =
    gaps.length > 0 ? Math.round(gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length) : null;

  return {
    lastAt: toDateString(last),
    daysSinceLast: Math.max(0, differenceInCalendarDays(reference, last)),
    previousAt: previous ? toDateString(previous) : null,
    intervalCount: gaps.length,
    averageDays,
    nextEstimatedAt:
      gaps.length >= MIN_INTERVALS_FOR_ESTIMATE && averageDays !== null
        ? toDateString(addDaysToDate(last, averageDays))
        : null,
  };
}
