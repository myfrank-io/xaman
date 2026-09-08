import { z } from "zod";

import {
  inboxSuggestionSchema,
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
  contacts: { id: string; name: string; company: string | null; specialty: string }[];
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

An invoice that mixes labour and parts is an intervention. A quote is an intervention too (the person decides what to do with it). A receipt with only goods is a purchase.

Rules:
- Write every text you produce in French, short and factual. Never invent a figure: a value you cannot read is null, and you say so in "warnings".
- "date" is the date of the work or of the purchase, in yyyy-MM-dd; use the invoice date when no other is stated; null when none.
- "amount" is the total including tax (TTC) of the whole document, as a number in the document's currency; null when unreadable.
- Choose "categoryId" and "contactId" only among the ids given for this boat, and only when the match is clear; otherwise null. "supplierName" is the supplier as written on the document even when a contact matches.
- "engineHours" lists hour-meter readings the document states explicitly, each tied to one of the boat's engine ids; an empty list when none.
- "lineItems" are the main lines of the document (at most 30), designation and amount.
- "notes" is a two-sentence summary worth keeping under the intervention, or null.
- "confidence" is your own reading: "high" when title, date and amount are all read cleanly, "low" when the document is hard to read or is not a maintenance document at all.
- "purchaseKind" is one of gas, part, service, other — meaningful only for a purchase.`;

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
  contactId: z.string().nullable(),
  categoryId: z.string().nullable(),
  engineHours: z.array(z.object({ engineId: z.string(), hours: z.number() })),
  lineItems: z.array(z.object({ designation: z.string(), amount: z.number().nullable() })),
  notes: z.string().nullable(),
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
    `Contacts (contactId → name, company, specialty): ${JSON.stringify(context.contacts)}`,
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
  const clip = (value: string | null, max: number) =>
    value === null ? null : value.trim().slice(0, max) || null;

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
    contactId: output.contactId && contactIds.has(output.contactId) ? output.contactId : null,
    categoryId: output.categoryId && categoryIds.has(output.categoryId) ? output.categoryId : null,
    engineHours: output.engineHours
      .filter((row) => engineIds.has(row.engineId) && Number.isFinite(row.hours) && row.hours >= 0)
      .slice(0, 6)
      .map((row) => ({ engineId: row.engineId, hours: Math.round(row.hours * 10) / 10 })),
    lineItems: output.lineItems.slice(0, 30).map((line) => ({
      designation: line.designation.trim().slice(0, 160),
      amount: line.amount !== null && Number.isFinite(line.amount) ? line.amount : null,
    })),
    notes: clip(output.notes, 2000),
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
