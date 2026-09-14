import { z } from "zod";

import { EMPTY_SUPPLIER } from "@/lib/contacts/match";

import { isoDate, nullableDecimal, nullableText, requiredText, uuid } from "@/lib/schemas/common";
import { attachmentExtension, ATTACHMENT_MAX_BYTES } from "@/lib/schemas/attachments";
import { COST_MAX, LOG_CATEGORIES_MAX } from "@/lib/schemas/logs";
import { PURCHASE_AMOUNT_MAX, VISIBLE_PURCHASE_KINDS } from "@/lib/schemas/purchases";

/**
 * The inbox (D91): documents that arrive on their own — mailed to the boat's address, or
 * photographed in the app — and wait for someone to turn them into an intervention or a purchase.
 */
export const INBOX_SOURCES = ["email", "upload"] as const;
export const inboxSourceSchema = z.enum(INBOX_SOURCES);
export type InboxSource = z.infer<typeof inboxSourceSchema>;

export const INBOX_STATUSES = ["received", "analysing", "ready", "validated", "dismissed"] as const;
export const inboxStatusSchema = z.enum(INBOX_STATUSES);
export type InboxStatus = z.infer<typeof inboxStatusSchema>;

/** Why a document has no suggestion — translation keys under `inbox.errors`. */
export const INBOX_ERROR_KEYS = [
  "notConfigured",
  "unsupportedFormat",
  "download",
  "analysis",
  "refused",
  "noText",
] as const;
export const inboxErrorKeySchema = z.enum(INBOX_ERROR_KEYS);
export type InboxErrorKey = z.infer<typeof inboxErrorKeySchema>;

/**
 * What the local reader (D92) puts in `warnings` — codes, translated under `inbox.warningCodes`;
 * the model writes French sentences there instead, shown as they are.
 *
 * `local` keeps its name here, but the screen never says which reader ran: the French wording
 * speaks of "un agent IA" whoever read the document (D94), so the card says the same thing the
 * day the key is set. What it does keep saying, in every sentence, is to check the fields.
 */
export const INBOX_WARNING_CODES = [
  "local",
  "ocrQuality",
  "noDate",
  "dateUnlabelled",
  "noAmount",
  "amountGuessed",
  "noSupplier",
  "noCategory",
] as const;
export type InboxWarningCode = (typeof INBOX_WARNING_CODES)[number];
export function isInboxWarningCode(value: string): value is InboxWarningCode {
  return (INBOX_WARNING_CODES as readonly string[]).includes(value);
}

/**
 * Kinds a document can be filed as. Two of them are lists a receipt lands in; the third is the
 * one a *paper* lands in (E17-6): an insurance certificate, a liferaft or extinguisher
 * inspection, a warranty — a document whose whole content is « this is valid until ». It becomes
 * a realisation on a checklist item carrying `next_due_at` (D11), which is what the « Fait »
 * dialog already writes, so the deadline lands in the queue with a real date instead of an
 * estimate.
 *
 * The fourth is the odd one out: an `inventory` writes **no line of the carnet at all** (E2-10,
 * D123). A builder's specification says what the boat carries, so it fills the equipment list —
 * through the import screen, which already reviews a list before writing it. `INBOX_FILINGS`
 * below therefore does not carry it: « Valider » never files an inventory.
 */
export const INBOX_KINDS = ["log", "purchase", "deadline", "inventory"] as const;
export const inboxKindSchema = z.enum(INBOX_KINDS);
export type InboxKind = z.infer<typeof inboxKindSchema>;

/**
 * What « Valider » can do with a card (D109). The three filing kinds above create a line; `attach` hangs
 * the document on an intervention the carnet already has — an invoice mailed in for last week's
 * work, a photo of a page already noted. It is deliberately *not* an `InboxKind`: a kind is what
 * a document becomes, and `inboxEntityId` derives an id from it (D97), whereas an attachment
 * brings the id of the line the person picked. The reading never proposes it.
 */
export const INBOX_FILINGS = ["log", "purchase", "deadline", "attach"] as const;
export const inboxFilingSchema = z.enum(INBOX_FILINGS);
export type InboxFiling = z.infer<typeof inboxFilingSchema>;

