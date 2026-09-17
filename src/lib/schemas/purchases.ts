import { z } from "zod";

import {
  decimal,
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
/** Units of one line: the stock movement a purchase of a part carries (D143). */
export const PURCHASE_QUANTITY_MAX = 999_999;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalUuid = z.preprocess(emptyToNull, uuid.nullable());

/**
 * Create or edit a purchase (E5-2, rule 11: upsert on the id drawn when the form opened).
 * No currency in the UI, and no quantity in the *form*: the columns keep their defaults
 * (audit, E5-2). Since D143 « Racheté » sends both `partId` and `quantity`, because there a
 * purchase *is* stock coming in. An empty amount stays null — « inconnu » is not « gratuit »
 * (ux-flows §4.2).
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
  /**
   * The part this purchase restocks (D143), and how many units it brought in. Both are
   * **optional**, and absent means « leave them as they are »: the purchase form does not carry
   * them, so editing a line written by « Racheté » must not silently unhook it from the stock.
   */
  partId: optionalUuid.optional(),
  quantity: decimal({ scale: 2, max: PURCHASE_QUANTITY_MAX })
    .refine((value) => value > 0, { message: "invalid" })
    .optional(),
});

const purchaseRef = z.object({ boatId: uuid, purchaseId: uuid });

export const trashPurchaseSchema = purchaseRef;
export const markPurchaseReviewedSchema = purchaseRef;
