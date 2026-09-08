import type { CompletableItem } from "@/components/checklist/CompleteItemDialog";
import type { ChecklistRow } from "@/components/checklist/rows";

/** When the last reading of each engine was taken, by engine id (`engine_current_hours.read_at`). */
export type EngineReadDates = Record<string, string | null>;

/**
 * The row a list shows, as the « Fait » dialog needs it. Written once and used by the three
 * screens that carry the button (dashboard queue, « À traiter », a category): the dialog fills
 * the hours by itself only when the reading behind them is fresh, and asks « Valide jusqu'au »
 * only where an expiry already exists — both of which it can only decide if every caller hands
 * it the same facts. They used to hand it `lastDate: null`, so neither ever fired.
 */
export function toCompletable(row: ChecklistRow, readDates?: EngineReadDates): CompletableItem {
  return {
    id: row.id,
    label: row.label,
    categoryName: row.categoryName,
    intervalMonths: row.intervalMonths,
    intervalHours: row.intervalHours,
    engine: row.engineId
      ? {
          id: row.engineId,
          label: row.engineLabel ?? "",
          lastHours: row.currentHours,
          lastDate: readDates?.[row.engineId] ?? null,
          tracksHours: row.engineTracksHours,
        }
      : null,
    lastCompletedAt: row.lastCompletedAt,
    lastCompletedByName: row.lastCompletedByName,
    lastEngineHours: row.lastEngineHours,
    fixedDueAt: row.fixedDueAt,
  };
}