/**
 * The id of the line a document is about to become — derived from the document, not drawn at
 * random, so that a second « Valider » on the same card writes the same line again instead of a
 * second one.
 *
 * Why derived rather than remembered: `inbox_items.log_id` and `purchase_id` carry a foreign key
 * (migration `0026`), so the id cannot be written on the row *before* the intervention exists —
 * the row would point at nothing and the update would be refused. Reserving it in the database
 * would need a column that is not a foreign key, hence a migration. Deriving it needs nothing:
 * the same document and the same kind always give the same id, on this device and on the next.
 *
 * The derivation keeps every bit of the item's own randomness (a XOR against a fixed mask, then
 * the version and variant nibbles of a UUID v4), so two documents can no more collide here than
 * two `crypto.randomUUID()` can; and a document filed as an intervention and the same document
 * filed as a purchase never share an id, because the masks differ.
 */
const ENTITY_ID_MASK: Record<InboxKind, string> = {
  log: "9b1d4a6f2c8e5730a41f6d92b8c30e75",
  purchase: "3e7c85a09d24b16fc0538ea7412d9b6e",
  deadline: "c4a70f13e85b269d7ac1054fb3e28d96",
  // An inventory becomes many rows, not one: this mask names the document, and the import
  // matches each line by its name the way a spreadsheet does.
  inventory: "5f2b93c6a0d748e1b7539c2f86ad401b",
};

export function inboxEntityId(itemId: string, kind: InboxKind): string {
  const hex = itemId.replace(/-/g, "").toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) {
    throw new TypeError("inboxEntityId: itemId must be a UUID");
  }
  const mask = ENTITY_ID_MASK[kind];
  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 2) {
    bytes.push(
      Number.parseInt(hex.slice(i, i + 2), 16) ^ Number.parseInt(mask.slice(i, i + 2), 16),
    );
  }
  // A uuid is all the column asks for: version 4, variant 1.
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const out = bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return [
    out.slice(0, 8),
    out.slice(8, 12),
    out.slice(12, 16),
    out.slice(16, 20),
    out.slice(20, 32),
  ].join("-");
}

/**
 * `boats/{boat_id}/inbox/{item_id}.{ext}` — the same first segment the storage policies and the
 * `inbox_items_path_boat` check read. The document keeps this path for life: validation writes
 * an `attachments` row pointing at it rather than moving the object.
 */
export function inboxStoragePath(input: {
  boatId: string;
  itemId: string;
  fileName: string;
  mimeType: string;
}): string {
  const ext = attachmentExtension(input.fileName, input.mimeType);
  return `boats/${input.boatId}/inbox/${input.itemId}.${ext}`;
}

/** The mail address of a boat: `<slug>-<token>@<domain>`, with the slug for the reader only. */
export function inboxAddress(boatName: string, token: string, domain: string): string {
  const slug =
    boatName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "carnet";
  return `${slug}-${token}@${domain}`;
}

/**
 * The token out of an address as a mail server hands it back — `"Xaman" <xaman-abc123@…>`,
 * upper-cased, with a display name — or null when it is not one of ours. The matching is on the
 * token alone (the last dash-separated part of the local part), so a renamed boat keeps its
 * address and the slug is never trusted.
 */
export function inboxTokenFromAddress(address: string, domain: string): string | null {
  const bare = (/<([^>]+)>/.exec(address)?.[1] ?? address).trim().toLowerCase();
  const at = bare.lastIndexOf("@");
  if (at <= 0) return null;
  if (bare.slice(at + 1) !== domain.toLowerCase()) return null;
  const local = bare.slice(0, at);
  const token = local.slice(local.lastIndexOf("-") + 1);
  return /^[a-z0-9]{6,32}$/.test(token) ? token : null;
}

// ---------------------------------------------------------------------------------------------
// What the analysis returns — the shape Claude is asked to fill (structured output), stored as is
// in `inbox_items.suggestion` and validated again when read: a row written by an earlier version
// of the prompt must never break the screen.
// ---------------------------------------------------------------------------------------------
export const INBOX_DOCUMENT_TYPES = [
  "invoice",
  "receipt",
  "quote",
  "report",
  /** A paper that carries a validity date: insurance, liferaft, extinguishers, warranty. */
  "certificate",
  "photo",
  "other",
] as const;
export const INBOX_CONFIDENCES = ["high", "medium", "low"] as const;

/** The provider block of a document, every field optional and nothing invented (D120). */
export const supplierReadSchema = z.object({
  name: z.string().trim().max(120).nullable(),
  company: z.string().trim().max(120).nullable(),
  phone: z.string().trim().max(40).nullable(),
  // Never `.email()`: a badly OCR-ed address must not make the whole reading unparseable — the
  // screen shows it, the person corrects it, and `matchSupplierContact` only matches a valid one.
  email: z.string().trim().max(160).nullable(),
  address: z.string().trim().max(300).nullable(),
});

