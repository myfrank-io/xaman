import { z } from "zod";

import { matchSupplierContact, type SupplierRead } from "@/lib/contacts/match";
import {
  inboxSuggestionSchema,
  INVENTORY_LINES_MAX,
  INVENTORY_SPECS_MAX,
  INBOX_CONFIDENCES,
  INBOX_DOCUMENT_TYPES,
  INBOX_KINDS,
  type InboxSuggestion,
} from "@/lib/schemas/inbox";
import { VISIBLE_PURCHASE_KINDS } from "@/lib/schemas/purchases";

/**
 * What the document is read against (D91): the boat's own vocabulary, so the reading lands on
 * the boat's systems, its engines and its contacts rather than on free text a person would then
 * have to re-file.
 */
export type InboxContext = {
  boatName: string;
  boatType: string;
  today: string;
  categories: { id: string; name: string; externalRef?: string | null }[];
  engines: { id: string; label: string; propulsion: string }[];
  contacts: {
    id: string;
    name: string;
    company: string | null;
    specialty: string;
    phone: string | null;
    email: string | null;
  }[];
  /**
   * The checklist points a paper can land on (E17-6): the active ones with no hour interval,
   * because an hour-based point is never what a certificate is about. Empty on a boat whose
   * plan has not been chosen yet — the reading then simply never proposes a deadline.
   */
  deadlineItems: { id: string; label: string; category: string }[];
};

/**
 * The stable half of the request, cached across documents: what the app is, what the two lists
 * are, and how to fill the answer. Nothing per-boat and nothing dated lives here — that goes in
 * the user turn — so the prefix is byte-identical from one document to the next.
 */
export const INBOX_SYSTEM_PROMPT = `You read documents for Xaman, a shared maintenance logbook for boats (French users). A document is a photo or a PDF: an invoice from a yard or a mechanic, a shop receipt, a quote, a haul-out report, a photo of a part.

Your job is to propose how the document should be filed in the logbook, so that a person only has to check and confirm. Two lists exist:
- an "intervention" (kind "log"): work done on the boat — a service, a repair, a haul-out, an inspection. Its title says what was done ("Vidange moteur bâbord", "Remplacement turbine", "Carénage").
- a "purchase" (kind "purchase"): something bought — a part, a consumable, fuel or gas, a chandlery receipt with no labour. Its title is a short designation ("Filtre à huile Yanmar", "Bouteille de gaz 13 kg").

- an "inventory" (kind "inventory"): a document whose point is **what is aboard** — a builder's technical specification, a delivery note, an inventory drawn up for a sale, a survey. It does not become one line: it fills the boat's equipment list. Put one entry per piece of equipment in "inventory", and leave "title" as the document's own name ("Spécification technique ORC 50 #25").

- a "deadline" (kind "deadline"): a paper whose point is a validity date — an insurance certificate, a liferaft or extinguisher inspection, a beacon battery, a flare expiry, a warranty. It is filed on one of the boat's checklist points, with the date it stays valid until.

An invoice that mixes labour and parts is an intervention. A quote is an intervention too (the person decides what to do with it). A receipt with only goods is a purchase. A paper that states a validity date, and whose amount is beside the point, is a deadline — even when it also carries a price: what matters is that the boat is covered until a date.

Rules:
- Write every text you produce in French, short and factual. Never invent a figure: a value you cannot read is null, and you say so in "warnings".
- "date" is the date of the work or of the purchase, in yyyy-MM-dd; use the invoice date when no other is stated; null when none.
- "amount" is the total including tax (TTC) of the whole document, as a number in the document's currency; null when unreadable.
- Choose "categoryId" and "contactId" only among the ids given for this boat, and only when the match is clear; otherwise null. "supplierName" is the supplier as written on the document even when a contact matches.
- "supplier" is the issuer's own block, copied from the page and never guessed: "name" the trading name, "company" the raison sociale when it differs, "phone", "email", "address" on one line. A field that is not printed is null. Fill it even when "contactId" matches — it is what creates the fiche when it does not.
- "engineHours" lists hour-meter readings the document states explicitly, each tied to one of the boat's engine ids; an empty list when none.
- "lineItems" are the main lines of the document (at most 30), designation and amount.
- "notes" is a two-sentence summary worth keeping under the intervention, or null.
- "confidence" is your own reading: "high" when title, date and amount are all read cleanly, "low" when the document is hard to read or is not a maintenance document at all.
- "purchaseKind" is one of gas, part, service, other — meaningful only for a purchase.
- For an inventory: "inventory" holds one entry per piece of equipment the document names. "name" is what the thing is called aboard, in French and short ("Grand-voile (GV)", "Batteries Lithium", "Guindeau électrique"); "brand" and "model" as printed, null when they are not; "serial" only when a serial number is printed; "quantity" the number aboard, null when not stated; "categoryId" one of the boat's systems or null; "installedAt" yyyy-MM-dd or null. "specs" are the figures the document gives **about that entry**, as key/value pairs — prefer the keys the carnet already uses when they apply: surface_m2, puissance_w, capacite_ah, tension_v, volume_l, debit_l_h, poids_kg, longueur_m, diametre_mm, materiau, emplacement, tissu; otherwise a short snake_case key of your own. Never repeat the name in the specs, never invent a figure, and never list a consumable or a spare part here — those are purchases. A document that names fewer than three pieces of equipment is not an inventory: file it as an intervention or a purchase.
- For a deadline: "checklistItemId" is the point it lands on, chosen only among the ids given for this boat, and "validUntil" is the date it stays valid until in yyyy-MM-dd. When no point clearly matches, or the document states no validity date, the document is not a deadline: file it as an intervention or a purchase instead. On a deadline, "date" is the date of the inspection or of issue, and "title" names the paper ("Révision du radeau de survie", "Attestation d'assurance 2026").`;

