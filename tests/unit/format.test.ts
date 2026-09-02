import { describe, expect, it } from "vitest";

import { formatCurrency, formatDate, formatHours, formatPercent, toDateString } from "@/lib/format";

describe("format", () => {
  it("formats dates as dd/MM/yyyy from yyyy-MM-dd strings", () => {
    expect(formatDate("2026-09-02")).toBe("02/09/2026");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("not-a-date")).toBe("—");
  });

  it("round-trips a Date to a yyyy-MM-dd string", () => {
    expect(toDateString(new Date(2026, 0, 31))).toBe("2026-01-31");
  });

  it("formats amounts in EUR with French conventions", () => {
    expect(formatCurrency(1234.5).replace(/ | /g, " ")).toBe("1 234,50 €");
    expect(formatCurrency("12")).toMatch(/12,00/);
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency("abc")).toBe("—");
  });

  it("formats engine hours with one decimal at most", () => {
    expect(formatHours(1234.5).replace(/ | /g, " ")).toBe("1 234,5 h");
    expect(formatHours(500)).toBe("500 h");
    expect(formatHours(undefined)).toBe("—");
  });

  it("formats ratios as percentages", () => {
    expect(formatPercent(0.4)).toBe("40 %");
    expect(formatPercent(null)).toBe("—");
  });
});
