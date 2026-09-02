import { z } from "zod";

import {
  expectedUpdatedAt,
  nullableDecimal,
  nullableText,
  pastOrTodayDate,
  requiredText,
  uuid,
} from "@/lib/schemas/common";

/** The five values of the `purchase_kind` enum (0001_init.sql §3.16). */
export const PURCHASE_KINDS = ["gas", "part", "consumable", "service", "other"] as const;
export const purchaseKindSchema = z.enum(PURCHASE_KINDS);
export type PurchaseKind = z.infer<typeof purchaseKindSchema>;

/**
 * Four chips in the form (E5-2): « consumable » stays a legal enum value — the paper
 * logbook import uses it — but it is never offered, and it is read as « Pièce ».
 */
export const VISIBLE_PURCHASE_KINDS = ["gas", "part", "service", "other"] as const;
export type VisiblePurchaseKind = (typeof VISIBLE_PURCHASE_KINDS)[number];

/** Label bucket of a stored kind: `consumable` rows read as « Pièce » (E5-2). */
export function purchaseKindLabelKey(kind: PurchaseKind): VisiblePurchaseKind {
  return kind === "consumable" ? "part" : kind;
}

export const PURCHASE_AMOUNT_MAX = 9_999_999.99;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalUuid = z.preprocess(emptyToNull, uuid.nullable());

/**
 * Create or edit a purchase (E5-2, rule 11: upsert on the id drawn when the form opened).
 * No quantity and no currency in the UI: the columns keep their defaults (audit, E5-2).
 * An empty amount stays null — « inconnu » is not « gratuit » (ux-flows §4.2).
 */
export const upsertPurchaseSchema = z.object({
  id: uuid,
  boatId: uuid,
  expectedUpdatedAt,
  kind: purchaseKindSchema,
  designation: requiredText(160),
  amount: nullableDecimal({ scale: 2, max: PURCHASE_AMOUNT_MAX }),
  purchasedAt: pastOrTodayDate,
  supplierContactId: optionalUuid,
  supplierName: nullableText(120),
  categoryId: optionalUuid,
  bottleType: nullableText(60),
  maintenanceLogId: optionalUuid,
  notes: nullableText(2000),
  /** Set on save: a line the user has just typed is not « à vérifier ». */
  needsReview: z.boolean().default(false),
});
export type UpsertPurchaseInput = z.input<typeof upsertPurchaseSchema>;
export type UpsertPurchaseValues = z.output<typeof upsertPurchaseSchema>;

const purchaseRef = z.object({ boatId: uuid, purchaseId: uuid });

export const trashPurchaseSchema = purchaseRef;
export const restorePurchaseSchema = purchaseRef;
export const markPurchaseReviewedSchema = purchaseRef;
