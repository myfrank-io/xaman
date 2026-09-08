import { describe, expect, it } from "vitest";

import {
  SERIES_START,
  check,
  counter,
  counterFailures,
  definitions,
  duplicateFailures,
  mentions,
  reuseFailures,
} from "../../scripts/check-decisions.mjs";

type Entry = { number: number; date: string; where: string; title: string };
const start = SERIES_START as { date: string; number: number };

/**
 * The numbering of docs/DECISIONS.md.
 *
 * D43, D73 and D74 each named two different decisions on `main` at once, and three more numbers
 * had to be changed on a branch in a single day. Nothing failed while that was true — the
 * document merged cleanly, because two branches appending to different parts of a 1 500-line file
 * never conflict. The collision only surfaced when someone read `// D73` in permissions.ts and
 * `// D73` in EnginesTab.tsx and found two different decisions.
 *
 * So the counter at the top of DECISIONS.md is the one line every new decision must touch, and
 * this is what keeps it honest. The first two cases fail on the repository itself; the rest feed
 * the rules synthetic data, so a refactor cannot quietly turn them into a function that always
 * says yes.
 */
describe("numérotation des décisions", () => {
  it("ne nomme jamais deux décisions du même numéro", () => {
    expect(duplicateFailures(definitions() as Entry[])).toEqual([]);
  });

  it("garde le compteur au-dessus de tout numéro déjà écrit", () => {
    expect(counterFailures(counter() as number, mentions() as Map<number, Set<string>>)).toEqual(
      [],
    );
  });

  it("lit le compteur et la série", () => {
    const next = counter() as number;
    const entries = definitions() as Entry[];
    expect(next).toBeGreaterThan(0);
    // The two notations that open an entry, both found: a heading in DECISIONS.md and a row in
    // AUDIT.md. A parser that silently matched neither would pass every other case here.
    expect(entries.filter((e) => e.where.startsWith("docs/DECISIONS.md")).length).toBeGreaterThan(
      30,
    );
    expect(entries.filter((e) => e.where === "docs/AUDIT.md").length).toBeGreaterThan(30);
    expect(Math.max(...entries.map((e) => e.number))).toBeLessThan(next);
  });

  it("signale un numéro pris deux fois", () => {
    const failures = duplicateFailures([
      { number: 73, where: "docs/DECISIONS.md — 2026-09-07", title: "un moteur sans compteur" },
      { number: 73, where: "docs/DECISIONS.md — 2026-09-07", title: "tous les rôles" },
      { number: 74, where: "docs/DECISIONS.md — 2026-09-07", title: "la vignette d'un moteur" },
    ]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("D73 nomme 2 décisions");
    expect(failures[0]).toContain("tous les rôles");
  });

  it("ne réutilise aucun numéro depuis que le compteur existe", () => {
    expect(reuseFailures(definitions() as Entry[])).toEqual([]);
  });

  it("signale un numéro repris par une entrée postérieure au compteur", () => {
    // Verbatim from a branch opened before the counter existed: it took D81 for a new heading
    // while D81 already named a row of the table above. Neither of the other two rules sees it —
    // the number is not defined twice by a heading, and it sits below the counter.
    const failures = reuseFailures(
      [
        {
          number: 81,
          date: "2026-09-08",
          where: "docs/DECISIONS.md — 2026-09-08",
          title: "le point rouge ne dit qu'une chose",
        },
        {
          number: 79,
          date: "2026-09-07",
          where: "docs/DECISIONS.md — 2026-09-07",
          title: "un e-mail qui n'arrive pas le dit dans l'app",
        },
      ] as Entry[],
      start,
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("D81 ouvre");
    expect(failures[0]).toContain("le point rouge");
  });

  it("signale un numéro pris sans incrémenter le compteur", () => {
    const written = new Map([
      [73, new Set(["src/lib/permissions.ts"])],
      [85, new Set(["src/lib/actions/members.ts", "docs/BACKLOG.md"])],
    ]);
    const failures = counterFailures(85, written);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("D85 est écrit dans");
    expect(failures[0]).toContain("docs/BACKLOG.md");
  });

  it("laisse passer une série sous le compteur", () => {
    expect(counterFailures(85, new Map([[84, new Set(["docs/DECISIONS.md"])]]))).toEqual([]);
  });

  it("ne relève rien sur le dépôt", () => {
    expect(check()).toEqual([]);
  });
});
