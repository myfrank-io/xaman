import { describe, expect, it } from "vitest";

import {
  ENGINE_COUNT_CHOICES,
  ENGINE_COUNT_MAX,
  TENDER_CHOICES,
  asksAboutTender,
  EXISTING_LOG_FORMATS,
  ONBOARDING_BOAT_STEPS,
  ONBOARDING_STEPS,
  defaultEngineCount,
  defaultNavigationZone,
  defaultPropulsion,
  isExistingLogFormat,
  isOnboardingBoatStep,
  newBoatEngines,
  parseOnboardingBoatStep,
  propulsionChoices,
  splitTemplates,
  type EngineLabels,
  type TemplateOption,
} from "@/lib/boat-onboarding";
import fr from "@/messages/fr.json";
import { onboardingPath } from "@/lib/queries/boat-routes";
import { boatTypeSchema, navigationZoneSchema } from "@/lib/schemas/boat";
import { enginePropulsionSchema } from "@/lib/schemas/engines";

const LABELS: EngineLabels = {
  single: "Moteur",
  port: "Moteur bâbord",
  starboard: "Moteur tribord",
  center: "Moteur central",
  portOuter: "Moteur bâbord extérieur",
  portInner: "Moteur bâbord intérieur",
  starboardInner: "Moteur tribord intérieur",
  starboardOuter: "Moteur tribord extérieur",
  outboard: "Hors-bord",
  outboardPort: "Hors-bord bâbord",
  outboardStarboard: "Hors-bord tribord",
  outboardCenter: "Hors-bord central",
  outboardPortOuter: "Hors-bord bâbord extérieur",
  outboardPortInner: "Hors-bord bâbord intérieur",
  outboardStarboardInner: "Hors-bord tribord intérieur",
  outboardStarboardOuter: "Hors-bord tribord extérieur",
  tender: "Hors-bord d'annexe",
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

/**
 * D83: what drives the engines is asked once, per hull, and pre-set on what most boats of that
 * kind carry. The choices are what the chips show, so they must all be drives the schema knows.
 */
describe("propulsionChoices / defaultPropulsion", () => {
  it("offers a semi-rigide an outboard first and never a saildrive", () => {
    expect(propulsionChoices("rib")[0]).toBe("outboard");
    expect(propulsionChoices("rib")).not.toContain("saildrive");
    expect(defaultPropulsion("rib")).toBe("outboard");
  });

  it("offers a multihull a saildrive first, a monohull a shaft line", () => {
    expect(defaultPropulsion("catamaran")).toBe("saildrive");
    expect(defaultPropulsion("trimaran")).toBe("saildrive");
    expect(defaultPropulsion("monohull_sail")).toBe("shaft");
  });

  it("offers a motor boat the four drives the remark listed", () => {
    expect([...propulsionChoices("motor")].sort()).toEqual(
      ["jet", "outboard", "shaft", "sterndrive"].sort(),
    );
  });

  it("only ever offers a drive the schema accepts, and the default is among the choices", () => {
    for (const type of boatTypeSchema.options) {
      const choices = propulsionChoices(type);
      expect(choices.length).toBeGreaterThan(0);
      for (const choice of choices) expect(enginePropulsionSchema.options).toContain(choice);
      expect(choices).toContain(defaultPropulsion(type));
    }
    expect(enginePropulsionSchema.options).toContain(defaultPropulsion(null));
  });
});

/**
 * « Côtier ou hauturier » (D83): pre-set in the direction that costs least when wrong — a motor
 * boat is coastal more often than not, and a sailing boat is offshore because a missing liferaft
 * point is worse than an unwanted one.
 */
describe("defaultNavigationZone", () => {
  it("puts a semi-rigide and a motor boat on the coast, everything else offshore", () => {
    expect(defaultNavigationZone("rib")).toBe("coastal");
    expect(defaultNavigationZone("motor")).toBe("coastal");
    expect(defaultNavigationZone("catamaran")).toBe("offshore");
    expect(defaultNavigationZone("monohull_sail")).toBe("offshore");
    expect(defaultNavigationZone("other")).toBe("offshore");
    expect(defaultNavigationZone(null)).toBe("offshore");
  });

  it("only ever answers a zone the schema accepts", () => {
    for (const type of boatTypeSchema.options) {
      expect(navigationZoneSchema.options).toContain(defaultNavigationZone(type));
    }
  });
});

describe("newBoatEngines", () => {
  it("names the two engines of a multihull by their side, on saildrives", () => {
    expect(newBoatEngines(2, "catamaran", LABELS)).toEqual([
      { label: "Moteur bâbord", position: "port", propulsion: "saildrive" },
      { label: "Moteur tribord", position: "starboard", propulsion: "saildrive" },
    ]);
  });

  it("puts a single inboard in the centre", () => {
    expect(newBoatEngines(1, "monohull_sail", LABELS)).toEqual([
      { label: "Moteur", position: "center", propulsion: "shaft" },
    ]);
  });

  /**
   * The distinction is not cosmetic: `apply_checklist_template` matches `engine_scope` on the
   * propulsion, so an outboard filed as a shaft line would collect the inboard points (impeller,
   * stern gland) and none of its own.
   */
  it("gives a rigid inflatable an outboard, not an inboard", () => {
    expect(newBoatEngines(1, "rib", LABELS)).toEqual([
      { label: "Hors-bord", position: "outboard", propulsion: "outboard" },
    ]);
    const twin = newBoatEngines(2, "rib", LABELS);
    expect(twin.map((e) => e.propulsion)).toEqual(["outboard", "outboard"]);
    // Two outboards have a side each; they are named as outboards, not as « Moteur ».
    expect(twin.map((e) => e.position)).toEqual(["port", "starboard"]);
    expect(twin.map((e) => e.label)).toEqual(["Hors-bord bâbord", "Hors-bord tribord"]);
  });

  it("follows the propulsion it is given, whatever the hull", () => {
    expect(newBoatEngines(1, "monohull_sail", LABELS, "none", "outboard")).toEqual([
      { label: "Hors-bord", position: "outboard", propulsion: "outboard" },
    ]);
    expect(newBoatEngines(2, "motor", LABELS, "none", "sterndrive")).toEqual([
      { label: LABELS.port, position: "port", propulsion: "sterndrive" },
      { label: LABELS.starboard, position: "starboard", propulsion: "sterndrive" },
    ]);
  });

  it("gives a triple its centre engine", () => {
    expect(newBoatEngines(3, "motor", LABELS, "none", "shaft")).toEqual([
      { label: LABELS.port, position: "port", propulsion: "shaft" },
      { label: LABELS.center, position: "center", propulsion: "shaft" },
      { label: LABELS.starboard, position: "starboard", propulsion: "shaft" },
    ]);
  });

  /** A quad is counted the way it is seen from the pontoon: outside in, side by side. */
  it("reads a quad from the outside in", () => {
    expect(newBoatEngines(4, "motor", LABELS, "none", "shaft")).toEqual([
      { label: LABELS.portOuter, position: "port", propulsion: "shaft" },
      { label: LABELS.portInner, position: "port", propulsion: "shaft" },
      { label: LABELS.starboardInner, position: "starboard", propulsion: "shaft" },
      { label: LABELS.starboardOuter, position: "starboard", propulsion: "shaft" },
    ]);
    expect(newBoatEngines(4, "motor", LABELS).map((e) => e.label)).toEqual([
      LABELS.outboardPortOuter,
      LABELS.outboardPortInner,
      LABELS.outboardStarboardInner,
      LABELS.outboardStarboardOuter,
    ]);
  });

  it("keeps a triple and a quad on a rigid inflatable outboard", () => {
    for (const count of [3, 4]) {
      const engines = newBoatEngines(count, "rib", LABELS);
      expect(engines).toHaveLength(count);
      expect(engines.every((engine) => engine.propulsion === "outboard")).toBe(true);
    }
  });

  /** The annexe's outboard is an outboard, whatever drives the boat itself (D68, D83). */
  it("gives the annexe an outboard behind saildrives", () => {
    const engines = newBoatEngines(2, "catamaran", LABELS, "outboard");
    expect(engines).toHaveLength(3);
    expect(engines[2]).toEqual({
      label: LABELS.tender,
      position: "outboard",
      propulsion: "outboard",
    });
  });

  it("creates exactly the number of engines the toggle asked for", () => {
    for (const count of ENGINE_COUNT_CHOICES) {
      expect(newBoatEngines(count, "catamaran", LABELS)).toHaveLength(count);
    }
  });

  /** Two engines of the same side share a position, so only the label tells them apart. */
  it("never gives two engines the same name", () => {
    for (const count of ENGINE_COUNT_CHOICES) {
      for (const type of ["catamaran", "motor", "rib"] as const) {
        const labels = newBoatEngines(count, type, LABELS, "outboard").map((e) => e.label);
        expect(new Set(labels).size).toBe(labels.length);
      }
    }
  });

  /** The toggle offers 0…4; anything wider arriving from elsewhere must still open a carnet. */
  it("clamps a count nobody can tap", () => {
    expect(newBoatEngines(9, "motor", LABELS)).toEqual(
      newBoatEngines(ENGINE_COUNT_MAX, "motor", LABELS),
    );
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

/**
 * The engine names of step 1 come from `fr.json` (rule 7). A key missing there would not fail to
 * compile — it would name an engine after its key on the screen of whoever taps four engines.
 */
describe("the engine names of step 1", () => {
  it("has every label the form asks for", () => {
    const onboarding: Record<string, string> = fr.engines.onboarding;
    for (const key of Object.keys(LABELS) as (keyof EngineLabels)[]) {
      expect(onboarding[key]?.trim(), key).toBeTruthy();
    }
  });

  /** The chips of D83 are labelled from the enums, so every value needs its word. */
  it("names every propulsion and every navigation zone", () => {
    const propulsion: Record<string, string> = fr.enginePropulsion;
    for (const key of enginePropulsionSchema.options) {
      expect(propulsion[key]?.trim(), key).toBeTruthy();
    }
    const zone: Record<string, string> = fr.navigationZone;
    for (const key of navigationZoneSchema.options) {
      expect(zone[key]?.trim(), key).toBeTruthy();
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

describe("the annexe", () => {
  it("comes after the boat's own engines, as an outboard", () => {
    expect(newBoatEngines(2, "catamaran", LABELS, "outboard")).toEqual([
      { label: LABELS.port, position: "port", propulsion: "saildrive" },
      { label: LABELS.starboard, position: "starboard", propulsion: "saildrive" },
      { label: LABELS.tender, position: "outboard", propulsion: "outboard" },
    ]);
  });

  /** `engine_scope` matches on the propulsion (D83): an annexe filed as a saildrive would collect the saildrive
   * points and none of its own. */
  it("is always an outboard, whatever the hull carries", () => {
    for (const type of ["catamaran", "monohull_sail", "motor", "other"] as const) {
      const engines = newBoatEngines(1, type, LABELS, "outboard");
      expect(engines.at(-1)).toEqual({
        label: LABELS.tender,
        position: "outboard",
        propulsion: "outboard",
      });
    }
  });

  it("is the only engine of a boat that has none of its own", () => {
    expect(newBoatEngines(0, "monohull_sail", LABELS, "outboard")).toEqual([
      { label: LABELS.tender, position: "outboard", propulsion: "outboard" },
    ]);
  });

  it("changes nothing when there is no annexe", () => {
    for (const count of ENGINE_COUNT_CHOICES) {
      expect(newBoatEngines(count, "catamaran", LABELS, "none")).toEqual(
        newBoatEngines(count, "catamaran", LABELS),
      );
    }
  });

  it("is not asked of a semi-rigide, and not added to one either", () => {
    expect(asksAboutTender("rib")).toBe(false);
    expect(newBoatEngines(1, "rib", LABELS, "outboard")).toEqual([
      { label: LABELS.outboard, position: "outboard", propulsion: "outboard" },
    ]);
    for (const type of ["catamaran", "trimaran", "monohull_sail", "motor", "other"] as const) {
      expect(asksAboutTender(type)).toBe(true);
    }
  });

  it("never pushes the boat past what create_boat accepts", () => {
    for (const count of ENGINE_COUNT_CHOICES) {
      for (const choice of TENDER_CHOICES) {
        expect(newBoatEngines(count, "catamaran", LABELS, choice).length).toBeLessThanOrEqual(6);
      }
    }
  });

  it("never labels an engine with an empty string", () => {
    for (const engine of newBoatEngines(2, "catamaran", LABELS, "outboard")) {
      expect(engine.label.trim().length).toBeGreaterThan(0);
    }
  });
});

/**
 * The placeholders under « Constructeur » and « Modèle » follow the hull (D68). The key is built
 * from the chosen type, so a missing one would not fail to compile — it would print the key on
 * the screen of whoever picked that hull.
 */
describe("the example boat of each hull", () => {
  const examples: Record<string, { builder: string; model: string }> = fr.boats.new.examples;

  it("names one builder and one model for every type the toggle offers", () => {
    for (const type of boatTypeSchema.options) {
      expect(examples[type]?.builder?.trim()).toBeTruthy();
      expect(examples[type]?.model?.trim()).toBeTruthy();
    }
  });

  it("carries no example for a hull that cannot be chosen", () => {
    expect(Object.keys(examples).sort()).toEqual([...boatTypeSchema.options].sort());
  });
});
