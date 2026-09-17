import { describe, expect, it } from "vitest";

import type { ChecklistRow } from "@/components/checklist/rows";
import { groupOf, groupQueue, type UpcomingEntry } from "@/components/dashboard/queue";

/**
 * Les paliers de la file (D121, E18-1).
 *
 * L'écran montre maintenant tout ce qui attend quelqu'un, donc il le range. Deux choses sont
 * vérifiées ici, et ce sont les deux qui peuvent mentir : qu'« Aujourd'hui » dise exactement ce
 * que dit le point rouge de l'onglet (D88) — sinon la pastille mène à un palier qui ne la
 * contient pas — et qu'une échéance en heures ne soit jamais rangée sous un titre de calendrier,
 * parce que la convertir en jours (1 h ≈ 1,2 j) est une supposition sur la façon de naviguer.
 */
const TODAY = "2026-09-14";

function row(over: Partial<ChecklistRow> = {}): ChecklistRow {
  return {
    id: "i1",
    label: "Vidange",
    description: null,
    actions: [],
    categoryId: "c1",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
    engineId: null,
    engineLabel: null,
    engineTracksHours: true,
    intervalMonths: 12,
    intervalHours: null,
    sortOrder: 1,
    anchorDate: null,
    anchorHours: null,
    counterResetAt: null,
    currentHours: null,
    hasCompletion: true,
    lastCompletionId: null,
    lastCompletedAt: null,
    lastCompletedByName: null,
    lastEngineHours: null,
    fixedDueAt: null,
    status: "soon",
    dueAt: null,
    dueHours: null,
    daysRemaining: 10,
    hoursRemaining: null,
    openLog: null,
    ...over,
  };
}

const item = (over: Partial<ChecklistRow> = {}): UpcomingEntry => ({
  kind: "item",
  row: row(over),
});

const log = (over: Partial<Extract<UpcomingEntry, { kind: "log" }>> = {}): UpcomingEntry => ({
  kind: "log",
  id: "l1",
  title: "Antifouling",
  status: "planned",
  dueAt: "2026-09-20",
  categoryName: "Coque",
  categoryColor: "#52606F",
  ...over,
});

describe("« Aujourd'hui » dit ce que dit le point rouge", () => {
  it("takes an overdue item, a same-day one, and neither of the two that follow", () => {
    expect(groupOf(item({ status: "overdue", daysRemaining: -12 }), TODAY)).toBe("today");
    expect(groupOf(item({ status: "soon", daysRemaining: 0 }), TODAY)).toBe("today");
    expect(groupOf(item({ status: "soon", daysRemaining: 1 }), TODAY)).not.toBe("today");
    expect(groupOf(item({ status: "soon", daysRemaining: 29 }), TODAY)).not.toBe("today");
  });

  it("takes an item overdue by hours, which carries no day at all", () => {
    const overdueByHours = item({
      status: "overdue",
      engineId: "e1",
      currentHours: 1256,
      daysRemaining: null,
      hoursRemaining: -426,
    });
    expect(groupOf(overdueByHours, TODAY)).toBe("today");
  });

  it("takes an urgent intervention whatever its date, and a planned one dated today or before", () => {
    expect(groupOf(log({ status: "urgent", dueAt: "2026-12-31" }), TODAY)).toBe("today");
    expect(groupOf(log({ dueAt: TODAY }), TODAY)).toBe("today");
    expect(groupOf(log({ dueAt: "2026-09-01" }), TODAY)).toBe("today");
  });
});

describe("la semaine et le mois", () => {
  it("cuts at seven days, the same window as the state sentence", () => {
    expect(groupOf(item({ daysRemaining: 7 }), TODAY)).toBe("week");
    expect(groupOf(item({ daysRemaining: 8 }), TODAY)).toBe("month");
    expect(groupOf(log({ dueAt: "2026-09-21" }), TODAY)).toBe("week");
    expect(groupOf(log({ dueAt: "2026-09-22" }), TODAY)).toBe("month");
  });

  it("keeps the dated deadline when it is the one that fires", () => {
    // 400 h ≈ 480 j : c'est la date qui tombe la première, donc un palier de calendrier.
    const dated = item({
      engineId: "e1",
      currentHours: 900,
      daysRemaining: 10,
      hoursRemaining: 400,
    });
    expect(groupOf(dated, TODAY)).toBe("month");
  });
});

