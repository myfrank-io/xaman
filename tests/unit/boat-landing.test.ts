import { describe, expect, it } from "vitest";

import { boatLandingTarget } from "@/lib/boats/landing";

describe("boatLandingTarget (D64, D155)", () => {
  it("sends someone with no boat to the creation screen", () => {
    expect(boatLandingTarget([], undefined, false)).toEqual({ kind: "new" });
  });

  it("sends someone with one boat straight to it, cookie or not", () => {
    expect(boatLandingTarget(["a"], undefined, false)).toEqual({ kind: "boat", boatId: "a" });
    expect(boatLandingTarget(["a"], "stale", false)).toEqual({ kind: "boat", boatId: "a" });
  });

  it("lands on the last boat opened when there are several", () => {
    expect(boatLandingTarget(["a", "b", "c"], "b", false)).toEqual({ kind: "boat", boatId: "b" });
  });

  it("falls back to the first boat when there is no remembered one", () => {
    expect(boatLandingTarget(["a", "b", "c"], undefined, false)).toEqual({
      kind: "boat",
      boatId: "a",
    });
  });

  it("ignores a remembered boat that is no longer accessible", () => {
    // Access removed since the cookie was written: never bounce to a boat you can't open.
    expect(boatLandingTarget(["a", "b"], "gone", false)).toEqual({ kind: "boat", boatId: "a" });
  });

  it("shows the picker only when it is asked for explicitly", () => {
    expect(boatLandingTarget(["a", "b"], "b", true)).toEqual({ kind: "picker" });
  });

  it("never shows the picker for a single boat, even when forced", () => {
    // « Changer de bateau » is not offered with one boat, but the guard holds regardless.
    expect(boatLandingTarget(["a"], undefined, true)).toEqual({ kind: "boat", boatId: "a" });
  });
});
