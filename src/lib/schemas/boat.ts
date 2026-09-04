import { z } from "zod";

import { normaliseRegistration } from "@/lib/boat-registration";
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

/**
 * The registration number issued by the maritime administration (FR: immatriculation).
 *
 * Stored uppercase and single-spaced so the same number typed two ways is one value, and
 * otherwise free text: there is no list to check it against and no registry to look it up in.
 * The form shows a hint when the shape is not the current French one; nothing refuses it.
 */
const registration = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalised = normaliseRegistration(value);
  return normalised === "" ? null : normalised;
}, z.string().max(32).nullable());

export const updateBoatSchema = z.object({
  boatId: uuid,
  expectedUpdatedAt,
  name: requiredText(80),
  type: boatTypeSchema,
  builder: nullableText(80),
  model: nullableText(80),
  hullNumber: nullableText(40),
  registration,
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
  /**
   * The catalogue row that was tapped, if one was (D69). It contributes the dimensions and
   * nothing else, server-side — the client sends a reference, never measurements. Null whenever
   * the boat was typed by hand, which stays the ordinary case.
   */
  boatModelId: uuid.nullable().default(null),
});
export type CreateBoatInput = z.input<typeof createBoatSchema>;
