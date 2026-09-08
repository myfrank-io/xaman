import { describe, expect, it } from "vitest";

import { pickNextDue } from "@/components/dashboard/next-due";
import { isNewlyOverdue } from "@/lib/attention";
import { pickNames, summariseWeek } from "@/lib/queries/attention";

/**
 * Le tableau de bord comptait « à traiter » de trois façons — la vignette (état), la file
 * (état) et le lien de pied (`en retard + bientôt + jamais renseignés`). Les tests ci-dessous
 * fixent la règle unique : **on compte ce que l'écran d'arrivée montre**.
 */

type Row = { status: "overdue" | "soon" | "never" | "ok"; interval: boolean };

/** Le compte de la vignette et du lien : `boat_dashboard_stats.overdue_items + soon_items`. */
function dashboardTodo(rows: Row[]): number {
  return rows.filter((row) => row.status === "overdue" || row.status === "soon").length;
}

/** Ce que la file classe (`boat_todo_queue`, rangs 1 et 3) : les mêmes états, jamais `never`. */
function queued(rows: Row[]): number {
  return rows.filter((row) => row.status === "overdue" || row.status === "soon").length;
}

/** Ce que l'onglet « À traiter » liste : les trois états, moins les contrôles ponctuels jamais faits. */
function todoScreen(rows: Row[]): number {
  return rows.filter(
    (row) =>
      (row.status === "overdue" || row.status === "soon" || row.status === "never") &&
      (row.interval || row.status !== "never"),
  ).length;
}

const BOAT: Row[] = [
  { status: "overdue", interval: true },
  { status: "overdue", interval: true },
  { status: "soon", interval: true },
  // Jamais renseigné mais ancré (D1) : son état est déjà « ok », il n'est pas à traiter.
  { status: "ok", interval: true },
  // Contrôle ponctuel jamais fait : de l'information, ni dans la file ni dans la liste (D13).
  { status: "never", interval: false },
];

describe("one counting rule for « à traiter »", () => {
  it("the tile, the queue and the destination screen agree", () => {
    expect(dashboardTodo(BOAT)).toBe(3);
    expect(queued(BOAT)).toBe(3);
    expect(todoScreen(BOAT)).toBe(3);
  });

  it("never counts a « jamais renseigné » twice", () => {
    // L'ancien lien ajoutait `never_recorded_count` (ici 5 : tous les points sans cochage) à
    // des états qui les comptaient déjà — 3 lignes affichées, 8 annoncées.
    const neverRecorded = BOAT.length;
    expect(dashboardTodo(BOAT) + neverRecorded).not.toBe(todoScreen(BOAT));
  });

  it("says zero when the queue is empty", () => {
    const quiet: Row[] = [
      { status: "ok", interval: true },
      { status: "never", interval: false },
    ];
    expect(dashboardTodo(quiet)).toBe(0);
    expect(queued(quiet)).toBe(0);
    expect(todoScreen(quiet)).toBe(0);
  });
});

describe("isNewlyOverdue", () => {
  it("flags what fell overdue inside the week", () => {
    expect(isNewlyOverdue({ status: "overdue", daysRemaining: -1 })).toBe(true);
    expect(isNewlyOverdue({ status: "overdue", daysRemaining: -7 })).toBe(true);
  });

  it("leaves an old delay, a « bientôt » and an undated deadline alone", () => {
    expect(isNewlyOverdue({ status: "overdue", daysRemaining: -8 })).toBe(false);
    expect(isNewlyOverdue({ status: "soon", daysRemaining: 0 })).toBe(false);
    // Échéance en heures : la vue ne dit pas quel jour elle a basculé, donc rien de « nouveau ».
    expect(isNewlyOverdue({ status: "overdue", daysRemaining: null })).toBe(false);
  });
});

describe("summariseWeek", () => {
  it("adds the two kinds of act and names the people once each", () => {
    const week = summariseWeek({
      completions: 3,
      logs: 1,
      names: ["Xavier", "Xavier", " Xavier ", "Emmanuel", null, "", undefined],
    });
    expect(week.total).toBe(4);
    expect(week.people).toEqual(["Xavier", "Emmanuel"]);
  });

  it("puts the most active first, then alphabetical order", () => {
    const week = summariseWeek({
      completions: 4,
      logs: 0,
      names: ["Emmanuel", "Xavier", "Xavier", "Ana"],
    });
    expect(week.people).toEqual(["Xavier", "Ana", "Emmanuel"]);
  });

  it("stays empty when nothing happened", () => {
    expect(summariseWeek({ completions: 0, logs: 0, names: [] })).toEqual({
      completions: 0,
      logs: 0,
      total: 0,
      people: [],
    });
  });
});

describe("pickNames", () => {
  it("names nobody when a single person did everything", () => {
    expect(pickNames(["Xavier"])).toEqual({ shown: [], extra: 0 });
  });

  it("names two people, and counts the rest", () => {
    expect(pickNames(["Xavier", "Emmanuel"])).toEqual({
      shown: ["Xavier", "Emmanuel"],
      extra: 0,
    });
    expect(pickNames(["Xavier", "Emmanuel", "Ana", "Joseph"])).toEqual({
      shown: ["Xavier", "Emmanuel"],
      extra: 2,
    });
  });
});

describe("pickNextDue: the empty state always says something true", () => {
  it("keeps the closest deadline of the two units", () => {
    const next = pickNextDue([
      { label: "Gréement dormant", days_remaining: 120, hours_remaining: null },
      { label: "Vidange SB", days_remaining: null, hours_remaining: 40 },
    ]);
    // 40 h ≈ 48 j : plus proche que 120 j, et la phrase pourra l'écrire en heures.
    expect(next).toEqual({ label: "Vidange SB", days: null, hours: 40 });
  });

  it("returns the dated row when it is the closest", () => {
    const next = pickNextDue([
      { label: "Vidange SB", days_remaining: null, hours_remaining: 40 },
      { label: "Anodes", days_remaining: 35, hours_remaining: null },
    ]);
    expect(next?.days).toBe(35);
  });

  it("returns nothing when no row carries a deadline at all", () => {
    // Le cas qui produisait « Prochaine échéance : Radeau de survie » suivi de rien.
    expect(pickNextDue([{ label: "Radeau", days_remaining: null, hours_remaining: null }])).toBe(
      null,
    );
    expect(pickNextDue([])).toBe(null);
  });
});
