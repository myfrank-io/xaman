import { describe, expect, it } from "vitest";

import { gasFacts, MIN_INTERVALS_FOR_ESTIMATE } from "@/lib/gas";

// Reference day used by every case below.
const TODAY = "2026-09-02";

describe("gasFacts", () => {
  it("returns empty facts when nothing was ever recorded", () => {
    expect(gasFacts([], TODAY)).toEqual({
      lastAt: null,
      daysSinceLast: null,
      previousAt: null,
      intervalCount: 0,
      averageDays: null,
      nextEstimatedAt: null,
    });
  });

  it("counts no interval for a single bottle", () => {
    const facts = gasFacts(["2026-05-07"], TODAY);
    expect(facts.lastAt).toBe("2026-05-07");
    expect(facts.previousAt).toBeNull();
    expect(facts.intervalCount).toBe(0);
    expect(facts.averageDays).toBeNull();
    expect(facts.nextEstimatedAt).toBeNull();
  });

  it("counts days since the last bottle", () => {
    expect(gasFacts(["2026-05-07"], TODAY).daysSinceLast).toBe(118);
    expect(gasFacts([TODAY], TODAY).daysSinceLast).toBe(0);
  });

  it("sorts the dates itself and reads the last two", () => {
    const facts = gasFacts(["2026-05-07", "2025-07-12", "2026-01-04"], TODAY);
    expect(facts.lastAt).toBe("2026-05-07");
    expect(facts.previousAt).toBe("2026-01-04");
  });

  it("averages the gaps between consecutive purchases only", () => {
    // 100 j then 200 j → 2 intervals, average 150.
    const facts = gasFacts(["2026-01-01", "2026-04-11", "2026-10-28"], "2026-10-28");
    expect(facts.intervalCount).toBe(2);
    expect(facts.averageDays).toBe(150);
  });

  it("gives no estimate below three intervals", () => {
    const facts = gasFacts(["2026-01-01", "2026-04-11", "2026-10-28"], "2026-10-28");
    expect(facts.intervalCount).toBeLessThan(MIN_INTERVALS_FOR_ESTIMATE);
    expect(facts.nextEstimatedAt).toBeNull();
  });

  it("estimates the next change from three intervals on", () => {
    // 2025-01-01 → 2025-05-01 (120) → 2025-09-01 (123) → 2026-01-01 (122): average 122 j.
    const facts = gasFacts(["2025-01-01", "2025-05-01", "2025-09-01", "2026-01-01"], "2026-01-15");
    expect(facts.intervalCount).toBe(3);
    expect(facts.averageDays).toBe(122);
    expect(facts.nextEstimatedAt).toBe("2026-05-03");
  });

  it("ignores unparsable dates", () => {
    const facts = gasFacts(["", "not-a-date", "2026-05-07"], TODAY);
    expect(facts.lastAt).toBe("2026-05-07");
    expect(facts.intervalCount).toBe(0);
  });

  it("never reports a negative age for a date in the future", () => {
    expect(gasFacts(["2026-12-01"], TODAY).daysSinceLast).toBe(0);
  });
});
