import { describe, expect, it } from "vitest";

import {
  buildExpenseDetails,
  buildExpensesCsv,
  categoryTotalsFrom,
  expenseFilterQuery,
  expenseKey,
  groupByCategory,
  parseSources,
  previousRange,
  resolveRange,
  totalAmount,
  variation,
  NO_CATEGORY,
  type ExpenseRow,
} from "@/lib/expenses";

const TODAY = "2026-09-02";

const ROWS: ExpenseRow[] = [
  {
    source: "log",
    entityId: "l1",
    label: "Vidange moteur",
    amount: 320,
    date: "2026-05-12",
    categoryId: "c1",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
  },
  {
    source: "purchase",
    entityId: "p1",
    label: "Bouteille de gaz",
    amount: 34.5,
    date: "2026-07-05",
    categoryId: "c2",
    categoryName: "Hydraulique & Circuits",
    categoryColor: "#0F766E",
  },
  {
    source: "haul_out",
    entityId: "h1",
    label: "Chantier Naval de Hyères",
    amount: 1850,
    date: "2026-03-01",
    categoryId: null,
    categoryName: null,
    categoryColor: null,
  },
  {
    source: "log",
    entityId: "l2",
    label: 'Contrôle "vannes"',
    amount: 80,
    date: "2026-06-01",
    categoryId: "c1",
    categoryName: "Moteurs",
    categoryColor: "#D97706",
  },
];

