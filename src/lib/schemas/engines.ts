import { z } from "zod";

import {
  decimal,
  expectedUpdatedAt,
  isoDate,
  nullableText,
  pastOrTodayDate,
  requiredText,
  uuid,
} from "@/lib/schemas/common";

export const enginePositionSchema = z.enum(["port", "starboard", "center", "outboard"]);
export type EnginePosition = z.infer<typeof enginePositionSchema>;

export const ENGINE_HOURS_MAX = 99_999.9;
// A jump larger than this since the previous reading triggers a soft warning (UX §3e).
export const ENGINE_HOURS_JUMP_WARNING = 500;

// Create or edit (upsert on id, CLAUDE.md rule 11).
export const upsertEngineSchema = z.object({
  id: uuid,
  boatId: uuid,
  expectedUpdatedAt,
  label: requiredText(60),
  position: enginePositionSchema,
  brand: nullableText(60),
  model: nullableText(60),
  serial: nullableText(60),
  installedAt: isoDate.nullable(),
  notes: nullableText(2000),
});
export type UpsertEngineInput = z.input<typeof upsertEngineSchema>;

export const setEngineActiveSchema = z.object({
  boatId: uuid,
  engineId: uuid,
  isActive: z.boolean(),
});

export const addHourReadingSchema = z.object({
  id: uuid,
  boatId: uuid,
  engineId: uuid,
  hours: decimal({ scale: 1, max: ENGINE_HOURS_MAX }),
  readAt: pastOrTodayDate,
  note: nullableText(500),
  // D12: the counter was replaced, the lower value is legitimate
  counterReplaced: z.boolean().default(false),
});
export type AddHourReadingInput = z.input<typeof addHourReadingSchema>;

export const updateHourReadingSchema = z.object({
  boatId: uuid,
  readingId: uuid,
  expectedUpdatedAt,
  hours: decimal({ scale: 1, max: ENGINE_HOURS_MAX }),
  readAt: pastOrTodayDate,
  note: nullableText(500),
});

export const deleteHourReadingSchema = z.object({
  boatId: uuid,
  readingId: uuid,
});

export const generateEngineChecklistSchema = z.object({
  boatId: uuid,
  engineId: uuid,
});
