/**
 * Turning `equipment.specs` into something a person reads at a glance.
 *
 * The maquette is not only a to-do surface: an owner opens it to **know his boat** — how many
 * square metres of mainsail, what cloth, how many amp-hours, where the panels are. The carnet
 * already holds all of it in free key/value pairs; it just never showed any of it outside the
 * equipment sheet.
 *
 * The keys are the seeds' own (`surface_m2`, `puissance_w`, `emplacement`, `materiau`…). A key
 * that ends in a unit prints its unit; any other key prints its value alone, because those values
 * name themselves — « Hydranet », « Sur bossoirs », « Carbone » say more than « tissu : Hydranet ».
 */
const UNITS: readonly (readonly [string, string])[] = [
  ["_m2", " m²"],
  ["_m3", " m³"],
  ["_cm", " cm"],
  ["_mm", " mm"],
  ["_kg", " kg"],
  ["_ah", " Ah"],
  ["_wh", " Wh"],
  ["_kw", " kW"],
  ["_w", " W"],
  ["_v", " V"],
  ["_a", " A"],
  ["_l_h", " L/h"],
  ["_l", " L"],
  ["_h", " h"],
  ["_m", " m"],
];

/** Keys that say nothing a reader wants on a one-line summary. */
const SKIP = new Set(["ref_chantier", "reference", "ref", "note", "notes", "commentaire"]);

function unitOf(key: string): { unit: string } | null {
  const lower = key.toLowerCase();
  for (const [suffix, unit] of UNITS) {
    if (lower.endsWith(suffix)) return { unit };
  }
  return null;
}

/** French number: a decimal comma, and no trailing zeroes on a whole number. */
function number(value: number): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(value);
}

function label(key: string): string {
  const words = key.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The facts of one piece of equipment, in the order the carnet wrote them, at most `max`.
 * A `true` prints its own key (« Chaussette »), a `false` and an empty value print nothing.
 */
export function specFacts(
  specs: Readonly<Record<string, unknown>> | null | undefined,
  max = 3,
): string[] {
  if (!specs || typeof specs !== "object") return [];
  const out: string[] = [];
  for (const [key, raw] of Object.entries(specs)) {
    if (out.length >= max) break;
    if (SKIP.has(key.toLowerCase())) continue;
    if (raw === null || raw === undefined || raw === false || raw === "") continue;
    if (raw === true) {
      out.push(label(key));
      continue;
    }
    const unit = unitOf(key);
    if (typeof raw === "number") {
      out.push(unit ? `${number(raw)}${unit.unit}` : `${label(key)} ${number(raw)}`);
      continue;
    }
    const text = String(raw).trim();
    if (!text) continue;
    // A number written as text keeps its unit; anything else names itself.
    const asNumber = Number(text.replace(",", "."));
    out.push(
      unit && Number.isFinite(asNumber) ? `${number(asNumber)}${unit.unit}` : text.slice(0, 60),
    );
  }
  return out;
}