describe("expense periods", () => {
  it("defaults to twelve rolling months", () => {
    expect(resolveRange("rolling12", {}, TODAY)).toEqual({ from: "2025-09-02", to: TODAY });
  });

  it("uses the calendar year bounds", () => {
    expect(resolveRange("year", {}, TODAY)).toEqual({ from: "2026-01-01", to: "2026-12-31" });
  });

  it("keeps a custom range and swaps reversed bounds", () => {
    expect(resolveRange("custom", { from: "2026-01-01", to: "2026-03-31" }, TODAY)).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
    expect(resolveRange("custom", { from: "2026-03-31", to: "2026-01-01" }, TODAY)).toEqual({
      from: "2026-01-01",
      to: "2026-03-31",
    });
  });

  it("shifts the comparison period by one step", () => {
    expect(previousRange("rolling12", { from: "2025-09-02", to: "2026-09-02" })).toEqual({
      from: "2024-09-02",
      to: "2025-09-02",
    });
    expect(previousRange("year", { from: "2026-01-01", to: "2026-12-31" })).toEqual({
      from: "2025-01-01",
      to: "2025-12-31",
    });
    // 31 days in January → the previous 31 days end the day before.
    expect(previousRange("custom", { from: "2026-01-01", to: "2026-01-31" })).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("expense sources", () => {
  it("selects every source when the parameter is missing or unusable", () => {
    expect(parseSources(undefined)).toEqual(["log", "purchase", "haul_out"]);
    expect(parseSources("nonsense")).toEqual(["log", "purchase", "haul_out"]);
  });

  it("keeps the listed sources only", () => {
    expect(parseSources("purchase,haul_out")).toEqual(["purchase", "haul_out"]);
    expect(parseSources("log, nonsense")).toEqual(["log"]);
  });
});

/**
 * The filter panel and the category breakdown both navigate with this. It is what keeps a
 * tap on « Voiles & Gréement » from quietly dropping the custom dates chosen just above it.
 */
describe("expense filters in the URL", () => {
  const RANGE = { from: "2026-01-01", to: "2026-06-30" };
  const state = {
    period: "all" as const,
    range: RANGE,
    sources: ["log", "purchase", "haul_out"] as const,
    kind: null,
    categoryId: null,
  };

  it("writes nothing when every filter is at its default", () => {
    expect(expenseFilterQuery({ ...state, sources: [...state.sources] })).toEqual({
      period: undefined,
      from: undefined,
      to: undefined,
      source: undefined,
      kind: undefined,
      category: undefined,
    });
  });

  it("carries the bounds of a custom period, and only of a custom period", () => {
    expect(
      expenseFilterQuery({ ...state, sources: [...state.sources], period: "custom" }),
    ).toMatchObject({
      period: "custom",
      from: RANGE.from,
      to: RANGE.to,
    });
    expect(
      expenseFilterQuery({ ...state, sources: [...state.sources], period: "year" }),
    ).toMatchObject({ period: "year", from: undefined, to: undefined });
  });

  it("writes a source list only once it is a subset", () => {
    expect(expenseFilterQuery({ ...state, sources: ["log", "purchase"] }).source).toBe(
      "log,purchase",
    );
  });

  it("drops the sources a kind already implies", () => {
    expect(expenseFilterQuery({ ...state, sources: ["log"], kind: "gas" })).toMatchObject({
      kind: "gas",
      source: undefined,
    });
  });

  it("carries a category, including the « no category » bucket", () => {
    expect(
      expenseFilterQuery({ ...state, sources: [...state.sources], categoryId: "c1" }).category,
    ).toBe("c1");
    expect(
      expenseFilterQuery({ ...state, sources: [...state.sources], categoryId: NO_CATEGORY })
        .category,
    ).toBe("none");
  });
});

describe("expense totals", () => {
  it("sums the amounts, treating a missing one as zero", () => {
    expect(totalAmount(ROWS)).toBe(2284.5);
    expect(totalAmount([{ ...(ROWS[0] as ExpenseRow), amount: null }])).toBe(0);
  });

  it("groups by category, largest first, with a fallback bucket", () => {
    const groups = groupByCategory(ROWS, "Sans catégorie", "#8A99AC");
    expect(groups).toHaveLength(3);
    expect(groups[0]).toMatchObject({ name: "Sans catégorie", amount: 1850, count: 1 });
    expect(groups[1]).toMatchObject({ name: "Moteurs", amount: 400, count: 2 });
    expect(groups[2]).toMatchObject({ name: "Hydraulique & Circuits", amount: 34.5 });
  });

  /**
   * The breakdown now arrives already counted by `boat_expense_totals` (D110) rather than
   * summed over the rows the list fetched. These cases pin the reading of that payload: the
   * screen must survive a null system, a numeric that travelled as a string, and a shape it
   * did not expect — a money screen that throws is worse than one that shows nothing.
   */
  it("reads the breakdown the database returns", () => {
    const groups = categoryTotalsFrom(
      [
        {
          category_id: "c1",
          category_name: "Moteurs",
          category_color: "#D97706",
          amount: 400,
          count: 2,
        },
        {
          category_id: null,
          category_name: null,
          category_color: null,
          amount: "1850.00",
          count: 1,
        },
      ],
      "Sans catégorie",
      "#8A99AC",
    );
    expect(groups).toEqual([
      { id: "c1", name: "Moteurs", color: "#D97706", amount: 400, count: 2 },
      { id: "", name: "Sans catégorie", color: "#8A99AC", amount: 1850, count: 1 },
    ]);
  });

  it("keeps the order the database chose, and never invents one", () => {
    // Largest first is the database's `order by`; the reader must not re-sort behind it.
    const groups = categoryTotalsFrom(
      [
        { category_id: "a", category_name: "A", category_color: "#111111", amount: 10, count: 1 },
        { category_id: "b", category_name: "B", category_color: "#222222", amount: 90, count: 1 },
      ],
      "Sans catégorie",
      "#8A99AC",
    );
    expect(groups.map((group) => group.id)).toEqual(["a", "b"]);
  });

  it("survives a payload that is not a breakdown", () => {
    expect(categoryTotalsFrom(null, "Sans catégorie", "#8A99AC")).toEqual([]);
    expect(categoryTotalsFrom("[]", "Sans catégorie", "#8A99AC")).toEqual([]);
    expect(categoryTotalsFrom([null, 3], "Sans catégorie", "#8A99AC")).toEqual([]);
    expect(categoryTotalsFrom([{ amount: "nope" }], "Sans catégorie", "#8A99AC")).toEqual([
      { id: "", name: "Sans catégorie", color: "#8A99AC", amount: 0, count: 0 },
    ]);
  });

  it("computes a variation only against a non-empty previous period", () => {
    expect(variation(4300, 3210)).toBeCloseTo(0.3396, 4);
    expect(variation(1000, 0)).toBeNull();
  });
});

describe("expenses CSV", () => {
  const labels = {
    headers: ["Date", "Source", "Libellé", "Catégorie", "Montant (EUR)"] as [
      string,
      string,
      string,
      string,
      string,
    ],
    source: { log: "Intervention", purchase: "Achat", haul_out: "Sortie de l'eau" },
    uncategorized: "Sans catégorie",
  };

  it("writes a BOM, a header row and CRLF line endings", () => {
    const csv = buildExpensesCsv([ROWS[0] as ExpenseRow], labels);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Date;Source;Libellé;Catégorie;Montant (EUR)\r\n");
    expect(csv.endsWith("\r\n")).toBe(true);
  });

  it("translates the source and the empty category", () => {
    const csv = buildExpensesCsv([ROWS[2] as ExpenseRow], labels);
    expect(csv).toContain(
      "2026-03-01;Sortie de l'eau;Chantier Naval de Hyères;Sans catégorie;1850,00",
    );
  });

  it("quotes a cell holding a quote or a separator", () => {
    const csv = buildExpensesCsv([ROWS[3] as ExpenseRow], labels);
    expect(csv).toContain('"Contrôle ""vannes"""');
  });

  // The expenses CSV is the one a person opens in Excel: a designation typed as « =2+5 » must
  // arrive as text, not as a formula the spreadsheet runs (it shared no code with the guarded
  // writer until this export was moved onto `toCsv`).
  it("neutralises a designation that starts with a formula character", () => {
    const csv = buildExpensesCsv([{ ...(ROWS[0] as ExpenseRow), label: "=SOMME(A1:A9)" }], labels);
    expect(csv).toContain(";'=SOMME(A1:A9);");
    expect(csv).not.toContain(";=SOMME(A1:A9);");
  });

  it("leaves an unknown amount empty rather than writing 0", () => {
    const csv = buildExpensesCsv([{ ...(ROWS[0] as ExpenseRow), amount: null }], labels);
    expect(csv.trimEnd().endsWith(";")).toBe(true);
  });
});

describe("what a line unrolls (D86)", () => {
  const CONTACTS = new Map([
    ["ct1", "Accastillage Diffusion"],
    ["ct2", "Chantier Naval de Hyères"],
  ]);

  it("keys every source apart, so two ids that collide never do", () => {
    const details = buildExpenseDetails({
      logs: [
        {
          id: "same",
          status: "done",
          contact_name: "Paul Martin",
          equipment_name: null,
          notes: null,
          completions_count: 2,
          purchases_count: 1,
          attachments_count: 0,
          needs_review: false,
          haul_out_id: null,
          engineHours: [],
        },
      ],
      purchases: [
        {
          id: "same",
          designation: "Filtres à huile",
          bottle_type: null,
          notes: null,
          needs_review: false,
          supplier_contact_id: null,
          supplier_name: null,
          maintenance_log_id: null,
        },
      ],
    });
    expect(details.get(expenseKey("log", "same"))?.source).toBe("log");
    expect(details.get(expenseKey("purchase", "same"))?.source).toBe("purchase");
    expect(details.get(expenseKey("haul_out", "same"))).toBeUndefined();
  });

  it("reads a supplier from the directory, and falls back to the free-text name", () => {
    const details = buildExpenseDetails({
      purchases: [
        {
          id: "p1",
          designation: "Filtres",
          bottle_type: null,
          notes: null,
          needs_review: false,
          supplier_contact_id: "ct1",
          supplier_name: "ancien nom",
          maintenance_log_id: null,
        },
        {
          id: "p2",
          designation: "Gaz",
          bottle_type: "Butane 13 kg",
          notes: null,
          needs_review: true,
          supplier_contact_id: null,
          supplier_name: "Station Total Hyères",
          maintenance_log_id: null,
        },
      ],
      contactNames: CONTACTS,
    });
    const first = details.get(expenseKey("purchase", "p1"));
    const second = details.get(expenseKey("purchase", "p2"));
    expect(first).toMatchObject({ supplier: "Accastillage Diffusion" });
    expect(second).toMatchObject({ supplier: "Station Total Hyères", needsReview: true });
  });

  it("names the intervention a purchase paid for", () => {
    const details = buildExpenseDetails({
      purchases: [
        {
          id: "p1",
          designation: "Filtres",
          bottle_type: null,
          notes: null,
          needs_review: false,
          supplier_contact_id: null,
          supplier_name: null,
          maintenance_log_id: "l1",
        },
        {
          id: "p2",
          designation: "Gaz",
          bottle_type: null,
          notes: null,
          needs_review: false,
          supplier_contact_id: null,
          supplier_name: null,
          maintenance_log_id: null,
        },
      ],
      logTitles: new Map([["l1", "Vidange moteur SB"]]),
    });
    expect(details.get(expenseKey("purchase", "p1"))).toMatchObject({
      logId: "l1",
      logTitle: "Vidange moteur SB",
    });
    expect(details.get(expenseKey("purchase", "p2"))).toMatchObject({
      logId: null,
      logTitle: null,
    });
  });

  it("counts the interventions of a haul-out and adds up what they cost", () => {
    const details = buildExpenseDetails({
      haulOuts: [
        {
          id: "h1",
          yard_name: null,
          yard_contact_id: "ct2",
          started_at: "2026-03-02",
          ended_at: "2026-03-16",
          works: "Carénage",
        },
        {
          id: "h2",
          yard_name: "Port-Napoléon",
          yard_contact_id: null,
          started_at: "2025-11-04",
          ended_at: "2025-11-10",
          works: null,
        },
      ],
      haulOutLogs: [
        { haul_out_id: "h1", cost: 450 },
        { haul_out_id: "h1", cost: null },
        { haul_out_id: "h1", cost: 120.5 },
        { haul_out_id: null, cost: 999 },
      ],
      contactNames: CONTACTS,
    });
    expect(details.get(expenseKey("haul_out", "h1"))).toMatchObject({
      yard: "Chantier Naval de Hyères",
      daysAshore: 14,
      logsCount: 3,
      logsTotal: 570.5,
    });
    // A haul-out nothing is attached to says « aucune intervention », not a wrong total.
    expect(details.get(expenseKey("haul_out", "h2"))).toMatchObject({
      yard: "Port-Napoléon",
      logsCount: 0,
      logsTotal: 0,
    });
  });

  it("counts the days of a boat still ashore up to today", () => {
    const details = buildExpenseDetails({
      haulOuts: [
        {
          id: "h1",
          yard_name: "Port-Napoléon",
          yard_contact_id: null,
          started_at: "2026-08-24",
          ended_at: null,
          works: null,
        },
      ],
      today: TODAY,
    });
    expect(details.get(expenseKey("haul_out", "h1"))).toMatchObject({
      endedAt: null,
      daysAshore: 9,
    });
  });

  it("survives the nulls the view is allowed to hold", () => {
    const details = buildExpenseDetails({
      logs: [
        {
          id: "l1",
          status: null,
          contact_name: null,
          equipment_name: null,
          notes: null,
          completions_count: null,
          purchases_count: null,
          attachments_count: null,
          needs_review: null,
          haul_out_id: null,
          engineHours: [],
        },
        // A row without an id cannot be keyed, so it is dropped rather than shadowing another.
        {
          id: null,
          status: "urgent",
          contact_name: null,
          equipment_name: null,
          notes: null,
          completions_count: 1,
          purchases_count: 0,
          attachments_count: 0,
          needs_review: false,
          haul_out_id: null,
          engineHours: [],
        },
      ],
    });
    expect(details.size).toBe(1);
    expect(details.get(expenseKey("log", "l1"))).toMatchObject({
      status: "done",
      completionsCount: 0,
      purchasesCount: 0,
      attachmentsCount: 0,
      needsReview: false,
    });
  });

  it("returns nothing when there is nothing to read", () => {
    expect(buildExpenseDetails({}).size).toBe(0);
  });
});
