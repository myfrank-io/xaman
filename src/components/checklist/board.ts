import type { ChecklistRow } from "./rows";

export type ChecklistFilter = "all" | "todo" | "checked";

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
  return rows
    .filter(
      (row) =>
        (!options.categoryId || row.categoryId === options.categoryId) &&
        (options.filter === "all" || isChecklistChecked(row) === (options.filter === "checked")) &&
        (!query ||
          normalize(`${row.label} ${row.categoryName} ${row.engineLabel ?? ""}`).includes(query)),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label, "fr"));
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
