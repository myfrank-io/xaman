import { z } from "zod";

import { addDays, toIsoDate } from "@/lib/numbers";
import {
  expectedUpdatedAt,
  isoDate,
  nullableDecimal,
  nullableText,
  requiredText,
  uuid,
} from "@/lib/schemas/common";
import { ENGINE_HOURS_MAX } from "@/lib/schemas/engines";

export const LOG_STATUSES = ["done", "planned", "in_progress", "urgent"] as const;
export const logStatusSchema = z.enum(LOG_STATUSES);
export type LogStatusValue = (typeof LOG_STATUSES)[number];

// D7: the segmented control shows three states, « Urgent » is a toggle on top of them.
export const SEGMENT_STATUSES = ["done", "planned", "in_progress"] as const;

/** A future date only makes sense for work that has not happened yet (D17). */
export const FUTURE_ALLOWED_STATUSES: LogStatusValue[] = ["planned", "urgent"];

export const COST_MAX = 9_999_999.99;

/** How many systems one intervention may carry (D118): a boat has a dozen, a visit never all. */
export const LOG_CATEGORIES_MAX = 6;

const emptyToNull = (value: unknown) => (value === "" ? null : value);

const engineHoursEntry = z.object({
  engineId: uuid,
  // empty = no reading at all for this engine (ux-flows §3a); never converted to 0
  hours: nullableDecimal({ scale: 1, max: ENGINE_HOURS_MAX }),
});

/**
 * « + J'ai fait… » (E3-3, D3): one form, one Server Action — the intervention, the engine
 * readings it carries and the checklist points it acknowledges are saved together.
 */
export const saveLogSchema = z
  .object({
    id: uuid,
    boatId: uuid,
    expectedUpdatedAt,
    title: requiredText(160),
    /**
     * The systems this intervention touches (D118). One visit of the mechanic is often three
     * of them — vidange, anode, gréement — and the single column made the person pick the least
     * wrong one. The first is the principal: it is what `maintenance_logs.category_id` keeps,
     * and with it every filter, the report and the export that already read that column.
     *
     * Required from the UI; the column stays nullable for imported rows only (ux-flows §3a).
     */
    categoryIds: z.array(uuid).min(1).max(LOG_CATEGORIES_MAX),
    status: logStatusSchema,
    performedAt: isoDate,
    cost: nullableDecimal({ scale: 2, max: COST_MAX }),
    contactId: z.preprocess(emptyToNull, uuid.nullable()),
    equipmentId: z.preprocess(emptyToNull, uuid.nullable()),
    haulOutId: z.preprocess(emptyToNull, uuid.nullable()),
    notes: nullableText(4000),
    engineHours: z.array(engineHoursEntry).max(20),
    // checklist points ticked by this intervention (completions carry maintenance_log_id)
    checklistItemIds: z.array(uuid).max(20),
    /**
     * The point this intervention IS the doing of (D140): the tick that wrote it, « Confier au
     * chantier », or « + Ajouter les détails » from a point. The database derives that point's
     * completion from the row; the list above is for the other points a visit also covers.
     * Optional so a line queued or drafted before D140 still saves; absent means « unchanged ».
     */
    checklistItemId: z.preprocess(emptyToNull, uuid.nullable()).optional(),
  })
  .superRefine((value, ctx) => {
    const future = value.performedAt > addDays(toIsoDate(), 1);
    if (future && !FUTURE_ALLOWED_STATUSES.includes(value.status)) {
      ctx.addIssue({ code: "custom", path: ["performedAt"], message: "date_in_future_done" });
    }
  });

/** The system the row keeps in its own column: the first one chosen (D118). */
export function primaryCategoryId(categoryIds: string[]): string {
  return categoryIds[0] ?? "";
}

export const trashLogSchema = z.object({
  boatId: uuid,
  logId: uuid,
});

export const titleSuggestionsSchema = z.object({
  boatId: uuid,
  query: z.string().trim().min(2).max(160),
});

export const suggestItemsSchema = z.object({
  boatId: uuid,
  // Every system the intervention carries: a « vidange + anode » proposes the points of both.
  categoryIds: z.array(uuid).min(1).max(LOG_CATEGORIES_MAX),
  title: z.string().trim().min(3).max(160),
});

// « En faire un entretien récurrent » (E3-4): the intervention becomes a checklist point,
// anchored on its own date and acknowledged by itself.
export const RECURRING_MONTHS = [3, 6, 12, 24, 36] as const;

export const recurringFromLogSchema = z
  .object({
    boatId: uuid,
    logId: uuid,
    itemId: uuid,
    intervalMonths: z.union([
      z.literal(3),
      z.literal(6),
      z.literal(12),
      z.literal(24),
      z.literal(36),
    ]),
    intervalHours: z.preprocess(
      (value) => (value === "" || value === null || value === undefined ? null : Number(value)),
      z.number().int().min(1).max(20_000).nullable(),
    ),
    engineId: z.preprocess(emptyToNull, uuid.nullable()),
  })
  .superRefine((value, ctx) => {
    if (value.intervalHours !== null && !value.engineId) {
      ctx.addIssue({ code: "custom", path: ["engineId"], message: "engine_required" });
    }
  });

// Guided review of the imported rows (E3-7, D24). One submission validates every line.
const reviewLogEntry = z.object({
  logId: uuid,
  performedAt: isoDate,
  // engineId → hours; an ignored or empty engine is simply absent from the map
  hours: z.array(
    z.object({
      engineId: uuid,
      hours: nullableDecimal({ scale: 1, max: ENGINE_HOURS_MAX }),
    }),
  ),
});

const reviewPurchaseEntry = z.object({
  purchaseId: uuid,
  purchasedAt: isoDate,
  designation: requiredText(200),
  amount: nullableDecimal({ scale: 2, max: COST_MAX }),
});

export const submitReviewSchema = z.object({
  boatId: uuid,
  logs: z.array(reviewLogEntry).max(200),
  purchases: z.array(reviewPurchaseEntry).max(200),
});
