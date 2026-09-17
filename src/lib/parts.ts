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
 * Low stock (SPEC §5, D10, D143): a threshold is set (> 0) and the quantity is **under** it.
 * Mirrors rank 5 of `boat_todo_queue` (`0045`), which lists the same lines.
 *
 * Strictly under since D143: a threshold is the level one wants to keep in reserve, so holding
 * exactly it is not a shortage — and « Racheté », which buys what is short, has to clear the line
 * it was meant to clear.
 */
export function isLowStock({ quantity, minQuantity }: StockLine): boolean {
  return minQuantity > 0 && quantity < minQuantity;
}

/**
 * What « Racheté » buys (D143): what the line is short of, never less than one unit. Buying it
 * puts the part back at its threshold, which is exactly where its owner asked it to be.
 */
export function restockQuantity({ quantity, minQuantity }: StockLine): number {
  return Math.max(1, Math.round((minQuantity - quantity) * 100) / 100);
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
