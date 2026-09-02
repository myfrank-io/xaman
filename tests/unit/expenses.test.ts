import { describe, expect, it } from "vitest";

import {
  buildExpensesCsv,
  groupByCategory,
  parseSources,
  previousRange,
  resolveRange,
  totalAmount,
  variation,
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

  it("leaves an unknown amount empty rather than writing 0", () => {
    const csv = buildExpensesCsv([{ ...(ROWS[0] as ExpenseRow), amount: null }], labels);
    expect(csv.trimEnd().endsWith(";")).toBe(true);
  });
});
