/**
 * Which family a piece of equipment belongs to (E17-3).
 *
 * The families themselves live in `equipment_kinds` (migration `0032`), a reference table with no
 * `boat_id`. This module is the rule that reads a boat's row — its name, its brand, its model —
 * and says which family it looks like, so the form can propose one instead of asking a person to
 * scroll a list of forty.
 *
 * It proposes and nothing more. `equipment.kind_id` is written by the form, never by a background
 * pass, and a family already chosen is never replaced: what is aboard is the crew's word, and the
 * whole point of the two layers (`docs/AUTOPILOT.md §4`) is that the plan follows what is really
 * there. **No match is an answer.** Filing a heater under the watermaker's rules would give a boat
 * three wrong points and hide three right ones; leaving `kind_id` null only gives it nothing.
 */

/** A family, as the matcher needs it — the shape both the screen and the reading hand over. */
export type EquipmentKind = {
  id: string;
  externalRef: string;
  label: string;
  categoryRef: string | null;
  synonyms: string[];
};

/**
 * Letters that `normalize("NFD")` leaves alone. Decomposition only undoes an accent put on a
 * letter, and these are letters in their own right rather than accented ones — so `œ` would reach
 * the `[^a-z0-9&]` step untouched and be swallowed there as if it were punctuation, turning
 * « Cœur » into `c ur`. The SQL twin folds them in `text_fold` (`0005`); these are the same three.
 */
const LIGATURES = /[ŒœÆæØø]/g;
const FOLDED_LIGATURES: Record<string, string> = {
  Œ: "OE",
  œ: "oe",
  Æ: "AE",
  æ: "ae",
  Ø: "O",
  ø: "o",
};

/**
 * Lower-case, unaccented, punctuation turned into spaces: « Chauffage Wallas 30DT, air pulsé »
 * and « chauffage wallas 30dt air pulse » have to compare equal. `&` is kept as a word of its own
 * so that « B&G » survives as `b & g` rather than becoming `bg`.
 *
 * The twin of `public.normalise_for_match()` (migrations `0035`, `0036`), which is `text_fold()`
 * followed by the same punctuation step. `tests/unit/plan-composition.test.ts` runs both over the
 * same strings: two normalisers that drift would put a rule on the wrong boat.
 */
export function normaliseForMatch(value: string): string {
  return value
    .replace(LIGATURES, (letter) => FOLDED_LIGATURES[letter] ?? letter)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9&]+/g, " ")
    .trim();
}

/** Whether `needle` appears in `haystack` as whole words — « mat » must not match « format ». */
function containsPhrase(haystack: string, needle: string): boolean {
  if (needle === "") return false;
  const at = haystack.indexOf(needle);
  if (at === -1) return false;
  // Both texts are already normalised, so a boundary is a space or an end of string.
  for (let index = at; index !== -1; index = haystack.indexOf(needle, index + 1)) {
    const before = index === 0 || haystack[index - 1] === " ";
    const after =
      index + needle.length === haystack.length || haystack[index + needle.length] === " ";
    if (before && after) return true;
  }
  return false;
}

/** What the matcher reads: the three fields a person fills, in the order they carry meaning. */
export type EquipmentLike = {
  name: string;
  brand?: string | null;
  model?: string | null;
};

/**
 * The family this equipment looks like, or null.
 *
 * Every term of every family — its label and its synonyms — is looked for as whole words in
 * « name brand model ». The longest term wins, so « chauffage à air pulsé » beats « chauffage »
 * and a precise family is never shadowed by a vague one; ties fall to the family declared first
 * (`sort_order`), which is the order the catalogue itself considers most likely.
 */
export function matchEquipmentKind(
  equipment: EquipmentLike,
  kinds: EquipmentKind[],
): EquipmentKind | null {
  const haystack = normaliseForMatch(
    [equipment.name, equipment.brand ?? "", equipment.model ?? ""].join(" "),
  );
  if (haystack === "") return null;

  let best: EquipmentKind | null = null;
  let bestLength = 0;
  for (const kind of kinds) {
    for (const term of [kind.label, ...kind.synonyms]) {
      const needle = normaliseForMatch(term);
      if (needle.length <= bestLength) continue;
      if (containsPhrase(haystack, needle)) {
        best = kind;
        bestLength = needle.length;
      }
    }
  }
  return best;
}
