import { differenceInCalendarDays } from "date-fns";

import { toDate } from "@/lib/format";

/**
 * Past this age an hour reading is flagged « à mettre à jour » (ux-flows §2.2). Without a recent
 * reading every hour-based deadline is wrong, which is why the dashboard chip and the engines
 * tab both turn the date amber — off the same threshold, so the two surfaces can never disagree
 * about what « stale » means.
 */
const STALE_READING_DAYS = 60;

/** `today` is only ever passed by tests; the screens read the clock. */
export function isReadingStale(readAt: string | Date | null | undefined, today?: Date): boolean {
  const date = toDate(readAt);
  if (!date) return false;
  return differenceInCalendarDays(today ?? new Date(), date) > STALE_READING_DAYS;
}
