import type { BoatType, NavigationZone } from "@/lib/schemas/boat";
import type { EnginePosition, EnginePropulsion } from "@/lib/schemas/engines";

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

/**
 * Up to four, signalled in use (« donne la possibilité de rajouter d'autres moteurs direct »,
 * D74): two was a floor a triple or a quad hit on the first screen. Four covers the boats that
 * exist — a triple, a quad on a transom — and leaves room under the six the database accepts for
 * the annexe that may follow. A fifth is added from the Bateau screen, where it is named.
 */
export const ENGINE_COUNT_CHOICES = [0, 1, 2, 3, 4] as const;
export type EngineCount = (typeof ENGINE_COUNT_CHOICES)[number];
export const ENGINE_COUNT_MAX = 4;

export type NewBoatEngine = {
  label: string;
  position: EnginePosition;
  propulsion: EnginePropulsion;
};

/**
 * The labels the caller reads from `fr.json` — never written in this file (rule 7). One set for
 * an engine inside the hull (« Moteur bâbord »), one for an outboard on the transom (« Hors-bord
 * bâbord »): the word people use is the word the app should use.
 */
export type EngineLabels = {
  single: string;
  port: string;
  starboard: string;
  center: string;
  portOuter: string;
  portInner: string;
  starboardInner: string;
  starboardOuter: string;
  outboard: string;
  outboardPort: string;
  outboardStarboard: string;
  outboardCenter: string;
  outboardPortOuter: string;
  outboardPortInner: string;
  outboardStarboardInner: string;
  outboardStarboardOuter: string;
  tender: string;
};

type LayoutSlot =
  | "single"
  | "port"
  | "starboard"
  | "center"
  | "portOuter"
  | "portInner"
  | "starboardInner"
  | "starboardOuter";

const OUTBOARD_LABEL: Record<LayoutSlot, keyof EngineLabels> = {
  single: "outboard",
  port: "outboardPort",
  starboard: "outboardStarboard",
  center: "outboardCenter",
  portOuter: "outboardPortOuter",
  portInner: "outboardPortInner",
  starboardInner: "outboardStarboardInner",
  starboardOuter: "outboardStarboardOuter",
};

/**
 * Where the engines sit, count by count. Past two, « bâbord / tribord » stops naming them: a
 * third one is central, and a quad is read from the outside in — the way anyone standing at the
 * transom counts them. The position is not decoration: `engine_scope` matches on it, so it says
 * inboard or outboard and nothing else names the point set an engine collects.
 */
const ENGINE_LAYOUTS: Record<number, { label: LayoutSlot; position: EnginePosition }[]> = {
  1: [{ label: "single", position: "center" }],
  2: [
    { label: "port", position: "port" },
    { label: "starboard", position: "starboard" },
  ],
  3: [
    { label: "port", position: "port" },
    { label: "center", position: "center" },
    { label: "starboard", position: "starboard" },
  ],
  4: [
    { label: "portOuter", position: "port" },
    { label: "portInner", position: "port" },
    { label: "starboardInner", position: "starboard" },
    { label: "starboardOuter", position: "starboard" },
  ],
};

/**
 * The annexe (D68). Almost every boat at anchor tows one, its outboard has its own servicing —
 * impeller, bougie, vidange — and it is the engine people forget until it will not start on the
 * day they need to go ashore.
 *
 * It is declared here, with the boat's own engines, because that is what it is to the app: one
 * more engine, in `outboard` position, so `engine_scope` gives it the outboard points and none of
 * the inboard ones. « Aucune » is first and pre-selected — the question costs no tap.
 */
export const TENDER_CHOICES = ["none", "outboard"] as const;
export type TenderChoice = (typeof TENDER_CHOICES)[number];

/**
 * A semi-rigide *is* the boat one tows; asking it about its own annexe is noise. Every other hull
 * is asked, and a tender added later is an engine added from the Bateau screen like any other.
 */
export function asksAboutTender(boatType: BoatType | null | undefined): boolean {
  return boatType !== "rib";
}

/**
 * What the hull implies. A multihull has two, everything else has one — right often enough that
 * the toggle is a confirmation rather than a question, and wrong cheaply: an engine is added or
 * removed on the Bateau screen, which then offers « Générer les points de ce moteur ».
 */