/**
 * The shape the model fills. Enums, strings, numbers and nullables only — the reading is checked
 * again with `inboxSuggestionSchema` afterwards, which is where the lengths and ranges live.
 */
export const inboxModelOutputSchema = z.object({
  documentType: z.enum(INBOX_DOCUMENT_TYPES),
  kind: z.enum(INBOX_KINDS),
  purchaseKind: z.enum(VISIBLE_PURCHASE_KINDS),
  title: z.string(),
  date: z.string().nullable(),
  amount: z.number().nullable(),
  currency: z.string().nullable(),
  supplierName: z.string().nullable(),
  supplier: z.object({
    name: z.string().nullable(),
    company: z.string().nullable(),
    phone: z.string().nullable(),
    email: z.string().nullable(),
    address: z.string().nullable(),
  }),
  contactId: z.string().nullable(),
  categoryId: z.string().nullable(),
  engineHours: z.array(z.object({ engineId: z.string(), hours: z.number() })),
  lineItems: z.array(z.object({ designation: z.string(), amount: z.number().nullable() })),
  notes: z.string().nullable(),
  inventory: z.array(
    z.object({
      name: z.string(),
      brand: z.string().nullable(),
      model: z.string().nullable(),
      serial: z.string().nullable(),
      quantity: z.number().nullable(),
      categoryId: z.string().nullable(),
      installedAt: z.string().nullable(),
      specs: z.array(z.object({ key: z.string(), value: z.string() })),
    }),
  ),
  checklistItemId: z.string().nullable(),
  validUntil: z.string().nullable(),
  confidence: z.enum(INBOX_CONFIDENCES),
  warnings: z.array(z.string()),
});
export type InboxModelOutput = z.infer<typeof inboxModelOutputSchema>;

/** The per-document turn: the boat's vocabulary, then the instruction. */
export function contextText(context: InboxContext, fileName: string): string {
  return [
    `Boat: ${JSON.stringify({ name: context.boatName, type: context.boatType })}`,
    `Today: ${context.today}`,
    `Systems (categoryId → name): ${JSON.stringify(context.categories.map((c) => ({ id: c.id, name: c.name })))}`,
    `Engines (engineId → label, propulsion): ${JSON.stringify(context.engines)}`,
    `Contacts (contactId → name, company, specialty, phone, email): ${JSON.stringify(context.contacts)}`,
    `Checklist points a deadline can land on (checklistItemId → label, system): ${JSON.stringify(
      context.deadlineItems.map((item) => ({
        id: item.id,
        label: item.label,
        system: item.category,
      })),
    )}`,
    `File name: ${fileName}`,
    "Read the document above and propose how to file it.",
  ].join("\n");
}

/**
 * The model's answer, made safe for the row: ids it was not given are dropped (the screen would
 * otherwise point at nothing), texts are trimmed to what the columns hold, a date that is not one
 * becomes null, and the whole is checked once more against the stored shape.
 */
