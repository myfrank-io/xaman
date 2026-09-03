import { z } from "zod";

import {
  expectedUpdatedAt,
  integer,
  isoDate,
  nullableText,
  requiredText,
  uuid,
} from "@/lib/schemas/common";

export const equipmentSpecSchema = z.object({
  key: requiredText(60),
  value: z.string().trim().max(200),
});
export type EquipmentSpec = z.infer<typeof equipmentSpecSchema>;

export const upsertEquipmentSchema = z.object({
  id: uuid,
  boatId: uuid,
  expectedUpdatedAt,
  categoryId: z.preprocess((value) => (value === "" ? null : value), uuid.nullable()),
  name: requiredText(120),
  brand: nullableText(80),
  model: nullableText(80),
  serial: nullableText(80),
  quantity: integer(0, 9999).default(1),
  installedAt: isoDate.nullable(),
  specs: z.array(equipmentSpecSchema).max(40).default([]),
  notes: nullableText(4000),
});
export type UpsertEquipmentInput = z.input<typeof upsertEquipmentSchema>;

// Equipment is never deleted: it is marked as removed on a date (E2-3).
export const removeEquipmentSchema = z.object({
  boatId: uuid,
  equipmentId: uuid,
  removedAt: isoDate,
});

export const restoreEquipmentSchema = z.object({
  boatId: uuid,
  equipmentId: uuid,
});

// « Supprimer » (D61): the trash, not « Déposer ». No date — it is deleted now.
export const deleteEquipmentSchema = z.object({
  boatId: uuid,
  equipmentId: uuid,
});
