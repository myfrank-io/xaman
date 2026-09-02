import { CONTACT_SPECIALTIES, type ContactSpecialty } from "@/lib/schemas/contacts";

export type SpecialtyLabel = (key: ContactSpecialty) => string;

// The closed list without « Autre », as French labels (the column stores the label).
export function specialtyOptions(label: SpecialtyLabel): string[] {
  return CONTACT_SPECIALTIES.filter((key) => key !== "other").map((key) => label(key));
}

export function isListedSpecialty(value: string, label: SpecialtyLabel): boolean {
  return specialtyOptions(label).includes(value);
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
