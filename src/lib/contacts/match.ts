/**
 * Rapprocher le prestataire lu sur un document avec l'annuaire du bateau (D120).
 *
 * Une facture porte toujours de quoi reconnaître son émetteur — un nom, une raison sociale, un
 * téléphone, un e-mail — et le carnet porte déjà, la plupart du temps, la fiche de ce même
 * prestataire. Sans rapprochement, chaque document repose la question « qui a fait ça ? » à une
 * personne qui l'a déjà répondu dix fois, et la réponse finit en texte libre à côté de la fiche
 * qui existe.
 *
 * Trois clés, dans cet ordre, parce que c'est l'ordre de leur certitude :
 *   1. l'e-mail — une adresse identifie une entreprise, la comparaison est exacte ;
 *   2. le téléphone — comparé sur ses chiffres seuls, indicatif national ramené à sa forme
 *      locale, parce que `+33 2 97 …` et `02 97 …` sont le même numéro ;
 *   3. le nom ou la raison sociale — accents et casse ignorés, et seulement quand l'un contient
 *      l'autre sur une longueur qui veut dire quelque chose.
 *
 * Pas de score flou et pas de quasi-correspondance : un rapprochement douteux écrit une facture
 * sous le mauvais prestataire, là où une absence de rapprochement coûte un tap. C'est la même
 * règle que partout ailleurs dans la lecture — ce qu'on ne sait pas lire est nul (D92).
 *
 * Le module est pur et sans dépendance : il sert à la lecture côté serveur
 * (`normaliseSuggestion`) et à l'écran qui propose de créer la fiche.
 */

/** A contact of the boat, as much of it as the matching needs. */
export type ContactLike = {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
};

/** The provider block as a document spells it — every field optional, nothing invented. */
export type SupplierRead = {
  name: string | null;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};

export const EMPTY_SUPPLIER: SupplierRead = {
  name: null,
  company: null,
  phone: null,
  email: null,
  address: null,
};

/** Which key matched: the screen says « reconnu par son e-mail » rather than « reconnu ». */
export type SupplierMatchKey = "email" | "phone" | "name";
export type SupplierMatch = { contactId: string; key: SupplierMatchKey };

/** Shortest name that may match by containment: « SA » must not catch « Sarl Machin ». */
const MIN_NAME_LENGTH = 4;
/** A French number is 9 digits after its trunk; below that there is nothing to compare. */
const MIN_PHONE_DIGITS = 9;

/** Lower-case, accents dropped, punctuation and company forms removed, spaces collapsed. */
export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(sarl|sas|sasu|sa|eurl|ets|etablissements|sci|scop|snc|cie|societe)\b/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/**
 * The digits that identify a number: the last nine, so that `+33 2 97 55 …`, `0033297…` and
 * `02 97 55 …` all come down to the same string. Anything shorter is not compared at all.
 */
export function phoneKey(value: string): string | null {
  const digits = value.replace(/\D+/g, "");
  if (digits.length < MIN_PHONE_DIGITS) return null;
  return digits.slice(-MIN_PHONE_DIGITS);
}

export function emailKey(value: string): string | null {
  const trimmed = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

function namesMatch(read: string, known: string): boolean {
  const a = foldName(read);
  const b = foldName(known);
  if (a.length < MIN_NAME_LENGTH || b.length < MIN_NAME_LENGTH) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/**
 * The contact this document is from, or null. `supplierName` is what the older readings carry
 * instead of a whole block — it is matched on the name alone, which is what it is.
 */
export function matchSupplierContact(
  supplier: SupplierRead,
  contacts: readonly ContactLike[],
): SupplierMatch | null {
  const read = {
    email: supplier.email ? emailKey(supplier.email) : null,
    phone: supplier.phone ? phoneKey(supplier.phone) : null,
  };

  if (read.email) {
    const found = contacts.find(
      (contact) => contact.email && emailKey(contact.email) === read.email,
    );
    if (found) return { contactId: found.id, key: "email" };
  }
  if (read.phone) {
    const found = contacts.find(
      (contact) => contact.phone && phoneKey(contact.phone) === read.phone,
    );
    if (found) return { contactId: found.id, key: "phone" };
  }
  for (const written of [supplier.company, supplier.name]) {
    if (!written) continue;
    const found = contacts.find(
      (contact) =>
        namesMatch(written, contact.name) ||
        (contact.company ? namesMatch(written, contact.company) : false),
    );
    if (found) return { contactId: found.id, key: "name" };
  }
  return null;
}

/** Whether the reading holds enough to be worth showing — and to open a contact form with. */
export function hasSupplierDetails(
  supplier: SupplierRead | null | undefined,
): supplier is SupplierRead {
  if (!supplier) return false;
  return Boolean(supplier.name ?? supplier.company ?? supplier.phone ?? supplier.email);
}

/** The name a new fiche opens on: the person named on the document, else the company. */
export function supplierDisplayName(supplier: SupplierRead): string {
  return (supplier.name ?? supplier.company ?? "").trim();
}

/** What the « créer la fiche » form opens on: the document's block, without saying it twice. */
export function contactDraftFromSupplier(supplier: SupplierRead): {
  name: string;
  company: string;
  phone: string;
  email: string;
  address: string;
} {
  const name = supplierDisplayName(supplier);
  const company = (supplier.company ?? "").trim();
  return {
    name,
    // A yard whose name *is* its company fills one field, not two identical ones.
    company: company && foldName(company) !== foldName(name) ? company : "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
  };
}
