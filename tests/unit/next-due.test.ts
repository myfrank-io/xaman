import { describe, expect, it } from "vitest";

import {
  addYearsTo,
  nextDueAfterCompletion,
  nextDueSentence,
} from "@/components/checklist/next-due";

/**
 * The reward of a tick (D95): the toast says what the completion has just promised. The rule is
 * never rewritten here — it comes from `computeChecklistStatus`, the mirror of the view — so
 * these cases check what the sentence says, and that it stays quiet when nothing is promised.
 */

// Deliberately not the real formatters: the helper must compose, never format.
const labels = {
  date: (value: string) => `[${value}]`,
  hours: (value: number) => `${value} h`,
  both: ({ date, hours }: { date: string; hours: string }) => `${date} ou ${hours}`,
  sentence: ({ next }: { next: string }) => `Prochaine : ${next}`,
};

const base = {
  completedAt: "2026-03-15",
  engineHours: null,
  intervalMonths: null,
  intervalHours: null,
  fixedDueAt: null,
};

describe("the deadline a completion creates", () => {
  it("counts the months from the day of the completion", () => {
    expect(nextDueAfterCompletion({ ...base, intervalMonths: 12 })).toEqual({
      dueAt: "2027-03-15",
      dueHours: null,
    });
  });

  it("counts the hours from the counter just read", () => {
    expect(nextDueAfterCompletion({ ...base, intervalHours: 250, engineHours: 530 })).toEqual({
      dueAt: null,
      dueHours: 780,
    });
  });

  it("promises no hours when the point counts them but nobody read the counter", () => {
    expect(nextDueAfterCompletion({ ...base, intervalHours: 250 })).toEqual({
      dueAt: null,
      dueHours: null,
    });
  });

  it("lets « Valide jusqu'au » win over the interval (D11)", () => {
    expect(
      nextDueAfterCompletion({ ...base, intervalMonths: 12, fixedDueAt: "2029-01-31" }),
    ).toEqual({ dueAt: "2029-01-31", dueHours: null });
  });
});

describe("the sentence the toast carries", () => {
  it("names the date alone on a point counted in months", () => {
    expect(nextDueSentence({ ...base, intervalMonths: 12 }, labels)).toBe(
      "Prochaine : [2027-03-15]",
    );
  });

  it("names the hours alone on a point counted in engine hours", () => {
    expect(nextDueSentence({ ...base, intervalHours: 250, engineHours: 530 }, labels)).toBe(
      "Prochaine : 780 h",
    );
  });

  it("names both when the point is counted both ways", () => {
    expect(
      nextDueSentence(
        { ...base, intervalMonths: 12, intervalHours: 250, engineHours: 530 },
        labels,
      ),
    ).toBe("Prochaine : [2027-03-15] ou 780 h");
  });

  it("names the expiry that was just typed", () => {
    expect(nextDueSentence({ ...base, fixedDueAt: "2029-01-31" }, labels)).toBe(
      "Prochaine : [2029-01-31]",
    );
  });

  it("stays quiet on a one-off check that promises nothing", () => {
    expect(nextDueSentence(base, labels)).toBeNull();
  });
});

describe("the « + 1 an » / « + 2 ans » shortcuts", () => {
  it("keeps the day of the month", () => {
    expect(addYearsTo("2026-03-15", 1)).toBe("2027-03-15");
    expect(addYearsTo("2026-03-15", 2)).toBe("2028-03-15");
  });

  it("brings 29 February back to 28, never forward into March", () => {
    expect(addYearsTo("2028-02-29", 1)).toBe("2029-02-28");
  });
});
