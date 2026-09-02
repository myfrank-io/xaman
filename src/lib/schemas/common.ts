import { z } from "zod";

import { addDays, parseDecimal, roundTo, toIsoDate } from "@/lib/numbers";

// Any 8-4-4-4-12 hex id: the app generates v4 ids (crypto.randomUUID) but the dev seed and
// imported rows carry ids without a version nibble, which zod's uuid() rejects.
export const uuid = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Never in the future (D17). One day of tolerance: the server runs in UTC, the iPad in its own zone.
export const pastOrTodayDate = isoDate.refine((value) => value <= addDays(toIsoDate(), 1), {
  message: "date_in_future",
});

// "" and whitespace become null so an emptied field clears the column.
export function nullableText(max: number) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? null : value),
    z.string().trim().max(max).nullable(),
  );
}

export function requiredText(max: number) {
  return z.string().trim().min(1).max(max);
}

type DecimalOptions = { scale: number; min?: number; max?: number };

// Numbers typed by hand ("1 256,5"); see CLAUDE.md rule 13.
export function decimal({ scale, min = 0, max = 99_999_999 }: DecimalOptions) {
  return z.preprocess(
    (value) => parseDecimal(value),
    z
      .number()
      .min(min)
      .max(max)
      .transform((value) => roundTo(value, scale)),
  );
}

export function nullableDecimal(options: DecimalOptions) {
  return z.preprocess(
    (value) => parseDecimal(value),
    z
      .number()
      .min(options.min ?? 0)
      .max(options.max ?? 99_999_999)
      .transform((value) => roundTo(value, options.scale))
      .nullable(),
  );
}

export function integer(min: number, max: number) {
  return z.preprocess((value) => parseDecimal(value), z.number().int().min(min).max(max));
}

export function nullableInteger(min: number, max: number) {
  return z.preprocess(
    (value) => parseDecimal(value),
    z.number().int().min(min).max(max).nullable(),
  );
}

// Optimistic concurrency (D27): the row's updated_at seen by the form, compared on update.
export const expectedUpdatedAt = z.string().datetime({ offset: true }).optional();
