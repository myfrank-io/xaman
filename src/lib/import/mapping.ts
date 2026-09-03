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
};

export type ColumnMapping = Record<string, number | null>;

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

/** Required fields left unmapped: the import cannot start until they are chosen. */
export function missingRequired(fields: FieldDescriptor[], mapping: ColumnMapping): string[] {
  return fields
    .filter(
      (field) =>
        field.required && (mapping[field.key] === null || mapping[field.key] === undefined),
    )
    .map((field) => field.label);
}
