import { boatPath, importDocumentsPath, importPath } from "@/lib/queries/boat-routes";
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
 * What the creation screen suggests under « Constructeur » and « Modèle ».
 *
 * Only the models we publish: another owner's boat is another tenant's data, and RLS would hide
 * it anyway. So these are suggestions, never a closed list — the field accepts anything typed,
 * which is the whole point of D65 and what makes an external catalogue pluggable here later.
 */
export const MAX_SUGGESTIONS = 5;

export function builderSuggestions(templates: TemplateOption[], typed: string): string[] {
  return match(unique(templates.map((t) => t.builder)), typed);
}

/**
 * Models are narrowed by the builder already typed, so « Marsaudon » does not also suggest every
 * other yard's range. A builder we know nothing about narrows to nothing rather than to a
 * misleading list.
 */
export function modelSuggestions(
  templates: TemplateOption[],
  builder: string,
  typed: string,
): string[] {
  const yard = normalise(builder);
  const scoped = yard
    ? templates.filter((t) => normalise(t.builder ?? "").includes(yard))
    : templates;
  return match(unique(scoped.map((t) => t.model)), typed);
}

/**
 * Case- and accent-insensitive, because « Beneteau » must find « Bénéteau ».
 *
 * The « already filled » test compares the raw text, not the normalised one: someone who typed
 * « beneteau » has *not* got the answer yet, and the suggestion is precisely what puts the accents
 * back. Only an exact match stops the suggestions.
 */
function match(options: string[], typed: string): string[] {
  const exact = typed.trim();
  if (options.some((option) => option === exact)) return [];
  const needle = normalise(typed);
  return options
    .filter((option) => !needle || normalise(option).includes(needle))
    .slice(0, MAX_SUGGESTIONS);
}

function normalise(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

function unique(values: (string | null)[]): string[] {
  const seen = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen].sort((a, b) => a.localeCompare(b, "fr"));
}

/**
 * « J'ai déjà un carnet » (D66).
 *
 * Almost nobody starts from nothing: there is a booklet in the chart table, a spreadsheet on a
 * laptop, or a folder of invoices. Asked here, in one pre-set toggle, the answer is worth more
 * than anywhere else — it decides the screen the carnet opens on, so the history is loaded while
 * the person is still in the mood to load it, instead of being found six screens away in a month.
 *
 * The question is about the **format**, never about the content: each format has one reader in
 * the app already, and this simply names it.
 */
export const EXISTING_LOG_FORMATS = ["none", "spreadsheet", "paper"] as const;
export type ExistingLogFormat = (typeof EXISTING_LOG_FORMATS)[number];

export function isExistingLogFormat(value: string): value is ExistingLogFormat {
  return (EXISTING_LOG_FORMATS as readonly string[]).includes(value);
}

/**
 * Where « Ouvrir le carnet » lands, given the format.
 *
 * - a spreadsheet — Excel, `.csv`, or the export of another app, which is always one of the two —
 *   goes to the interventions import (E12-1): the file, then « Importer », and the whole history
 *   is in, every line flagged « à vérifier » so nothing imported is taken for gospel (D10);
 * - paper goes to the document import (E10-1): the pages and the invoices are photographed, and
 *   each photo becomes an intervention to complete rather than a line to retype;
 * - « rien à reprendre » goes where the creation always went, the dashboard, whose « carnet neuf »
 *   block takes it from there.
 *
 * `from=new` is not decoration: it tells the import screen that the way back is the dashboard of
 * a boat created seconds ago, not the list of a carnet the person has never seen.
 */
export function existingLogDestination(format: ExistingLogFormat, boatId: string): string {
  if (format === "spreadsheet") return importPath(boatId, "logs", { from: "new" });
  if (format === "paper") return importDocumentsPath(boatId, { from: "new" });
  return boatPath(boatId, "dashboard");
}
