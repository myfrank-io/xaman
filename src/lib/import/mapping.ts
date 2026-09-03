/**
 * Column mapping for the import engine (E12-1): which column of the file feeds which field.
 *
 * Guessed from the header, accent- and case-insensitive, so « Désignation », "designation"
 * and "DESIGNATION" all land on the same field. The guess is only a default — the import
 * screen shows every mapping and lets it be changed before anything is written.
 */

/** Lowercase, accents folded, everything that is not a letter or a digit removed. */
export function normaliseHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export type FieldDescriptor = {
  /** Key of the field in the row object handed to the entity descriptor. */
  key: string;
  /** French label shown in the mapping table. */
  label: string;
  /** Header spellings that map to this field, in addition to the label itself. */
  aliases?: string[];
  required?: boolean;
  help?: string;
  /**
   * Field that may be given one value for the whole file. « Ces 40 contacts sont tous des
   * chantiers » is one word typed once, not forty cells added to the spreadsheet — and a
   * contact card exported from a phone carries no trade at all.
   */
  allowDefault?: boolean;
  /** Cell written into the downloadable blank template (E12-7). */
  sample?: string;
};

export type ColumnMapping = Record<string, number | null>;

/** Value used for a field when its cell is empty, keyed by field. */
export type FieldDefaults = Record<string, string>;

/**
 * Best-effort mapping: exact match on the normalised header first, then a header that starts
 * with the alias (« Nom du contact » → « nom »). A column is never used twice.
 */
export function guessMapping(headers: string[], fields: FieldDescriptor[]): ColumnMapping {
  const normalised = headers.map(normaliseHeader);
  const taken = new Set<number>();
  const mapping: ColumnMapping = {};

  const find = (candidates: string[], matcher: (header: string, alias: string) => boolean) => {
    for (const alias of candidates) {
      const index = normalised.findIndex(
        (header, position) => !taken.has(position) && header !== "" && matcher(header, alias),
      );
      if (index >= 0) return index;
    }
    return null;
  };

  for (const field of fields) {
    const candidates = [field.label, field.key, ...(field.aliases ?? [])]
      .map(normaliseHeader)
      .filter(Boolean);
    const exact = find(candidates, (header, alias) => header === alias);
    const index = exact ?? find(candidates, (header, alias) => header.startsWith(alias));
    mapping[field.key] = index;
    if (index !== null) taken.add(index);
  }
  return mapping;
}

/** Applies a mapping to one row: `{ field key → cell }`, missing columns become "". */
export function applyMapping(
  row: readonly string[],
  fields: FieldDescriptor[],
  mapping: ColumnMapping,
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const index = mapping[field.key];
    values[field.key] = index === null || index === undefined ? "" : (row[index] ?? "");
  }
  return values;
}

/**
 * Fills the blanks with the value chosen for the whole file. Applied to the preview and to
 * the rows sent, so what is shown is exactly what is written.
 */
export function applyDefaults(
  values: Record<string, string>,
  fields: FieldDescriptor[],
  defaults: FieldDefaults,
): Record<string, string> {
  const filled = { ...values };
  for (const field of fields) {
    if (!field.allowDefault) continue;
    const fallback = (defaults[field.key] ?? "").trim();
    if (fallback !== "" && (filled[field.key] ?? "").trim() === "") filled[field.key] = fallback;
  }
  return filled;
}

/**
 * Required fields the import cannot start without: neither a column of the file nor a value
 * chosen for the whole file fills them.
 */
export function missingRequired(
  fields: FieldDescriptor[],
  mapping: ColumnMapping,
  defaults: FieldDefaults,
): string[] {
  return fields
    .filter((field) => {
      if (!field.required) return false;
      const mapped = mapping[field.key];
      if (mapped !== null && mapped !== undefined) return false;
      return !(field.allowDefault && (defaults[field.key] ?? "").trim() !== "");
    })
    .map((field) => field.label);
}
