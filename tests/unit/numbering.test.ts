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
  ticketCounterFailures,
  ticketCounters,
  ticketDuplicateFailures,
  tickets,
} from "../../scripts/check-numbering.mjs";

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
    // Verbatim from the branch that did it: opened before the counter existed, it took D81 for a
    // new heading while D81 already named a row of the table above, and it merged. Neither of the
    // other two rules sees that — the number is not defined twice by a heading, and it sits below
    // the counter. It is D88 now.
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

type Ticket = { id: string; epic: string; number: number; title: string };

/**
 * The numbering of docs/BACKLOG.md (D87).
 *
 * Same disease as the decisions, one epic apart: `E13-10` and `E13-13` each named two tickets. The
 * two `E13-10` are separated by a blank line in the file — the second branch merged main and then
 * appended its ticket with the number it had chosen beforehand. Git had nothing to say: two
 * insertions at different points of a list merge silently.
 *
 * Two rules suffice here where the decisions needed three, because a ticket has exactly one
 * notation — the `- [x] **E13-10** …` list item — so nothing is ambiguous between defining a
 * number and citing one.
 */
describe("numérotation des tickets", () => {
  it("ne nomme jamais deux tickets du même identifiant", () => {
    expect(ticketDuplicateFailures(tickets() as Ticket[])).toEqual([]);
  });

  it("garde chaque épique sous son compteur", () => {
    expect(
      ticketCounterFailures(tickets() as Ticket[], ticketCounters() as Map<string, number>),
    ).toEqual([]);
  });

  it("lit le backlog et son tableau", () => {
    const all = tickets() as Ticket[];
    const counters = ticketCounters() as Map<string, number>;
    // A parser matching nothing would pass every other case here.
    expect(all.length).toBeGreaterThan(60);
    expect(counters.size).toBeGreaterThan(10);
    // The « Retirés » list writes `- E4-8 …` without a checkbox: a mention, not a definition.
    expect(all.some((t) => t.id === "E4-8")).toBe(false);
    // Sub-tickets are their own identifier, not a duplicate of the one they hang off.
    expect(all.some((t) => t.id === "E1-6b")).toBe(true);
  });

  it("signale un identifiant qui ouvre deux tickets", () => {
    const failures = ticketDuplicateFailures([
      { id: "E13-10", epic: "E13", number: 10, title: "Moteur sans compteur d'heures" },
      { id: "E13-10", epic: "E13", number: 10, title: "Tous les rôles dès l'invitation" },
      { id: "E13-11", epic: "E13", number: 11, title: "Le code d'e-mail accepte 6 à 10 chiffres" },
    ] as Ticket[]);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("E13-10 nomme 2 tickets");
    expect(failures[0]).toContain("Tous les rôles");
  });

  it("signale un numéro pris sans incrémenter la ligne de son épique", () => {
    const failures = ticketCounterFailures(
      [{ id: "E13-17", epic: "E13", number: 17, title: "un ticket de plus" }] as Ticket[],
      new Map([["E13", 17]]),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("E13 annonce E13-17");
  });

  it("réclame une ligne pour une épique qui n'en a pas", () => {
    const failures = ticketCounterFailures(
      [{ id: "E16-1", epic: "E16", number: 1, title: "une épique toute neuve" }] as Ticket[],
      new Map([["E13", 17]]),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("| E16 | E16-2 |");
  });

  it("laisse passer une épique sous son compteur", () => {
    expect(
      ticketCounterFailures(
        [{ id: "E13-16", epic: "E13", number: 16, title: "l'e-mail de code" }] as Ticket[],
        new Map([["E13", 17]]),
      ),
    ).toEqual([]);
  });
});
