import { describe, expect, it } from "vitest";

import {
  applyStockFilter,
  countLowStock,
  isLowStock,
  isStockFilter,
  monthsSinceCheck,
  restockDelta,
  sortStock,
} from "@/lib/parts";

const TODAY = "2026-09-02";

describe("isLowStock", () => {
  it("flags a quantity at or under a positive threshold", () => {
    expect(isLowStock({ quantity: 1, minQuantity: 2 })).toBe(true);
    expect(isLowStock({ quantity: 2, minQuantity: 2 })).toBe(true);
    expect(isLowStock({ quantity: 0, minQuantity: 1 })).toBe(true);
  });

  it("never flags a line without threshold, even at zero", () => {
    expect(isLowStock({ quantity: 0, minQuantity: 0 })).toBe(false);
    expect(isLowStock({ quantity: 3, minQuantity: 2 })).toBe(false);
  });
});

describe("restockDelta", () => {
  it("brings a low line just above its threshold", () => {
    // « racheté » = quantity climbs to min + 1, so the line clears the alert.
    expect(restockDelta({ quantity: 0, minQuantity: 2 })).toBe(3);
    expect(restockDelta({ quantity: 1, minQuantity: 2 })).toBe(2);
    expect(restockDelta({ quantity: 2, minQuantity: 2 })).toBe(1);
  });

  it("is a no-op for a line that is not (or no longer) low", () => {
    expect(restockDelta({ quantity: 3, minQuantity: 2 })).toBe(0);
    expect(restockDelta({ quantity: 0, minQuantity: 0 })).toBe(0);
  });

  it("clears the threshold when applied", () => {
    const line = { quantity: 0, minQuantity: 5 };
    const after = line.quantity + restockDelta(line);
    expect(isLowStock({ quantity: after, minQuantity: line.minQuantity })).toBe(false);
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
