import { emailKey, foldName, matchSupplierContact, phoneKey } from "@/lib/contacts/match";
import { normaliseForMatch } from "@/lib/equipment-kinds";
import {
  isCheckedByDefault,
  type InboxBatchLine,
  type InboxIdentityField,
} from "@/lib/schemas/inbox";

/**
 * What a read document would do to the carnet, line by line (E17-2, D113).
 *
 * The rule this module exists to enforce: **le carnet fait foi**. A document proposes, it never
 * writes, and a line that contradicts something already recorded is shown *beside* it and arrives
 * unchecked — because a document can be read perfectly and still be out of date. Xaman's own
 * order sheet is the specimen: dated January 2023, delivered a year later, five items changed in
 * between. No quality of reading catches that; only a person knows the pack was swapped.
 *
 * It is a pure function of « the batch » and « what the boat already holds », so the screen and
 * the Server Action that writes both read the same answer instead of deciding twice.
 */

/** What the boat already holds, as the matching needs it. */
export type CarnetEquipment = {
  id: string;
  name: string;
  kindRef: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  quantity: number;
};

export type CarnetContact = {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
};

export type Carnet = {
  equipment: CarnetEquipment[];
  contacts: CarnetContact[];
  /** The boat's own identity fields, as they stand. Absent keys are simply not recorded yet. */
  identity: Partial<Record<InboxIdentityField, string | null>>;
};

/** One difference worth showing side by side: what the carnet says, what the document says. */
export type Divergence = { field: string; carnet: string; document: string };

export type BatchOutcome =
  /** Nothing in the carnet looks like this line. */
  | { kind: "create" }
  /** The carnet already holds it, and says the same thing. Nothing to do. */
  | { kind: "same"; targetId: string | null }
  /** The carnet holds it but says nothing about some of what the document says. */
  | { kind: "fill"; targetId: string | null; fields: string[] }
  /** The carnet holds it and says something else (D113). */
  | { kind: "contradiction"; targetId: string | null; divergences: Divergence[] };

export type PlannedLine = {
  line: InboxBatchLine;
  outcome: BatchOutcome;
  /** Whether the line arrives ticked on the screen. */
  checked: boolean;
};

/** Two texts are the same thing when they read the same (D113: never a raw string compare). */
function sameText(a: string | null | undefined, b: string | null | undefined): boolean {
  return normaliseForMatch(a ?? "") === normaliseForMatch(b ?? "");
}

function filled(value: string | null | undefined): boolean {
  return (value ?? "").trim() !== "";
}

/**
 * The equipment of the carnet this line is about, or null.
 *
 * **By family, brand and model — never by label** (D113, `AUTOPILOT.md §2.3` rule 5). « Chauffage
 * Wallas 30DT » and « chauffage fuel à air pulsé » are one appliance; matched on their labels they
 * would make two lines instead of one visible contradiction, which is the failure this rule names.
 *
 * A serial number, when both sides carry one, settles it on its own: it is the only field on a
 * boat that identifies one object rather than a sort of object.
 */
export function matchEquipment(
  line: InboxBatchLine,
  equipment: CarnetEquipment[],
): CarnetEquipment | null {
  if (filled(line.serial)) {
    const bySerial = equipment.find(
      (row) => filled(row.serial) && sameText(row.serial, line.serial),
    );
    if (bySerial) return bySerial;
  }
  if (!line.kindRef) return null;
  const family = equipment.filter((row) => row.kindRef === line.kindRef);
  if (family.length === 0) return null;
  // Within a family, the brand narrows; without a brand on either side the family is the answer.
  const byBrand = family.filter((row) => !filled(line.brand) || sameText(row.brand, line.brand));
  const candidates = byBrand.length > 0 ? byBrand : family;
  if (filled(line.model)) {
    const byModel = candidates.find((row) => sameText(row.model, line.model));
    if (byModel) return byModel;
  }
  // One of a family is the one this is about; several and no way to tell is not a match.
  return candidates.length === 1 ? (candidates[0] ?? null) : null;
}

/**
 * The contact this provider line is about, or null.
 *
 * `matchSupplierContact` (D120) already answers this exact question for the supplier block of an
 * invoice — e-mail, then telephone compared on its last nine digits so `02 97 …` and `+33 2 97 …`
 * are one number, then the name. A batch line's provider is the same block read off the same sort
 * of page, so it gets the same answer rather than a second rule that would drift from it.
 */
export function matchContact(
  line: InboxBatchLine,
  contacts: CarnetContact[],
): CarnetContact | null {
  if (!line.provider) return null;
  const match = matchSupplierContact(line.provider, contacts);
  return match ? (contacts.find((row) => row.id === match.contactId) ?? null) : null;
}

/** What the equipment fields of a line say, next to what the carnet says about the same row. */
const EQUIPMENT_FIELDS = ["brand", "model", "serial"] as const;