export function defaultEngineCount(boatType: BoatType | null | undefined): EngineCount {
  return boatType === "catamaran" || boatType === "trimaran" ? 2 : 1;
}

/**
 * What drives the engines (D83): « entre hors-bord, in-bord, jet, semi hors-bord… sur moteur t'as
 * une tonne de trucs ». The propulsion is what a template point's `engine_scope` matches on, so
 * it decides which points each engine collects — a Z-drive's bellows, a shaft line's stern gland,
 * an outboard's gear oil — and it is asked here, once, for all the engines of the boat.
 *
 * The choices follow the hull and the first one is pre-selected, so the question costs no tap
 * where the answer is obvious: a semi-rigide has an outboard, a production multihull a saildrive.
 * A boat with two different drives (one shaft, one Z-drive) corrects the second engine on the
 * Bateau screen, where each engine is named.
 */
const PROPULSION_CHOICES: Record<BoatType, readonly EnginePropulsion[]> = {
  rib: ["outboard", "jet", "sterndrive"],
  motor: ["outboard", "shaft", "sterndrive", "jet"],
  catamaran: ["saildrive", "shaft", "outboard"],
  trimaran: ["saildrive", "shaft", "outboard"],
  monohull_sail: ["shaft", "saildrive", "outboard"],
  other: ["shaft", "saildrive", "sterndrive", "jet", "outboard"],
};

export function propulsionChoices(boatType: BoatType | null | undefined): EnginePropulsion[] {
  return [...(boatType ? PROPULSION_CHOICES[boatType] : PROPULSION_CHOICES.other)];
}

/** The first choice of the hull: what most boats of that kind carry. */
export function defaultPropulsion(boatType: BoatType | null | undefined): EnginePropulsion {
  return propulsionChoices(boatType)[0] ?? "shaft";
}

/**
 * « Côtier ou hauturier » (D83). A coastal boat is not asked about the liferaft, the EPIRB or the
 * AIS: `apply_checklist_template` leaves the offshore points out of its plan.
 *
 * Pre-set from the hull, in the direction that costs least when wrong. A motor boat or a
 * semi-rigide is coastal far more often than not, and the owner who does go offshore sees the
 * chips and taps once. A sailing boat is offshore by default because the mistake is not
 * symmetrical: an unwanted liferaft point is archived in a tap, a missing one is a liferaft
 * nobody checks. Either way the zone stays editable on the Bateau screen.
 */
export function defaultNavigationZone(boatType: BoatType | null | undefined): NavigationZone {
  return boatType === "rib" || boatType === "motor" ? "coastal" : "offshore";
}

/**
 * Builds the engines of a new boat from the count, the hull and the propulsion.
 *
 * The propulsion is not cosmetic: `apply_checklist_template` matches `engine_scope` on it, so an
 * outboard filed as a shaft line would collect the inboard points (impeller, stern gland) and
 * none of its own. The position, since D83, only says where the engine sits — except for the
 * single outboard, which keeps the `outboard` position the app has always given it (there is no
 * side to a lone engine on a transom, and « Hors-bord » is what its card should say).
 */
export function newBoatEngines(
  count: number,
  boatType: BoatType | null | undefined,
  labels: EngineLabels,
  /** The annexe's outboard (D68), appended after the boat's own engines. */
  tender: TenderChoice = "none",
  propulsion: EnginePropulsion = defaultPropulsion(boatType),
): NewBoatEngine[] {
  const outboard = propulsion === "outboard";
  // A count out of range is clamped rather than refused: the toggle offers 0…4, and a wider
  // number arriving from anywhere else must still open a carnet.
  const layout = ENGINE_LAYOUTS[Math.min(Math.floor(count), ENGINE_COUNT_MAX)] ?? [];
  const engines: NewBoatEngine[] = layout.map((slot) => ({
    // « Hors-bord bâbord », not « Moteur bâbord »: the word people use for the thing.
    label: outboard ? labels[OUTBOARD_LABEL[slot.label]] : labels[slot.label],
    position: outboard && slot.label === "single" ? "outboard" : slot.position,
    propulsion,
  }));
  // Last, so the boat's own engines keep positions 1 and 2 on every screen that lists them.
  if (tender === "outboard" && asksAboutTender(boatType)) {
    engines.push({ label: labels.tender, position: "outboard", propulsion: "outboard" });
  }
  return engines;
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