export function normaliseSuggestion(
  output: InboxModelOutput,
  context: InboxContext,
): InboxSuggestion | null {
  const categoryIds = new Set(context.categories.map((c) => c.id));
  const contactIds = new Set(context.contacts.map((c) => c.id));
  const engineIds = new Set(context.engines.map((e) => e.id));
  const deadlineItemIds = new Set(context.deadlineItems.map((i) => i.id));
  const clip = (value: string | null, max: number) =>
    value === null ? null : value.trim().slice(0, max) || null;

  const supplier: SupplierRead = {
    // `supplierName` is the older half of the same answer: when the block carries no name, it is
    // still the name written on the document, and the matching below needs one.
    name: clip(output.supplier.name, 120) ?? clip(output.supplierName, 120),
    company: clip(output.supplier.company, 120),
    phone: clip(output.supplier.phone, 40),
    email: clip(output.supplier.email, 160),
    // One line: the column is 300 and a screen is not a letterhead.
    address: clip(output.supplier.address?.replace(/\s*\n\s*/g, ", ") ?? null, 300),
  };

  const candidate = {
    documentType: output.documentType,
    kind: output.kind,
    purchaseKind: output.purchaseKind,
    title: output.title.trim().slice(0, 160) || "Document",
    date: /^\d{4}-\d{2}-\d{2}$/.test(output.date ?? "") ? output.date : null,
    amount:
      output.amount !== null && Number.isFinite(output.amount) && output.amount >= 0
        ? Math.round(output.amount * 100) / 100
        : null,
    currency: clip(output.currency, 3)?.toUpperCase() ?? null,
    supplierName: clip(output.supplierName, 120),
    supplier,
    // What the model did not recognise, the annuaire often does (D120): an exact e-mail, an
    // exact number, a name one of the two spells with « SARL » in front. Never the reverse —
    // a contactId the model gave is the model's answer, and this only fills a null.
    contactId:
      (output.contactId && contactIds.has(output.contactId) ? output.contactId : null) ??
      matchSupplierContact(supplier, context.contacts)?.contactId ??
      null,
    categoryId: output.categoryId && categoryIds.has(output.categoryId) ? output.categoryId : null,
    engineHours: output.engineHours
      .filter((row) => engineIds.has(row.engineId) && Number.isFinite(row.hours) && row.hours >= 0)
      .slice(0, 6)
      .map((row) => ({ engineId: row.engineId, hours: Math.round(row.hours * 10) / 10 })),
    lineItems: output.lineItems.slice(0, 30).map((line) => ({
      designation: line.designation.trim().slice(0, 160),
      amount: line.amount !== null && Number.isFinite(line.amount) ? line.amount : null,
    })),
    // An inventory (E2-10): the lines a builder's document names, each cut to what the columns
    // hold. A system it was not given is dropped rather than pointed at nothing, and a line with
    // no name is not a line at all.
    inventory: output.inventory
      .slice(0, INVENTORY_LINES_MAX)
      .map((line) => ({
        name: (clip(line.name, 120) ?? "").trim(),
        brand: clip(line.brand, 80),
        model: clip(line.model, 80),
        serial: clip(line.serial, 80),
        quantity:
          line.quantity !== null && Number.isFinite(line.quantity) && line.quantity >= 0
            ? Math.min(9999, Math.round(line.quantity))
            : null,
        categoryId: line.categoryId && categoryIds.has(line.categoryId) ? line.categoryId : null,
        installedAt: /^\d{4}-\d{2}-\d{2}$/.test(line.installedAt ?? "") ? line.installedAt : null,
        specs: line.specs
          .map((spec) => ({
            key: (clip(spec.key, 60) ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            value: clip(spec.value, 200) ?? "",
          }))
          .filter((spec) => spec.key !== "" && spec.value !== "")
          .slice(0, INVENTORY_SPECS_MAX),
      }))
      .filter((line) => line.name !== ""),
    notes: clip(output.notes, 2000),
    checklistItemId:
      output.checklistItemId && deadlineItemIds.has(output.checklistItemId)
        ? output.checklistItemId
        : null,
    validUntil: /^\d{4}-\d{2}-\d{2}$/.test(output.validUntil ?? "") ? output.validUntil : null,
    confidence: output.confidence,
    warnings: output.warnings
      .map((w) => w.trim().slice(0, 200))
      .filter(Boolean)
      .slice(0, 6),
  };
  const parsed = inboxSuggestionSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

/** Image types the model reads; HEIC — what an iPad mails — is not one of them. */
export const ANALYSABLE_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export function isAnalysable(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" ||
    (ANALYSABLE_IMAGE_TYPES as readonly string[]).includes(mimeType)
  );
}