/**
 * One piece of equipment a document says is aboard (E2-10).
 *
 * A builder's technical specification, a delivery note, an inventory drawn up for a sale: a
 * document whose whole point is **what the boat carries**. It does not become one line of the
 * carnet, it fills the equipment list — and with it the maquette, which draws the boat from that
 * very list (D117).
 *
 * `specs` are the free pairs `equipment.specs` already holds, with the carnet's own keys where
 * they exist (`surface_m2`, `puissance_w`, `emplacement`…). They are what turns « Grand-voile »
 * into « Grand-voile · 88 m² · Hydranet » on the screen that names the boat's parts.
 */
export const INVENTORY_LINES_MAX = 80;
export const INVENTORY_SPECS_MAX = 20;

export const inventoryLineSchema = z.object({
  name: z.string().trim().min(1).max(120),
  brand: z.string().trim().max(80).nullable(),
  model: z.string().trim().max(80).nullable(),
  serial: z.string().trim().max(80).nullable(),
  quantity: z.number().int().min(0).max(9999).nullable(),
  /** One of the boat's systems, or null. */
  categoryId: z.string().nullable(),
  installedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  specs: z
    .array(z.object({ key: z.string().trim().min(1).max(60), value: z.string().trim().max(200) }))
    .max(INVENTORY_SPECS_MAX),
});
export type InventoryLine = z.infer<typeof inventoryLineSchema>;

export const inboxSuggestionSchema = z.object({
  documentType: z.enum(INBOX_DOCUMENT_TYPES),
  /** Where it should be filed: an intervention, a purchase, or a deadline (E17-6). */
  kind: inboxKindSchema,
  /** For a purchase: which of the four chips. Ignored on an intervention. */
  purchaseKind: z.enum(VISIBLE_PURCHASE_KINDS),
  /** Title of the intervention or designation of the purchase, in French, short. */
  title: z.string().trim().min(1).max(160),
  /** `yyyy-MM-dd`, or null when the document carries no date. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
  /** Total including tax, or null. */
  amount: z.number().min(0).max(PURCHASE_AMOUNT_MAX).nullable(),
  currency: z.string().trim().length(3).nullable(),
  /** The supplier or yard as written on the document. */
  supplierName: z.string().trim().max(120).nullable(),
  /**
   * The provider's block as the document prints it (D120): raison sociale, téléphone, e-mail,
   * adresse. It is what makes « créer la fiche » a tap instead of a form — and what recognises
   * a provider already in the annuaire when the name alone is written differently.
   *
   * Defaulted, not required: a row written by the prompt that predates it must keep opening its
   * card rather than failing to parse (`parseSuggestion`).
   */
  supplier: supplierReadSchema.default(EMPTY_SUPPLIER),
  /** One of the boat's contacts, when the supplier is clearly one of them; else null. */
  contactId: z.string().nullable(),
  /** One of the boat's systems, when the work clearly belongs to one; else null. */
  categoryId: z.string().nullable(),
  /** Hour-meter readings the document states, per engine of the boat. */
  engineHours: z.array(z.object({ engineId: z.string(), hours: z.number().min(0) })).max(6),
  /** The lines of the invoice, for the notes: designation and amount. */
  lineItems: z
    .array(z.object({ designation: z.string().max(160), amount: z.number().nullable() }))
    .max(30),
  /** A short French summary worth keeping in the notes, or null. */
  notes: z.string().max(2000).nullable(),
  /**
   * For a deadline: the checklist item the paper is about, among the ones the boat was given,
   * and the date it stays valid until. Both default to null so a row written before E17-6 —
   * or by the local reader, which never proposes a deadline — still parses (D92).
   */
  checklistItemId: z.string().nullable().default(null),
  validUntil: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .default(null),
  /**
   * For an inventory: the equipment the document lists. Defaulted so every row written before
   * E2-10 — and every reading that is not an inventory — still parses.
   */
  inventory: z.array(inventoryLineSchema).max(INVENTORY_LINES_MAX).default([]),
  confidence: z.enum(INBOX_CONFIDENCES),
  /** What the person should double-check, in French — an illegible total, a guessed date… */
  warnings: z.array(z.string().max(200)).max(6),
});
export type InboxSuggestion = z.infer<typeof inboxSuggestionSchema>;

