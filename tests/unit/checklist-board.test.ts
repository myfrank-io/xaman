import { describe, expect, it } from "vitest";
import {
  filterChecklist,
  isChecklistChecked,
  overlayCompletion,
  matchesChecklistFilter,
  needsCompletionDetails,
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
      filterChecklist(rows, { filter: "unrecorded", categoryId: "sails", search: "GREEMENT" }).map(
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
  it("keeps unknown history separate from approaching deadlines", () => {
    expect(matchesChecklistFilter(row({ hasCompletion: false, status: "never" }), "todo")).toBe(
      false,
    );
    expect(matchesChecklistFilter(row({ hasCompletion: false, status: "overdue" }), "todo")).toBe(
      true,
    );
    expect(
      matchesChecklistFilter(row({ hasCompletion: false, status: "overdue" }), "unrecorded"),
    ).toBe(true);
    expect(
      matchesChecklistFilter(
        row({
          status: "ok",
          openLog: { id: "l", status: "planned", at: "2026-09-22", contactName: null },
        }),
        "todo",
      ),
    ).toBe(true);
  });
  it("orders the most overdue points before closer ones across systems", () => {
    const items = [
      row({ id: "soon", categoryId: "engines", status: "soon", daysRemaining: 2 }),
      row({ id: "late", categoryId: "sails", status: "overdue", daysRemaining: -100 }),
      row({ id: "late2", categoryId: "safety", status: "overdue", daysRemaining: -10 }),
    ];
    expect(
      filterChecklist(items, { filter: "todo", categoryId: "", search: "" }).map((item) => item.id),
    ).toEqual(["late", "late2", "soon"]);
  });
  it("asks for a stale or missing engine reading but accepts today's counter", () => {
    const item = row({ engineId: "engine", intervalHours: 200, currentHours: 500 });
    expect(needsCompletionDetails(item, { engine: "2026-09-20" }, "2026-09-21")).toBe(true);
    expect(needsCompletionDetails(item, {}, "2026-09-21")).toBe(true);
    expect(
      needsCompletionDetails(
        { ...item, currentHours: null },
        { engine: "2026-09-21" },
        "2026-09-21",
      ),
    ).toBe(true);
    expect(needsCompletionDetails(item, { engine: "2026-09-21" }, "2026-09-21")).toBe(false);
    expect(needsCompletionDetails({ ...item, engineTracksHours: false }, {}, "2026-09-21")).toBe(
      false,
    );
  });
  it("asks for the renewal date and for work already handed to someone", () => {
    expect(needsCompletionDetails(row({ fixedDueAt: "2026-12-31" }), {}, "2026-09-21")).toBe(true);
    expect(
      needsCompletionDetails(
        row({ openLog: { id: "l", status: "planned", at: "2026-09-22", contactName: "Chantier" } }),
        {},
        "2026-09-21",
      ),
    ).toBe(true);
  });
});
