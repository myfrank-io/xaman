import { describe, expect, it } from "vitest";

import { looksLikeFrenchRegistration, normaliseRegistration } from "@/lib/boat-registration";
import { updateBoatSchema } from "@/lib/schemas/boat";

const base = {
  boatId: "11111111-1111-4111-8111-111111111111",
  name: "Xaman",
  type: "catamaran" as const,
  builder: null,
  model: null,
  hullNumber: null,
  year: null,
  flag: null,
  homePort: null,
  sailNumber: null,
  lengthM: null,
  beamM: null,
  draftM: null,
  notes: null,
};

describe("normaliseRegistration", () => {
  it("uppercases and collapses whitespace so one number has one spelling", () => {
    expect(normaliseRegistration("  ma   123 456 ")).toBe("MA 123 456");
    expect(normaliseRegistration("hy512340")).toBe("HY512340");
  });
});

describe("looksLikeFrenchRegistration", () => {
  it("recognises the current shape, spaced, hyphenated or run together", () => {
    expect(looksLikeFrenchRegistration("MA 123456")).toBe(true);
    expect(looksLikeFrenchRegistration("ma-123456")).toBe(true);
    expect(looksLikeFrenchRegistration("HY512340")).toBe(true);
    expect(looksLikeFrenchRegistration("BR 1234")).toBe(true);
  });

  it("does not recognise foreign or pre-2016 numbers — which is a hint, not a refusal", () => {
    expect(looksLikeFrenchRegistration("O-1234-BE")).toBe(false);
    expect(looksLikeFrenchRegistration("123456")).toBe(false);
    expect(looksLikeFrenchRegistration("")).toBe(false);
  });

  it("checks the shape only: the letters are not compared to any list of quartiers", () => {
    // Sources disagree on how many quartiers maritimes there are (45 or 47), so a boat whose
    // prefix we do not know must still pass.
    expect(looksLikeFrenchRegistration("ZZ 999999")).toBe(true);
  });
});

describe("updateBoatSchema.registration", () => {
  it("stores the normalised form", () => {
    const parsed = updateBoatSchema.parse({ ...base, registration: " ma 123456 " });
    expect(parsed.registration).toBe("MA 123456");
  });

  it("clears the column when the field is emptied", () => {
    expect(updateBoatSchema.parse({ ...base, registration: "   " }).registration).toBeNull();
  });

  it("accepts a number no format check would recognise", () => {
    const parsed = updateBoatSchema.parse({ ...base, registration: "1234 ZH BREST 1987" });
    expect(parsed.registration).toBe("1234 ZH BREST 1987");
  });
});
