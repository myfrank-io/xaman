import { z } from "zod";

import {
  expectedUpdatedAt,
  isoDate,
  nullableDecimal,
  nullableInteger,
  nullableText,
  pastOrTodayDate,
  requiredText,
  uuid,
} from "@/lib/schemas/common";
import { ENGINE_HOURS_MAX } from "@/lib/schemas/engines";

export const INTERVAL_MONTH_PRESETS = [3, 6, 12, 24, 36] as const;

const emptyToNull = (value: unknown) => (value === "" ? null : value);

// « Marquer comme fait » (E4-5). The optional fixed expiry wins over the interval (D11).
export const completeItemSchema = z
  .object({
    id: uuid,
    boatId: uuid,
    itemId: uuid,
    completedAt: pastOrTodayDate,
    completedBy: z.preprocess(emptyToNull, uuid.nullable()),
    completedByName: nullableText(120),
    engineHours: nullableDecimal({ scale: 1, max: ENGINE_HOURS_MAX }),
    nextDueAt: z.preprocess(emptyToNull, isoDate.nullable()),
    note: nullableText(2000),
  })
  .superRefine((value, ctx) => {
    if (value.nextDueAt && value.nextDueAt <= value.completedAt) {
      ctx.addIssue({ code: "custom", path: ["nextDueAt"], message: "next_due_after" });
    }
  });
export type CompleteItemInput = z.input<typeof completeItemSchema>;

export const deleteCompletionSchema = z.object({
  boatId: uuid,
  completionId: uuid,
});

// Custom or edited checklist item (E4-6).
export const upsertChecklistItemSchema = z
  .object({
    id: uuid,
    boatId: uuid,
    expectedUpdatedAt,
    categoryId: uuid,
    label: requiredText(160),
    description: nullableText(4000),
    intervalMonths: nullableInteger(1, 240),
    intervalHours: nullableInteger(1, 20_000),
    engineId: z.preprocess(emptyToNull, uuid.nullable()),
    actions: z
      .array(z.string().trim().max(500))
      .max(50)
      .transform((steps) => steps.filter((step) => step.length > 0)),
    // « dernière réalisation connue » — null keeps the current anchor
    anchorDate: z.preprocess(emptyToNull, pastOrTodayDate.nullable()),
  })
  .superRefine((value, ctx) => {
    if (value.intervalHours !== null && !value.engineId) {
      ctx.addIssue({ code: "custom", path: ["engineId"], message: "engine_required" });
    }
  });

export const setItemActiveSchema = z.object({
  boatId: uuid,
  itemId: uuid,
  isActive: z.boolean(),
});

// Start-up wizard (D2): rough age of the last completion per item.
export const WIZARD_AGES = ["never", "recent", "year", "old"] as const;
export type WizardAge = (typeof WIZARD_AGES)[number];
// months subtracted from today to build anchor_date
export const WIZARD_AGE_MONTHS: Record<WizardAge, number> = {
  never: 0,
  recent: 3,
  year: 12,
  old: 30,
};

export const anchorItemsSchema = z.object({
  boatId: uuid,
  items: z
    .array(
      z.object({
        itemId: uuid,
        keep: z.boolean(),
        age: z.enum(WIZARD_AGES).nullable(),
      }),
    )
    .min(1)
    .max(500),
});
