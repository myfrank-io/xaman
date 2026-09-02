import { z } from "zod";

import {
  expectedUpdatedAt,
  nullableDecimal,
  nullableInteger,
  nullableText,
  requiredText,
  uuid,
} from "@/lib/schemas/common";

export const boatTypeSchema = z.enum([
  "catamaran",
  "trimaran",
  "monohull_sail",
  "motor",
  "rib",
  "other",
]);
export type BoatType = z.infer<typeof boatTypeSchema>;

export const updateBoatSchema = z.object({
  boatId: uuid,
  expectedUpdatedAt,
  name: requiredText(80),
  type: boatTypeSchema,
  builder: nullableText(80),
  model: nullableText(80),
  hullNumber: nullableText(40),
  year: nullableInteger(1900, 2100),
  flag: nullableText(60),
  homePort: nullableText(80),
  sailNumber: nullableText(40),
  lengthM: nullableDecimal({ scale: 2, max: 999 }),
  beamM: nullableDecimal({ scale: 2, max: 999 }),
  draftM: nullableDecimal({ scale: 2, max: 99 }),
  notes: nullableText(4000),
});
export type UpdateBoatInput = z.input<typeof updateBoatSchema>;

// Deleting a boat requires typing its name (E2-5).
export const deleteBoatSchema = z.object({
  boatId: uuid,
  confirmName: requiredText(80),
});