describe("« Aux heures moteur » : ce qui ne tombe pas un jour", () => {
  it("takes the row whose hours fire first, however far its date is", () => {
    const byHours = item({
      engineId: "e1",
      currentHours: 1256,
      intervalHours: 250,
      daysRemaining: 300,
      hoursRemaining: 18,
    });
    expect(groupOf(byHours, TODAY)).toBe("hours");
  });

  it("ignores the hours of an engine that has never been read", () => {
    // Sans relevé, la ligne affiche « compteur inconnu » : l'heure ne peut pas la classer non
    // plus, c'est la date qui reste (`hasCounter`, la règle de DueLabel).
    const noCounter = item({
      engineId: "e1",
      currentHours: null,
      daysRemaining: 3,
      hoursRemaining: 2,
    });
    expect(groupOf(noCounter, TODAY)).toBe("week");
  });

  it("takes a row that carries no day, whatever it carries instead", () => {
    expect(groupOf(item({ daysRemaining: null, hoursRemaining: 40 }), TODAY)).toBe("hours");
    expect(groupOf(item({ daysRemaining: null, hoursRemaining: null }), TODAY)).toBe("hours");
  });
});

describe("ce qui attend sans date (D131)", () => {
  const inbox = (over = {}): UpcomingEntry => ({
    kind: "inbox",
    id: "d1",
    title: "Facture chantier",
    receivedAt: "2026-09-10",
    ...over,
  });
  const part = (over = {}): UpcomingEntry => ({
    kind: "part",
    id: "p1",
    title: "Filtre à huile",
    missing: 2,
    categoryName: "Moteurs",
    categoryColor: "#D97706",
    ...over,
  });

  it("files a waiting document under today, because it has waited since it arrived", () => {
    expect(groupOf(inbox(), TODAY)).toBe("today");
    // Même arrivé ce matin : ce qui attend une décision attend aujourd'hui.
    expect(groupOf(inbox({ receivedAt: TODAY }), TODAY)).toBe("today");
    expect(groupOf(inbox({ receivedAt: null }), TODAY)).toBe("today");
  });

  it("files a part under « À racheter », never under a day it does not have", () => {
    expect(groupOf(part(), TODAY)).toBe("restock");
  });

  it("keeps the two dateless tiers at the bottom, in that order", () => {
    const groups = groupQueue(
      [
        part(),
        item({ daysRemaining: null, hoursRemaining: 40 }),
        inbox(),
        item({ status: "overdue", daysRemaining: -2 }),
      ],
      TODAY,
    );
    expect(groups.map((group) => group.key)).toEqual(["today", "hours", "restock"]);
    expect(groups[0]?.entries).toHaveLength(2);
  });
});

describe("groupQueue", () => {
  it("returns the tiers in order, keeps the queue's order inside each, and skips the empty ones", () => {
    const groups = groupQueue(
      [
        item({ id: "a", daysRemaining: 20 }),
        item({ id: "b", status: "overdue", daysRemaining: -3 }),
        item({ id: "c", daysRemaining: 25 }),
        item({ id: "d", status: "soon", daysRemaining: 0 }),
      ],
      TODAY,
    );
    const ids = (group: (typeof groups)[number] | undefined) =>
      (group?.entries ?? []).map((entry) => (entry.kind === "item" ? entry.row.id : ""));
    expect(groups.map((group) => group.key)).toEqual(["today", "month"]);
    expect(ids(groups[0])).toEqual(["b", "d"]);
    expect(ids(groups[1])).toEqual(["a", "c"]);
  });

  it("has nothing to show for an empty queue", () => {
    expect(groupQueue([], TODAY)).toEqual([]);
  });
});
