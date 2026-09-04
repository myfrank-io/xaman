import { describe, expect, it } from "vitest";

import {
  ENGINE_COUNT_CHOICES,
  EXISTING_LOG_FORMATS,
  ONBOARDING_BOAT_STEPS,
  ONBOARDING_STEPS,
  defaultEngineCount,
  isExistingLogFormat,
  isOnboardingBoatStep,
  newBoatEngines,
  parseOnboardingBoatStep,
  splitTemplates,
  type EngineLabels,
  type TemplateOption,
} from "@/lib/boat-onboarding";
import { onboardingPath } from "@/lib/queries/boat-routes";

const LABELS: EngineLabels = {
  single: "Moteur",
  port: "Moteur bâbord",
  starboard: "Moteur tribord",
  outboard: "Hors-bord",
};

function template(over: Partial<TemplateOption> = {}): TemplateOption {
  return {
    id: "t",
    name: "T",
    builder: null,
    model: null,
    boatType: "monohull_sail",
    categoryCount: 8,
    itemCount: 60,
    ...over,
  };
}

describe("defaultEngineCount", () => {
  it("gives a multihull two engines and everything else one", () => {
    expect(defaultEngineCount("catamaran")).toBe(2);
    expect(defaultEngineCount("trimaran")).toBe(2);
    expect(defaultEngineCount("monohull_sail")).toBe(1);
    expect(defaultEngineCount("motor")).toBe(1);
    expect(defaultEngineCount("rib")).toBe(1);
    expect(defaultEngineCount("other")).toBe(1);
  });

  it("falls back to one when the model says nothing about the hull", () => {
    expect(defaultEngineCount(null)).toBe(1);
    expect(defaultEngineCount(undefined)).toBe(1);
  });

  it("only ever proposes a count the toggle actually offers", () => {
    for (const type of [
      "catamaran",
      "trimaran",
      "monohull_sail",
      "motor",
      "rib",
      "other",
    ] as const) {
      expect(ENGINE_COUNT_CHOICES).toContain(defaultEngineCount(type));
    }
  });
});

describe("newBoatEngines", () => {
  it("names the two engines of a multihull by their side", () => {
    expect(newBoatEngines(2, "catamaran", LABELS)).toEqual([
      { label: "Moteur bâbord", position: "port" },
      { label: "Moteur tribord", position: "starboard" },
    ]);
  });

  it("puts a single inboard in the centre", () => {
    expect(newBoatEngines(1, "monohull_sail", LABELS)).toEqual([
      { label: "Moteur", position: "center" },
    ]);
  });

  /**
   * The distinction is not cosmetic: `apply_checklist_template` matches `engine_scope` on the
   * position, so an outboard filed as `center` would collect the inboard points (impeller,
   * saildrive) and none of its own.
   */
  it("gives a rigid inflatable an outboard, not an inboard", () => {
    expect(newBoatEngines(1, "rib", LABELS)).toEqual([
      { label: "Hors-bord", position: "outboard" },
    ]);
    expect(newBoatEngines(2, "rib", LABELS).map((e) => e.position)).toEqual([
      "outboard",
      "outboard",
    ]);
  });

  it("creates nothing for a boat without an engine", () => {
    expect(newBoatEngines(0, "monohull_sail", LABELS)).toEqual([]);
    expect(newBoatEngines(-1, "catamaran", LABELS)).toEqual([]);
  });

  it("never labels an engine with an empty string", () => {
    for (const count of ENGINE_COUNT_CHOICES) {
      for (const engine of newBoatEngines(count, "catamaran", LABELS)) {
        expect(engine.label.trim().length).toBeGreaterThan(0);
      }
    }
  });
});

describe("splitTemplates", () => {
  it("separates a builder's model from a generic one", () => {
    const orc50 = template({ id: "orc50", builder: "Marsaudon Composites", model: "ORC 50" });
    const generic = template({ id: "generic" });
    const modelOnly = template({ id: "model-only", model: "First 36" });

    const { exact, generic: fallback } = splitTemplates([orc50, generic, modelOnly]);
    expect(exact.map((t) => t.id)).toEqual(["orc50", "model-only"]);
    expect(fallback.map((t) => t.id)).toEqual(["generic"]);
  });

  it("loses no model on the way", () => {
    const all = [
      template({ id: "a", builder: "X" }),
      template({ id: "b" }),
      template({ id: "c", model: "Y" }),
    ];
    const { exact, generic } = splitTemplates(all);
    expect(exact.length + generic.length).toBe(all.length);
  });
});

describe("the three steps", () => {
  const boatId = "11111111-2222-3333-4444-555555555555";

  it("addresses the two steps that need a boat", () => {
    expect(onboardingPath(boatId, 2)).toBe(`/boats/new/${boatId}?step=2`);
    expect(onboardingPath(boatId, 3)).toBe(`/boats/new/${boatId}?step=3`);
  });

  it("keeps step 1 out of the boat's tree, where it could not exist", () => {
    expect(ONBOARDING_STEPS).toEqual([1, 2, 3]);
    expect(ONBOARDING_BOAT_STEPS).toEqual([2, 3]);
    expect(isOnboardingBoatStep(1)).toBe(false);
    expect(ONBOARDING_BOAT_STEPS.every(isOnboardingBoatStep)).toBe(true);
  });

  /**
   * `?step=` is whatever the address bar holds. Anything that is not step 3 lands on step 2 —
   * the first screen the boat id is good for — rather than on a 404 in the middle of a flow.
   */
  it("reads ?step= defensively", () => {
    expect(parseOnboardingBoatStep("3")).toBe(3);
    expect(parseOnboardingBoatStep("2")).toBe(2);
    expect(parseOnboardingBoatStep(undefined)).toBe(2);
    expect(parseOnboardingBoatStep("")).toBe(2);
    expect(parseOnboardingBoatStep("1")).toBe(2);
    expect(parseOnboardingBoatStep("42")).toBe(2);
    expect(parseOnboardingBoatStep("trois")).toBe(2);
  });

  it("offers « rien à reprendre » first, so the common case costs no tap", () => {
    expect(EXISTING_LOG_FORMATS[0]).toBe("none");
  });

  it("only recognises the formats the toggle offers", () => {
    for (const format of EXISTING_LOG_FORMATS) expect(isExistingLogFormat(format)).toBe(true);
    expect(isExistingLogFormat("")).toBe(false);
    expect(isExistingLogFormat("pdf")).toBe(false);
  });
});