/** A stored suggestion, read back tolerantly: anything that does not parse is « no suggestion ». */
export function parseSuggestion(value: unknown): InboxSuggestion | null {
  const parsed = inboxSuggestionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

// ---------------------------------------------------------------------------------------------
// Server Actions
// ---------------------------------------------------------------------------------------------
const inboxMime = z
  .string()
  .refine((value) => value === "application/pdf" || value.startsWith("image/"));

/** A photo taken in the app, once the browser has put the object in the bucket. */
export const createInboxUploadSchema = z.object({
  // Drawn when the picker opens (rule 11): a retry rewrites the same object and the same row.
  id: uuid,
  boatId: uuid,
  storagePath: z.string().trim().min(1).max(500),
  fileName: requiredText(255),
  mimeType: inboxMime,
  sizeBytes: z.number().int().min(1).max(ATTACHMENT_MAX_BYTES),
  /**
   * Read after the response rather than while the person waits (D109). One photo is read on the
   * spot — a bar is a better wait than a card that says « lecture… ». A pile is not: the screen
   * would freeze for the whole batch, and one action would carry every reading past its budget.
   */
  deferReading: z.boolean().default(false),
});

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const engineHoursEntry = z.object({
  engineId: uuid,
  hours: nullableDecimal({ scale: 1, max: 99_999.9 }),
});

/**
 * « Valider » — what the card holds once the person has corrected it. One schema for the three
 * filings: the intervention needs a system, the purchase needs a chip, the attachment needs the
 * intervention it goes on (D109) and nothing else — its fields are the intervention's already.
 */
export const validateInboxItemSchema = z
  .object({
    boatId: uuid,
    itemId: uuid,
    kind: inboxFilingSchema,
    title: z.string().trim().max(160),
    date: isoDate,
    // Several systems on an intervention (D118); a purchase keeps the first, which is the one
    // its own column holds.
    categoryIds: z.array(uuid).max(LOG_CATEGORIES_MAX).default([]),
    amount: nullableDecimal({ scale: 2, max: COST_MAX }),
    contactId: z.preprocess(emptyToNull, uuid.nullable()),
    supplierName: nullableText(120),
    purchaseKind: z.enum(VISIBLE_PURCHASE_KINDS).default("service"),
    notes: nullableText(4000),
    engineHours: z.array(engineHoursEntry).max(20).default([]),
    /** The intervention an `attach` goes on; ignored by the other three filings. */
    logId: z.preprocess(
      (value) => (value === undefined ? null : emptyToNull(value)),
      uuid.nullable(),
    ),
    /** The checklist item a `deadline` lands on, and the date it is valid until (E17-6). */
    checklistItemId: z.preprocess(
      (value) => (value === undefined ? null : emptyToNull(value)),
      uuid.nullable(),
    ),
    validUntil: z.preprocess(
      (value) => (value === undefined ? null : emptyToNull(value)),
      isoDate.nullable(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.kind !== "attach" && value.title === "") {
      ctx.addIssue({ code: "custom", path: ["title"], message: "required" });
    }
    if (value.kind === "log" && value.categoryIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["categoryIds"], message: "required" });
    }
    if (value.kind === "attach" && !value.logId) {
      ctx.addIssue({ code: "custom", path: ["logId"], message: "required" });
    }
    if (value.kind === "deadline") {
      // A paper with no point to land on is a paper, not a deadline; and one with no validity
      // date would write a realisation that says nothing — the queue would not move.
      if (!value.checklistItemId) {
        ctx.addIssue({ code: "custom", path: ["checklistItemId"], message: "required" });
      }
      if (!value.validUntil) {
        ctx.addIssue({ code: "custom", path: ["validUntil"], message: "required" });
      } else if (value.validUntil <= value.date) {
        // « Valide jusqu'au » is in the future of the inspection, or the point comes out overdue
        // the day it is filed — which is true of an expired paper, and a mistake on a fresh one.
        ctx.addIssue({ code: "custom", path: ["validUntil"], message: "after_date" });
      }
    }
  });

export const inboxItemRefSchema = z.object({ boatId: uuid, itemId: uuid });

/**
 * The document an intervention was started from, hung on it once it exists (D119). It is the
 * `attach` filing of `validateInboxItem`, minus the fields that filing already ignores: the
 * title, the date and the amount are the intervention's, and it is the form that just wrote it.
 */
export const attachInboxDocumentSchema = z.object({
  boatId: uuid,
  itemId: uuid,
  logId: uuid,
});
