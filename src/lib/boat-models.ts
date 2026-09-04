import type { BoatType } from "@/lib/schemas/boat";

/**
 * The catalogue of production models (0019, 0020) — what makes « Ocea » enough.
 *
 * It replaces the suggestions that used to come from `checklist_templates`, which could only ever
 * offer the four boats we publish a maintenance plan for. It is ours because nothing external
 * would do: the French registry has no API and maps nothing to a builder anyway, and the open
 * hull datasets are either unlicensed, scraped against their own terms, or carry no multihulls.
 *
 * A few hundred rows, so the whole thing is fetched once and matched here rather than round-
 * tripping per keystroke. Suggestions, never a closed list: the fields stay free text, and a Neel
 * 47 is written as a Neel 47 whether or not we happen to know it.
 */
export type BoatModelOption = {
  id: string;
  builder: string;
  model: string;
  boatType: BoatType;
  yearFrom: number | null;
  yearTo: number | null;
  lengthM: number | null;
  beamM: number | null;
  draftM: number | null;
};

export const MAX_SUGGESTIONS = 5;

/**
 * Nothing is suggested until there is something to narrow by.
 *
 * With a few hundred models, the first five in alphabetical order are not a shortlist — they are
 * five rows that happen to sort first, and putting them on the screen before anyone has typed
 * makes the form look like a menu of the boats we accept. Two characters is where a chip starts
 * being an answer rather than a sample.
 */
export const MIN_QUERY = 2;

/** What a chip carries: the text it writes into the field, plus what tells two « First 40 » apart. */
export type Suggestion = { key: string; label: string; hint?: string };

export function normalise(value: string): string {
  return value
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("fr");
}

/**
 * Case- and accent-insensitive, because « Beneteau » must find « Bénéteau ».
 *
 * The « already filled » test compares the raw text, not the normalised one: someone who typed
 * « beneteau » has *not* got the answer yet, and the suggestion is precisely what puts the accents
 * back. Only an exact match stops the suggestions.
 */
function matches(candidate: string, typed: string): boolean {
  const needle = normalise(typed);
  return !needle || normalise(candidate).includes(needle);
}

export function builderSuggestions(models: BoatModelOption[], typed: string): Suggestion[] {
  const exact = typed.trim();
  if (exact.length < MIN_QUERY) return [];
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const model of models) {
    const builder = model.builder.trim();
    if (!builder || seen.has(builder)) continue;
    if (builder === exact) return [];
    seen.add(builder);
  }
  for (const builder of [...seen].sort((a, b) => a.localeCompare(b, "fr"))) {
    if (!matches(builder, typed)) continue;
    out.push({ key: builder, label: builder });
    if (out.length === MAX_SUGGESTIONS) break;
  }
  return out;
}

/**
 * Models are narrowed by the builder already typed, so « Marsaudon » does not also suggest every
 * other yard's range. With no builder yet the whole catalogue is searched and each chip names its
 * yard — « First 40 » exists at two of them, and the chip has to say which one it would write.
 */
export function modelSuggestions(
  models: BoatModelOption[],
  builder: string,
  typed: string,
): Suggestion[] {
  const yard = normalise(builder);
  const scoped = yard ? models.filter((m) => normalise(m.builder).includes(yard)) : models;
  // A yard already named is itself the narrowing, so its whole range shows as soon as it fits —
  // « Marsaudon » has two models and both are worth a tap. With no yard there is no narrowing at
  // all, whatever the catalogue's size: five rows of a hundred are a sample, not a shortlist.
  if (typed.trim().length < MIN_QUERY && (!yard || scoped.length > MAX_SUGGESTIONS)) return [];
  // The chips stop once the field holds the answer — but « First 40 » exists at two yards, and
  // with no builder typed the field does not hold the answer yet: those are the chips that say
  // which one. So only a name that identifies exactly one model in scope stops them.
  const exact = typed.trim();
  if (scoped.filter((m) => m.model.trim() === exact).length === 1) return [];
  return scoped
    .filter((m) => matches(m.model, typed))
    .slice(0, MAX_SUGGESTIONS)
    .map((m) => ({ key: m.id, label: m.model, hint: yard ? undefined : m.builder }));
}

export function findModelById(models: BoatModelOption[], id: string): BoatModelOption | null {
  return models.find((m) => m.id === id) ?? null;
}

/**
 * The row matching what is currently written in the two fields, if the catalogue knows it.
 *
 * Used after free typing rather than a chip tap: someone who writes « lagoon 42 » in full has
 * named a boat we know, and should get the same pre-filled dimensions as someone who tapped it.
 */
export function findModel(
  models: BoatModelOption[],
  builder: string,
  model: string,
): BoatModelOption | null {
  const b = normalise(builder);
  const m = normalise(model);
  if (!m) return null;
  return (
    models.find((row) => normalise(row.model) === m && (!b || normalise(row.builder) === b)) ?? null
  );
}
