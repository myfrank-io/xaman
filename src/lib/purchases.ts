import { resolveRange, type DateRange } from "@/lib/expenses";
import { PURCHASE_KINDS, type PurchaseKind } from "@/lib/schemas/purchases";

/**
 * List state of the purchases tab (E5-2), kept in the URL. « Toute la période » is the
 * default here — unlike the expenses tab, the question is « qu'ai-je acheté », and a
 * twelve-month window would silently hide the paper logbook import.
 */
export const PURCHASE_PERIODS = ["all", "rolling12", "year", "custom"] as const;
export type PurchasePeriod = (typeof PURCHASE_PERIODS)[number];

/** « Charger plus » adds one page; the page size is the same everywhere (E5-2). */
export const PURCHASE_PAGE_SIZE = 20;

export function isPurchasePeriod(value: string | undefined): value is PurchasePeriod {
  return PURCHASE_PERIODS.includes(value as PurchasePeriod);
}

export function isPurchaseKind(value: string | undefined): value is PurchaseKind {
  return PURCHASE_KINDS.includes(value as PurchaseKind);
}

/** null = no date bound at all. */
export function resolvePurchaseRange(
  period: PurchasePeriod,
  custom: Partial<DateRange>,
  today: string | Date = new Date(),
): DateRange | null {
  if (period === "all") return null;
  return resolveRange(period, custom, today);
}

/** Rounds a `?limit=` parameter to a whole number of pages, between one and fifty. */
export function parsePurchaseLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return PURCHASE_PAGE_SIZE;
  const pages = Math.ceil(parsed / PURCHASE_PAGE_SIZE);
  return Math.min(50, Math.max(1, pages)) * PURCHASE_PAGE_SIZE;
}
