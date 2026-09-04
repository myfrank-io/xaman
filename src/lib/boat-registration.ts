/**
 * The boat's registration number — what the maritime administration issued, not the yard.
 *
 * There is nothing to validate against. The French format changed with the 2016 reform and boats
 * registered before it kept their number; the published lists of quartiers maritimes disagree
 * with one another; and a boat under a foreign flag follows another country's rules entirely.
 * A field that refuses what someone reads off their own certificate would be worse than no field.
 *
 * So: normalise the shape, and *warn* about nothing more than the shape.
 */

/** Uppercase and single-spaced, so « ma 123 456 » and « MA123456 » are stored the same way. */
export function normaliseRegistration(value: string): string {
  return value.trim().replace(/\s+/g, " ").toUpperCase();
}

const FRENCH_SHAPE = /^[A-Z]{2,3}[ -]?\d{4,7}$/;

/**
 * Whether the text has the shape of a current French registration: the quartier's two or three
 * letters, then the serial. It checks the shape and only the shape — the letters are not compared
 * to any list of quartiers, because the lists we could find do not agree on how many there are.
 *
 * `false` is a hint to show, never a reason to refuse: a boat registered in 1998, or one under a
 * Belgian flag, is perfectly legitimate and will land here.
 */
export function looksLikeFrenchRegistration(value: string): boolean {
  return FRENCH_SHAPE.test(normaliseRegistration(value));
}
