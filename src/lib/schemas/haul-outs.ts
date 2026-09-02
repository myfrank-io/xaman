import { z } from "zod";

import {
  expectedUpdatedAt,
  isoDate,
  nullableDecimal,
  nullableText,
  uuid,
} from "@/lib/schemas/common";

export const HAUL_OUT_COST_MAX = 9_999_999.99;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const optionalUuid = z.preprocess(emptyToNull, uuid.nullable());
const optionalDate = z.preprocess(emptyToNull, isoDate.nullable());

/**
 * Create or edit a haul-out (E6-1, flow g). Two separate dates, never a range picker
 * (ux-flows §4.3); `ended_at` empty means the boat is still ashore. `started_at` may be
 * in the future: a lift-out is booked before it happens.
 */
export const upsertHaulOutSchema = z
  .object({
    id: uuid,
    boatId: uuid,
    expectedUpdatedAt,
    startedAt: isoDate,
    endedAt: optionalDate,
    yardContactId: optionalUuid,
    yardName: nullableText(120),
    works: nullableText(4000),
    cost: nullableDecimal({ scale: 2, max: HAUL_OUT_COST_MAX }),
  })
  .refine((values) => values.endedAt === null || values.endedAt >= values.startedAt, {
    message: "haul_out_end_before_start",
    path: ["endedAt"],
  });
export type UpsertHaulOutInput = z.input<typeof upsertHaulOutSchema>;
export type UpsertHaulOutValues = z.output<typeof upsertHaulOutSchema>;

const haulOutRef = z.object({ boatId: uuid, haulOutId: uuid });

export const trashHaulOutSchema = haulOutRef;
export const restoreHaulOutSchema = haulOutRef;
