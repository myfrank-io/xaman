import { describe, expect, it } from "vitest";

import {
  daysLate,
  isDueToday,
  isOpenLog,
  itemNeedsAttention,
  logNeedsAttention,
} from "@/lib/attention";
import { computeChecklistStatus } from "@/lib/checklist-status";

const TODAY = "2026-09-08";

describe("itemNeedsAttention", () => {
  it("flags what is late, by date or by hours", () => {
    expect(itemNeedsAttention({ status: "overdue", daysRemaining: -126 })).toBe(true);
    // Échéance en heures : la vue ne donne pas de jour restant, le statut suffit.
    expect(itemNeedsAttention({ status: "overdue", daysRemaining: null })).toBe(true);
  });

  it("flags what falls within the day", () => {
    expect(itemNeedsAttention({ status: "soon", daysRemaining: 0 })).toBe(true);
    expect(isDueToday({ status: "soon", daysRemaining: 0 })).toBe(true);
  });

  it("leaves « bientôt », « jamais fait » and « ok » alone", () => {
    expect(itemNeedsAttention({ status: "soon", daysRemaining: 1 })).toBe(false);
    expect(itemNeedsAttention({ status: "soon", daysRemaining: 30 })).toBe(false);
    // Un point dû dans 25 heures moteur est « bientôt », pas dans la journée.
    expect(itemNeedsAttention({ status: "soon", daysRemaining: null })).toBe(false);
    expect(itemNeedsAttention({ status: "never", daysRemaining: null })).toBe(false);
    expect(itemNeedsAttention({ status: "ok", daysRemaining: 90 })).toBe(false);
  });

  it("calls a late item late, never « aujourd'hui »", () => {
    expect(isDueToday({ status: "overdue", daysRemaining: 0 })).toBe(false);
  });
});

describe("the rule reads the status view, it does not recompute it", () => {
  // La vue `checklist_item_status` est la vérité (règle 8) ; le miroir TS sert à l'optimistic
  // UI. Les deux doivent donner le même point rouge, sinon cocher « Fait » ferait clignoter la
  // ligne : c'est ce que ce cas vérifie, sur un point dû exactement aujourd'hui.
  const status = computeChecklistStatus({
    lastCompletedAt: "2026-06-08",
    lastEngineHours: null,
    intervalMonths: 3,
    intervalHours: null,
    currentHours: null,
    today: TODAY,
  });

  it("sees the point due today as due today", () => {
    expect(status.dueAt).toBe(TODAY);
    expect(status.daysRemaining).toBe(0);
    expect(status.state).toBe("soon");
    expect(itemNeedsAttention({ status: status.state, daysRemaining: status.daysRemaining })).toBe(
      true,
    );
    expect(isDueToday({ status: status.state, daysRemaining: status.daysRemaining })).toBe(true);
  });
});

describe("logNeedsAttention", () => {
  it("flags an urgent intervention, whatever its date", () => {
    expect(logNeedsAttention({ status: "urgent", performedAt: "2026-12-01" }, TODAY)).toBe(true);
  });

  it("flags an open intervention dated today or before", () => {
    expect(logNeedsAttention({ status: "planned", performedAt: TODAY }, TODAY)).toBe(true);
    expect(logNeedsAttention({ status: "planned", performedAt: "2026-09-01" }, TODAY)).toBe(true);
    expect(logNeedsAttention({ status: "in_progress", performedAt: "2026-08-30" }, TODAY)).toBe(
      true,
    );
  });

  it("leaves what is planned for later, and what is done", () => {
    expect(logNeedsAttention({ status: "planned", performedAt: "2026-09-09" }, TODAY)).toBe(false);
    expect(logNeedsAttention({ status: "in_progress", performedAt: "2026-10-01" }, TODAY)).toBe(
      false,
    );
    expect(logNeedsAttention({ status: "done", performedAt: "2026-09-01" }, TODAY)).toBe(false);
  });

  it("knows the three open statuses", () => {
    expect(isOpenLog("planned")).toBe(true);
    expect(isOpenLog("in_progress")).toBe(true);
    expect(isOpenLog("urgent")).toBe(true);
    expect(isOpenLog("done")).toBe(false);
  });
});

describe("daysLate", () => {
  it("counts whole days, zero on the day itself", () => {
    expect(daysLate(TODAY, TODAY)).toBe(0);
    expect(daysLate("2026-09-05", TODAY)).toBe(3);
  });

  it("says nothing about a date still ahead, or missing", () => {
    expect(daysLate("2026-09-09", TODAY)).toBeNull();
    expect(daysLate(null, TODAY)).toBeNull();
  });
});
