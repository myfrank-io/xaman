import { sortRows, type ChecklistRow } from "./rows";
import type { EngineReadDates } from "./completable";

export type ChecklistFilter = "all" | "todo" | "unrecorded" | "checked";

// An estimated anchor is not evidence that a check was performed. Upcoming checks reopen.
export function isChecklistChecked(row: ChecklistRow): boolean {
  return row.hasCompletion && row.status === "ok" && row.openLog === null;
}

export function filterChecklist(
  rows: ChecklistRow[],
  options: { filter: ChecklistFilter; categoryId: string; search: string },
): ChecklistRow[] {
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase("fr");
  const query = normalize(options.search.trim());
  const filtered = rows
    .filter(
      (row) =>
        (!options.categoryId || row.categoryId === options.categoryId) &&
        matchesChecklistFilter(row, options.filter) &&
        (!query ||
          normalize(`${row.label} ${row.categoryName} ${row.engineLabel ?? ""}`).includes(query)),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "fr"));
  return options.filter === "todo" ? sortRows(filtered, true) : filtered;
}

export type CompletionOverlay = {
  before: ChecklistRow;
  completed: ChecklistRow;
  undone: boolean;
};

/** Realtime props remain authoritative once the database has acknowledged the completion. */
export function overlayCompletion(row: ChecklistRow, overlay?: CompletionOverlay): ChecklistRow {
  if (!overlay) return row;
  if (!overlay.undone) {
    return row.lastCompletionId === overlay.before.lastCompletionId ? overlay.completed : row;
  }
  // Undo may run after the write has reached the props but before its deletion has.
  const matches =
    row.lastCompletedAt === overlay.completed.lastCompletedAt &&
    row.lastEngineHours === overlay.completed.lastEngineHours &&
    row.lastCompletedByName === overlay.completed.lastCompletedByName;
  return matches && row.lastCompletionId !== overlay.before.lastCompletionId ? overlay.before : row;
}

// Missing history is not an urgent job. SQL deadlines and planned work remain authoritative.
export function matchesChecklistFilter(row: ChecklistRow, filter: ChecklistFilter): boolean {
  if (filter === "all") return true;
  if (filter === "checked") return isChecklistChecked(row);
  if (filter === "unrecorded") return !row.hasCompletion;
  return row.status === "overdue" || row.status === "soon" || row.openLog !== null;
}

export function needsCompletionDetails(
  row: ChecklistRow,
  dates: EngineReadDates,
  today: string,
): boolean {
  if (row.fixedDueAt || row.openLog) return true;
  if (row.engineTracksHours && row.intervalHours !== null) {
    return row.currentHours === null || !row.engineId || dates[row.engineId] !== today;
  }
  return false;
}
