import type { BoatType } from "@/lib/schemas/boat";
import type { EnginePosition } from "@/lib/schemas/engines";

/**
 * Opening a carnet (D65): what the creation screen asks, and why it asks only that.
 *
 * Identity and maintenance plan are two questions. This screen asks the first — what is this boat
 * — and the app asks the second later. So there is no template here: the hull type is what the
 * server turns into the boat's systems, and the engines are the one thing that cannot wait.
 *
 * They cannot wait because `apply_checklist_template` duplicates an engine-scoped point once per
 * active engine and skips it entirely when the boat has none — and those are exactly the points
 * carrying the hour intervals. A plan chosen a week later on a boat created without its engines
 * would arrive with no « Vidange huile », which is the first thing anyone looks for.
 */

export const ENGINE_COUNT_CHOICES = [0, 1, 2] as const;
export type EngineCount = (typeof ENGINE_COUNT_CHOICES)[number];

export type NewBoatEngine = { label: string; position: EnginePosition };

/** The labels the caller reads from `fr.json` — never written in this file (rule 7). */
export type EngineLabels = { single: string; port: string; starboard: string; outboard: string };

/**
 * What the hull implies. A multihull has two, everything else has one — right often enough that
 * the toggle is a confirmation rather than a question, and wrong cheaply: an engine is added or
 * removed on the Bateau screen, which then offers « Générer les points de ce moteur ».
 */
export function defaultEngineCount(boatType: BoatType | null | undefined): EngineCount {
  return boatType === "catamaran" || boatType === "trimaran" ? 2 : 1;
}

/**
 * A rigid inflatable is the one hull that carries an outboard rather than an inboard, and the
 * distinction is not cosmetic: `engine_scope` matches on the position, so an outboard given
 * `center` would collect the inboard points (impeller, saildrive) and none of its own.
 */
export function newBoatEngines(
  count: number,
  boatType: BoatType | null | undefined,
  labels: EngineLabels,
): NewBoatEngine[] {
  const outboard = boatType === "rib";
  if (count <= 0) return [];
  if (count === 1) {
    return outboard
      ? [{ label: labels.outboard, position: "outboard" }]
      : [{ label: labels.single, position: "center" }];
  }
  return [
    { label: labels.port, position: outboard ? "outboard" : "port" },
    { label: labels.starboard, position: outboard ? "outboard" : "starboard" },
  ];
}

export type TemplateOption = {
  id: string;
  name: string;
  builder: string | null;
  model: string | null;
  boatType: BoatType | null;
  categoryCount: number;
  itemCount: number;
};

/**
 * The published models, split for the plan picker — which now lives in the app, not at sign-up.
 *
 * A model published for an exact hull is worth more than a generic one and is what the product
 * promises (« le bateau arrive déjà rempli avec son modèle exact »), so it comes first; the
 * generic ones are the floor, so that no boat is left without a plan it can start from.
 */
export function splitTemplates(templates: TemplateOption[]): {
  exact: TemplateOption[];
  generic: TemplateOption[];
} {
  return {
    exact: templates.filter((t) => t.builder !== null || t.model !== null),
    generic: templates.filter((t) => t.builder === null && t.model === null),
  };
}
