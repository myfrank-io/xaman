import { differenceInCalendarDays } from "date-fns";

import { toDate } from "@/lib/format";

/**
 * Days between the lift-out and the launch — or today while the boat is still ashore, which
 * is what the « À TERRE depuis 12 jours » badge counts (E6-1, flow g).
 */
export function daysAshore(startedAt: string, endedAt: string | null): number {
  const start = toDate(startedAt);
  if (!start) return 0;
  const end = toDate(endedAt) ?? new Date();
  return Math.max(0, differenceInCalendarDays(end, start));
}
