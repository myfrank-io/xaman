import { describe, expect, it } from "vitest";
import {
  filterChecklist,
  isChecklistChecked,
  overlayCompletion,
} from "../../src/components/checklist/board";
import type { ChecklistRow } from "../../src/components/checklist/rows";

const row = (over: Partial<ChecklistRow> = {}): ChecklistRow => ({
  id: "point",
  label: "Contrôler le gréement",
  description: null,
  actions: [],
  categoryId: "sails",
  categoryName: "Voiles",
  categoryColor: "#000000",
  engineId: null,
  engineLabel: null,
  engineTracksHours: true,
  intervalMonths: 12,
  intervalHours: null,
  sortOrder: 0,
  anchorDate: null,
  anchorHours: null,
  counterResetAt: null,
  currentHours: null,
  hasCompletion: true,
  lastCompletionId: "old",
  lastCompletedAt: "2025-09-21",
  lastCompletedByName: "Xavier",
  lastEngineHours: null,
  fixedDueAt: null,
  status: "ok",
  dueAt: "2026-09-21",
  dueHours: null,
  daysRemaining: 100,
  hoursRemaining: null,
  openLog: null,
  ...over,
});

describe("checklist landing page", () => {
  it("never treats an estimated date as a performed control", () => {
    expect(isChecklistChecked(row({ hasCompletion: false }))).toBe(false);
    expect(isChecklistChecked(row())).toBe(true);
  });
  it("reopens soon, overdue and delegated controls", () => {
    for (const status of ["never", "soon", "overdue"] as const)
      expect(isChecklistChecked(row({ status }))).toBe(false);
    expect(
      isChecklistChecked(
        row({ openLog: { id: "log", at: "2026-10-01", status: "planned", contactName: null } }),
      ),
    ).toBe(false);
  });
  it("combines accent-insensitive search, system and state without losing punctual checks", () => {
    const rows = [
      row({ id: "never", hasCompletion: false, intervalMonths: null }),
      row({ id: "done" }),
      row({ id: "other", categoryId: "engines", hasCompletion: false }),
    ];
    expect(
      filterChecklist(rows, { filter: "todo", categoryId: "sails", search: "GREEMENT" }).map(
        (r) => r.id,
      ),
    ).toEqual(["never"]);
    expect(
      filterChecklist(rows, { filter: "checked", categoryId: "", search: "" }).map((r) => r.id),
    ).toEqual(["done"]);
  });
  it("retains a queued completion until acknowledged, then accepts realtime updates", () => {
    const before = row({ status: "overdue" });
    const completed = row({ lastCompletionId: "optimistic", lastCompletedAt: "2026-09-21" });
    const overlay = { before, completed, undone: false };
    expect(overlayCompletion(before, overlay)).toBe(completed);
    const acknowledged = row({ ...completed, lastCompletionId: "server-id" });
    expect(overlayCompletion(acknowledged, overlay)).toBe(acknowledged);
    expect(overlayCompletion(acknowledged, { ...overlay, undone: true })).toBe(before);
    expect(overlayCompletion(before, { ...overlay, undone: true })).toBe(before);
    const remote = row({ lastCompletionId: "another-user", lastCompletedAt: "2026-09-22" });
    expect(overlayCompletion(remote, { ...overlay, undone: true })).toBe(remote);
  });
});
