import { z } from "zod";

import { decimal, expectedUpdatedAt, nullableText, requiredText, uuid } from "@/lib/schemas/common";

/** Units offered as chips (E5-4); a stored value outside the list stays selectable. */
export const PART_UNITS = ["pc", "m", "l", "kg", "jeu"] as const;
export type PartUnit = (typeof PART_UNITS)[number];

export const PART_QUANTITY_MAX = 999_999;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;
const optionalUuid = z.preprocess(emptyToNull, uuid.nullable());

/**
 * Create or edit a part of the stock (E5-4, rule 11: upsert on the id drawn when the form
 * opened). A threshold of 0 means « no alert » (SPEC §5).
 */
export const upsertPartSchema = z.object({
  id: uuid,
  boatId: uuid,
  expectedUpdatedAt,
  name: requiredText(120),
  reference: nullableText(80),
  quantity: decimal({ scale: 2, max: PART_QUANTITY_MAX }),
  minQuantity: decimal({ scale: 2, max: PART_QUANTITY_MAX }),
  unit: requiredText(12),
  location: nullableText(80),
  categoryId: optionalUuid,
  supplierContactId: optionalUuid,
  notes: nullableText(2000),
});
export type UpsertPartInput = z.input<typeof upsertPartSchema>;
export type UpsertPartValues = z.output<typeof upsertPartSchema>;

/** One tap on + or − (E5-4): the database applies the delta atomically. */
export const adjustPartQuantitySchema = z.object({
  boatId: uuid,
  partId: uuid,
  delta: z
    .number()
    .min(-PART_QUANTITY_MAX)
    .max(PART_QUANTITY_MAX)
    .refine((value) => value !== 0, { message: "invalid" }),
});

/** Move a part to the trash, or bring it back from « Annuler » (D40). */
export const trashPartSchema = z.object({ boatId: uuid, partId: uuid });

/** Tick a low part off the « À racheter » checklist (D61): racheté, remis à bord. */
export const restockPartSchema = z.object({ boatId: uuid, partId: uuid });
