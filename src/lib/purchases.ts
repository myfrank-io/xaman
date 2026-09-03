import { PURCHASE_KINDS, type PurchaseKind } from "@/lib/schemas/purchases";

/** « Charger plus » adds one page; the page size is the same everywhere (E5-2). */
export const PURCHASE_PAGE_SIZE = 20;

export function isPurchaseKind(value: string | undefined): value is PurchaseKind {
  return PURCHASE_KINDS.includes(value as PurchaseKind);
}

/** Rounds a `?limit=` parameter to a whole number of pages, between one and fifty. */
export function parsePurchaseLimit(value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return PURCHASE_PAGE_SIZE;
  const pages = Math.ceil(parsed / PURCHASE_PAGE_SIZE);
  return Math.min(50, Math.max(1, pages)) * PURCHASE_PAGE_SIZE;
}
