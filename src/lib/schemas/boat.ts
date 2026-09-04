import { z } from "zod";

import {
  expectedUpdatedAt,
  nullableDecimal,
  nullableInteger,
  nullableText,
  requiredText,
  uuid,
} from "@/lib/schemas/common";
import { enginePositionSchema } from "@/lib/schemas/engines";

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

/**
 * Onboarding (D65): what it takes to open a carnet — the boat, and nothing about maintenance.
 *
 * Identity and maintenance plan are two questions. This one asks only the first: what is this
 * boat. `builder` and `model` are free text, so a boat whose builder has published nothing is
 * still named exactly rather than filed under « générique »; the hull type is what gives the boat
 * its systems, server-side.
 *
 * The engines are asked here because `apply_checklist_template` only duplicates an engine-scoped
 * point for engines that already exist, and those carry every hour-based interval — a plan chosen
 * later would otherwise miss « Vidange huile ». One toggle, pre-set from the hull; the labels come
 * from `fr.json`, never from SQL (rule 7).
 */
export const NEW_BOAT_ENGINES_MAX = 6;

export const newBoatEngineSchema = z.object({
  label: requiredText(60),
  position: enginePositionSchema,
});

export const createBoatSchema = z.object({
  boatId: uuid,
  name: requiredText(80),
  type: boatTypeSchema,
  builder: nullableText(80),
  model: nullableText(80),
  engines: z.array(newBoatEngineSchema).max(NEW_BOAT_ENGINES_MAX).default([]),
});
export type CreateBoatInput = z.input<typeof createBoatSchema>;
