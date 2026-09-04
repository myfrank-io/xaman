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

/**
 * The three steps of opening a carnet (D67).
 *
 * They are asked in this order because each one is only answerable once the previous is done:
 * the boat has to exist before its history can be written into it, and the history has to be in
 * before « voici comment ça marche » can point at anything real.
 *
 * The numbers are the route (`?step=`), so they are part of the app's addresses: a person who
 * closes the tab on step 2 comes back to step 2, and the dashboard can send someone back into
 * the flow rather than leaving them on a carnet that was never finished.
 */
export const ONBOARDING_STEPS = [1, 2, 3] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/** Step 1 lives at `/boats/new` — there is no boat id yet to put in the address. */
export const ONBOARDING_BOAT_STEPS = [2, 3] as const;
export type OnboardingBoatStep = (typeof ONBOARDING_BOAT_STEPS)[number];

export function isOnboardingBoatStep(value: unknown): value is OnboardingBoatStep {
  return value === 2 || value === 3;
}

/**
 * `?step=` as it arrives: a string, a missing value, or something someone typed. Anything that is
 * not step 3 is step 2 — the first screen the boat id is good for.
 */
export function parseOnboardingBoatStep(value: string | undefined): OnboardingBoatStep {
  return Number(value) === 3 ? 3 : 2;
}

/**
 * « Sur quoi votre carnet est-il écrit aujourd'hui ? » (D66, D67).
 *
 * Almost nobody starts from nothing: there is a booklet in the chart table, a spreadsheet on a
 * laptop, or a folder of invoices. The question is about the **format** and never about the
 * content, because each format already has its reader in the app — the answer only says which
 * one step 2 puts on screen.
 *
 * `none` is first and pre-selected: a boat that is genuinely new, or an owner who would rather
 * type as they go, must not pay a single tap for a question that does not concern them.
 */
export const EXISTING_LOG_FORMATS = ["none", "spreadsheet", "paper"] as const;
export type ExistingLogFormat = (typeof EXISTING_LOG_FORMATS)[number];

export function isExistingLogFormat(value: string): value is ExistingLogFormat {
  return (EXISTING_LOG_FORMATS as readonly string[]).includes(value);
}
