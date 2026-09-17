import { describe, expect, it } from "vitest";

import {
  applyStockFilter,
  countLowStock,
  isLowStock,
  isStockFilter,
  monthsSinceCheck,
  restockQuantity,
  sortStock,
} from "@/lib/parts";

const TODAY = "2026-09-02";

describe("isLowStock", () => {
  it("flags a quantity under a positive threshold", () => {
    expect(isLowStock({ quantity: 1, minQuantity: 2 })).toBe(true);
    expect(isLowStock({ quantity: 0, minQuantity: 1 })).toBe(true);
  });

  // D143: a threshold is the level one wants in reserve, so holding exactly it is not a
  // shortage — otherwise « Racheté », which buys what is short, would never clear the line.
  it("leaves alone a line that holds exactly its threshold", () => {
    expect(isLowStock({ quantity: 2, minQuantity: 2 })).toBe(false);
  });

  it("never flags a line without threshold, even at zero", () => {
    expect(isLowStock({ quantity: 0, minQuantity: 0 })).toBe(false);
    expect(isLowStock({ quantity: 3, minQuantity: 2 })).toBe(false);
  });
});

describe("restockQuantity", () => {
  it("buys what the line is short of, so buying it clears the line", () => {
    for (const line of [
      { quantity: 0, minQuantity: 1 },
      { quantity: 1, minQuantity: 4 },
      { quantity: 1.5, minQuantity: 3 },
    ]) {
      const bought = restockQuantity(line);
      expect(isLowStock({ ...line, quantity: line.quantity + bought })).toBe(false);
    }
  });

  it("never buys less than one unit", () => {
    expect(restockQuantity({ quantity: 2, minQuantity: 2 })).toBe(1);
    expect(restockQuantity({ quantity: 5, minQuantity: 1 })).toBe(1);
  });

  it("counts in units, not in floating-point noise", () => {
    expect(restockQuantity({ quantity: 0.1, minQuantity: 3 })).toBe(2.9);
  });
});

describe("monthsSinceCheck", () => {
  it("is null when the line was never counted", () => {
    expect(monthsSinceCheck(null, TODAY)).toBeNull();
    expect(monthsSinceCheck(undefined, TODAY)).toBeNull();
  });

  it("floors whole months", () => {
    expect(monthsSinceCheck("2026-08-20", TODAY)).toBe(0);
    expect(monthsSinceCheck("2026-08-02", TODAY)).toBe(1);
    expect(monthsSinceCheck("2026-03-06", TODAY)).toBe(5);
    expect(monthsSinceCheck("2025-09-02", TODAY)).toBe(12);
  });

  it("never goes negative for a date typed in the future", () => {
    expect(monthsSinceCheck("2026-12-01", TODAY)).toBe(0);
  });
});

describe("stock list helpers", () => {
  const parts = [
    { name: "Turbine", quantity: 2, minQuantity: 1 },
    { name: "anodes", quantity: 0, minQuantity: 2 },
    { name: "Filtre 10", quantity: 1, minQuantity: 2 },
    { name: "Filtre 2", quantity: 6, minQuantity: 0 },
  ];

  it("sorts alphabetically, accent- and case-insensitive, numbers in order", () => {
    expect(sortStock(parts).map((part) => part.name)).toEqual([
      "anodes",
      "Filtre 2",
      "Filtre 10",
      "Turbine",
    ]);
  });

  it("keeps only the lines under the threshold with the low filter", () => {
    expect(applyStockFilter(parts, "low").map((part) => part.name)).toEqual([
      "anodes",
      "Filtre 10",
    ]);
    expect(applyStockFilter(parts, "all")).toHaveLength(4);
    expect(countLowStock(parts)).toBe(2);
  });

  it("accepts only the two known filters", () => {
    expect(isStockFilter("all")).toBe(true);
    expect(isStockFilter("low")).toBe(true);
    expect(isStockFilter("high")).toBe(false);
    expect(isStockFilter(undefined)).toBe(false);
  });
});
