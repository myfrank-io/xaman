import { z } from "zod";

import { isoDate, nullableDecimal, nullableText, requiredText, uuid } from "@/lib/schemas/common";
import { attachmentExtension, ATTACHMENT_MAX_BYTES } from "@/lib/schemas/attachments";
import { COST_MAX } from "@/lib/schemas/logs";
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

/** Kinds a document can be filed as: the two lists a receipt can land in. */
export const INBOX_KINDS = ["log", "purchase"] as const;
export const inboxKindSchema = z.enum(INBOX_KINDS);
export type InboxKind = z.infer<typeof inboxKindSchema>;

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
  "photo",
  "other",
] as const;
export const INBOX_CONFIDENCES = ["high", "medium", "low"] as const;

export const inboxSuggestionSchema = z.object({
  documentType: z.enum(INBOX_DOCUMENT_TYPES),
  /** Where it should be filed: an intervention (work done) or a purchase (a thing bought). */
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
});
export type CreateInboxUploadInput = z.input<typeof createInboxUploadSchema>;

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

const engineHoursEntry = z.object({
  engineId: uuid,
  hours: nullableDecimal({ scale: 1, max: 99_999.9 }),
});

/**
 * « Valider » — what the card holds once the person has corrected it. One schema for both kinds:
 * the intervention needs a system, the purchase needs a chip, and the rest is shared.
 */
export const validateInboxItemSchema = z
  .object({
    boatId: uuid,
    itemId: uuid,
    kind: inboxKindSchema,
    title: requiredText(160),
    date: isoDate,
    categoryId: z.preprocess(emptyToNull, uuid.nullable()),
    amount: nullableDecimal({ scale: 2, max: COST_MAX }),
    contactId: z.preprocess(emptyToNull, uuid.nullable()),
    supplierName: nullableText(120),
    purchaseKind: z.enum(VISIBLE_PURCHASE_KINDS).default("service"),
    notes: nullableText(4000),
    engineHours: z.array(engineHoursEntry).max(20).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.kind === "log" && !value.categoryId) {
      ctx.addIssue({ code: "custom", path: ["categoryId"], message: "required" });
    }
  });
export type ValidateInboxItemInput = z.input<typeof validateInboxItemSchema>;
export type ValidateInboxItemValues = z.output<typeof validateInboxItemSchema>;

export const inboxItemRefSchema = z.object({ boatId: uuid, itemId: uuid });
