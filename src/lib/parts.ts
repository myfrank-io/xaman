import { differenceInMonths } from "date-fns";

import { toDate, todayString } from "@/lib/format";

/** The two views of the stock tab (E5-4): everything, or only what is to be bought back. */
export const STOCK_FILTERS = ["all", "low"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];

export function isStockFilter(value: string | null | undefined): value is StockFilter {
  return (STOCK_FILTERS as readonly string[]).includes(value ?? "");
}

export type StockLine = { quantity: number; minQuantity: number };

/**
 * Low stock (SPEC §5, D10): a threshold is set (> 0) and the quantity is at or under it.
 * Mirrors `boat_dashboard_stats.low_stock_parts` (0003), which counts the same lines.
 */
export function isLowStock({ quantity, minQuantity }: StockLine): boolean {
  return minQuantity > 0 && quantity <= minQuantity;
}

/**
 * « Racheté et remis à bord » from the restock checklist (D61): buying a low part back clears
 * its alert, so its quantity climbs just above the threshold (min + 1). The delta to apply,
 * `0` when the line is not (or no longer) low — the check stays a no-op, so a list gone stale
 * on another device never overshoots. Derived from the same numbers `isLowStock` reads: the
 * « À racheter » list is a view of the stock, never a second entry.
 */
export function restockDelta({ quantity, minQuantity }: StockLine): number {
  if (!isLowStock({ quantity, minQuantity })) return 0;
  return minQuantity + 1 - quantity;
}

/** Whole months since the line was last counted; null when it never was. */
export function monthsSinceCheck(
  checkedAt: string | null | undefined,
  today: string = todayString(),
): number | null {
  const checked = toDate(checkedAt);
  const reference = toDate(today);
  if (!checked || !reference) return null;
  return Math.max(0, differenceInMonths(reference, checked));
}

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

/** A flat list, alphabetical: the badge and the filter tell what is low, not the order. */
export function sortStock<T extends { name: string }>(parts: readonly T[]): T[] {
  return [...parts].sort((a, b) => collator.compare(a.name, b.name));
}

export function applyStockFilter<T extends StockLine>(
  parts: readonly T[],
  filter: StockFilter,
): T[] {
  return filter === "low" ? parts.filter((part) => isLowStock(part)) : [...parts];
}

export function countLowStock(parts: readonly StockLine[]): number {
  return parts.filter((part) => isLowStock(part)).length;
}
