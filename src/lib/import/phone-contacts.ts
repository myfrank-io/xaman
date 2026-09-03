import { CONTACT_HEADERS } from "@/lib/import/vcard";
import type { ParsedTable } from "@/lib/import/parse";

/**
 * Reading the phone's own address book (Contact Picker API).
 *
 * « On doit changer des contacts en vcf au lieu de les choisir dans nos contacts, allô, on est
 * sur tél. » Right: exporting a vCard and finding it again in Files is five steps for one
 * number. Where the browser exposes the address book, we ask for it.
 *
 * It is Chromium-on-Android by default; iOS Safari has it behind a feature flag, so most
 * people on an iPhone will not have it. That is why every entry point is feature-detected and
 * simply absent rather than offered and broken — there is no web API to fall back to, and a
 * button that cannot work is worse than no button.
 *
 * The picked cards are turned into the same table a `.vcf` produces, so they go through the
 * existing mapping, duplicate detection and preview. No second write path.
 */

/** What the browser hands back: every field is a list, and every list may be empty. */
type PickedContact = {
  name?: string[];
  tel?: string[];
  email?: string[];
  address?: unknown[];
};

type ContactsManager = {
  select: (properties: string[], options?: { multiple?: boolean }) => Promise<PickedContact[]>;
  getProperties: () => Promise<string[]>;
};

function manager(): ContactsManager | null {
  if (typeof navigator === "undefined") return null;
  const candidate = (navigator as Navigator & { contacts?: unknown }).contacts as
    ContactsManager | undefined;
  if (!candidate || typeof candidate.select !== "function") return null;
  // A secure context is required, and the picker only exists on the top-level document.
  if (typeof window !== "undefined" && window.top !== window.self) return null;
  return candidate;
}

/** True when this browser can open the address book. Call it in an effect, never on the server. */
export function canPickPhoneContacts(): boolean {
  return manager() !== null;
}

/** First non-empty entry, trimmed; the browser may return empty strings. */
function first(values: unknown[] | undefined): string {
  if (!Array.isArray(values)) return "";
  for (const value of values) {
    if (typeof value !== "string") continue;
    const trimmed = value.trim();
    if (trimmed !== "") return trimmed;
  }
  return "";
}

/**
 * One row per card, in the column order of `CONTACT_HEADERS`. A card with no name is dropped:
 * the name is the natural key of a provider, and a nameless row can only become a duplicate.
 */
export function contactsToTable(contacts: PickedContact[]): ParsedTable {
  const rows: string[][] = [];
  for (const contact of contacts) {
    const name = first(contact.name);
    if (name === "") continue;
    rows.push([name, "", "", first(contact.tel), first(contact.email), "", ""]);
  }
  return { headers: CONTACT_HEADERS, rows, delimiter: "\t" };
}

export class ContactPickerUnavailable extends Error {}

/**
 * Opens the address book and returns the chosen cards as a table. Resolves to a table with no
 * rows when the person picks nothing or dismisses the sheet — that is a choice, not a failure.
 */
export async function pickPhoneContacts(): Promise<ParsedTable> {
  const contacts = manager();
  if (!contacts) throw new ContactPickerUnavailable();
  // Ask only for what a provider record holds. `getProperties` first: a browser that lacks one
  // of these rejects the whole call rather than returning the rest.
  const supported = await contacts.getProperties();
  const wanted = ["name", "tel", "email"].filter((property) => supported.includes(property));
  if (!wanted.includes("name")) throw new ContactPickerUnavailable();
  const picked = await contacts.select(wanted, { multiple: true });
  return contactsToTable(picked);
}
