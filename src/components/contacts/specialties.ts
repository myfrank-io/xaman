import { CONTACT_SPECIALTIES, type ContactSpecialty } from "@/lib/schemas/contacts";

export type SpecialtyLabel = (key: ContactSpecialty) => string;

/**
 * The chips offered for a trade: the built-in list, plus every trade this boat already uses.
 *
 * The seven built-ins cover a French yard; the eighth is whatever this boat needs. Typing it
 * once under « Autre » used to help only that one contact — it is now a chip for the next,
 * which is what « adding a category » means here, with no table and no settings screen.
 */
export function specialtyOptions(label: SpecialtyLabel, used: string[] = []): string[] {
  const builtIn = CONTACT_SPECIALTIES.filter((key) => key !== "other").map((key) => label(key));
  const seen = new Set(builtIn.map(normalise));
  const extra: string[] = [];
  for (const value of used) {
    const trimmed = value.trim();
    if (trimmed === "" || seen.has(normalise(trimmed))) continue;
    seen.add(normalise(trimmed));
    extra.push(trimmed);
  }
  return [...builtIn, ...extra.sort((a, b) => a.localeCompare(b, "fr"))];
}

export function isListedSpecialty(
  value: string,
  label: SpecialtyLabel,
  used: string[] = [],
): boolean {
  return specialtyOptions(label, used).includes(value);
}

export type ContactOption = {
  id: string;
  name: string;
  specialty: string;
  company?: string | null;
  phone?: string | null;
};

// Groups by specialty label, alphabetically, names sorted inside each group.
export function groupBySpecialty<T extends ContactOption>(
  contacts: T[],
  otherLabel: string,
): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const contact of contacts) {
    const key = contact.specialty.trim() || otherLabel;
    groups.set(key, [...(groups.get(key) ?? []), contact]);
  }
  return [...groups.entries()]
    .map(([key, list]): [string, T[]] => [
      key,
      [...list].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    ])
    .sort((a, b) => a[0].localeCompare(b[0], "fr"));
}

// Accent- and case-insensitive « contains », for the search field.
export function normalise(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function contactLabel(contact: ContactOption): string {
  return contact.company ? `${contact.name} — ${contact.company}` : contact.name;
}