function planEquipment(line: InboxBatchLine, carnet: Carnet): BatchOutcome {
  const match = matchEquipment(line, carnet.equipment);
  if (!match) return { kind: "create" };

  const divergences: Divergence[] = [];
  const blanks: string[] = [];
  for (const field of EQUIPMENT_FIELDS) {
    const read = line[field];
    if (!filled(read)) continue;
    const held = match[field];
    if (!filled(held)) blanks.push(field);
    else if (!sameText(held, read)) {
      divergences.push({ field, carnet: held as string, document: read as string });
    }
  }
  // A quantity the document states and the carnet contradicts is worth seeing: « 2 » on a heater
  // means one per hull, and a carnet holding one has half the boat's heating unrecorded.
  if (line.quantity !== match.quantity) {
    divergences.push({
      field: "quantity",
      carnet: String(match.quantity),
      document: String(line.quantity),
    });
  }

  if (divergences.length > 0) return { kind: "contradiction", targetId: match.id, divergences };
  if (blanks.length > 0) return { kind: "fill", targetId: match.id, fields: blanks };
  return { kind: "same", targetId: match.id };
}

/**
 * Each provider field compared the way it is *identified*, not as raw text.
 *
 * This is not a nicety: the matching finds the fiche by the last nine digits of its number, so
 * comparing `+33297000000` against `02 97 00 00 00` as strings would report the very field that
 * matched as a disagreement — and put a contradiction on screen where there is none.
 */
const PROVIDER_FIELDS = [
  { field: "company", key: foldName },
  { field: "email", key: (value: string) => emailKey(value) ?? value.trim().toLowerCase() },
  { field: "phone", key: (value: string) => phoneKey(value) ?? value.replace(/\D+/g, "") },
] as const;

function planProvider(line: InboxBatchLine, carnet: Carnet): BatchOutcome {
  const match = matchContact(line, carnet.contacts);
  if (!match) return { kind: "create" };
  const provider = line.provider;
  const divergences: Divergence[] = [];
  const blanks: string[] = [];
  for (const { field, key } of PROVIDER_FIELDS) {
    const read = provider?.[field] ?? null;
    if (!filled(read)) continue;
    const held = match[field];
    if (!filled(held)) blanks.push(field);
    else if (key(held as string) !== key(read as string)) {
      divergences.push({ field, carnet: held as string, document: read as string });
    }
  }
  if (divergences.length > 0) return { kind: "contradiction", targetId: match.id, divergences };
  if (blanks.length > 0) return { kind: "fill", targetId: match.id, fields: blanks };
  return { kind: "same", targetId: match.id };
}

function planIdentity(line: InboxBatchLine, carnet: Carnet): BatchOutcome {
  const field = line.identityField;
  const read = line.identityValue;
  if (!field || !filled(read)) return { kind: "create" };
  const held = carnet.identity[field] ?? null;
  if (!filled(held)) return { kind: "create" };
  if (sameText(held, read)) return { kind: "same", targetId: null };
  return {
    kind: "contradiction",
    targetId: null,
    divergences: [{ field, carnet: held as string, document: read as string }],
  };
}

/**
 * A deadline is never a contradiction: a newer certificate replacing an older one is the normal
 * life of a liferaft, not a disagreement. It is a realisation to record (E17-6), so it is always
 * something to do.
 */
function planDeadline(): BatchOutcome {
  return { kind: "create" };
}

/**
 * What the whole batch would do, and what arrives ticked.
 *
 * A line is ticked only when the document vouches for it (`fitted` or `retained`, E17-1) **and**
 * it has something to add. A contradiction is never ticked — D113 — and neither is a line the
 * carnet already agrees with, because ticking it would ask for a decision about nothing.
 */
export function planBatch(batch: InboxBatchLine[], carnet: Carnet): PlannedLine[] {
  return batch.map((line) => {
    const outcome =
      line.type === "equipment"
        ? planEquipment(line, carnet)
        : line.type === "provider"
          ? planProvider(line, carnet)
          : line.type === "identity"
            ? planIdentity(line, carnet)
            : planDeadline();
    const worthDoing = outcome.kind === "create" || outcome.kind === "fill";
    return { line, outcome, checked: isCheckedByDefault(line) && worthDoing };
  });
}

/** What the screen counts above the list, and what the report says afterwards (E12-1's format). */
export type BatchTally = {
  create: number;
  fill: number;
  same: number;
  contradiction: number;
  checked: number;
};

export function tallyBatch(planned: PlannedLine[]): BatchTally {
  const tally: BatchTally = { create: 0, fill: 0, same: 0, contradiction: 0, checked: 0 };
  for (const row of planned) {
    tally[row.outcome.kind] += 1;
    if (row.checked) tally.checked += 1;
  }
  return tally;
}
