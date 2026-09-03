import { z } from "zod";

import { nullableText, requiredText, uuid } from "@/lib/schemas/common";

/**
 * Documents hung off an intervention or a purchase (E10-1). The table is polymorphic
 * (`entity_type` + `entity_id`, DATA-MODEL §3.19); V1 only writes the two owners below, the
 * other enum values are reserved for the equipment gallery and the boat photo (V1.1).
 */
export const ATTACHMENT_OWNERS = ["maintenance_log", "purchase"] as const;
export const attachmentOwnerSchema = z.enum(ATTACHMENT_OWNERS);
export type AttachmentOwnerType = (typeof ATTACHMENT_OWNERS)[number];

export type AttachmentOwner = { type: AttachmentOwnerType; id: string };

/** Private bucket created in 0002_rls.sql; its policies read the boat out of the path. */
export const ATTACHMENT_BUCKET = "boat-files";

/** SPEC S1 and the `size_bytes` check of the table. */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/** What the bucket accepts (0011_attachments.sql) — HEIC included: iPad Safari sends it. */
export const ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
] as const;

/** `accept` of the file inputs: any image the browser can offer, plus PDF. */
export const ATTACHMENT_ACCEPT = "image/*,application/pdf";

const attachmentMime = z
  .string()
  .refine((value) => value === "application/pdf" || value.startsWith("image/"));

export function isPdf(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

export function isImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/** Extension of the stored object, from the name first and the type as a fallback. */
export function attachmentExtension(fileName: string, mimeType: string): string {
  const fromName = /\.([a-z0-9]{1,8})$/i.exec(fileName)?.[1]?.toLowerCase();
  if (fromName) return fromName;
  if (isPdf(mimeType)) return "pdf";
  const fromMime = mimeType
    .split("/")[1]
    ?.replace(/[^a-z0-9]/gi, "")
    .toLowerCase();
  return fromMime || "bin";
}

/**
 * `boats/{boat_id}/{entity_type}/{entity_id}/{attachment_id}.{ext}` (DATA-MODEL §3.19).
 * The first segment is what `boat_id_from_storage_path()` reads, so the Storage policies and
 * the `attachments_path_boat` check both hang off it. The file name never enters the path:
 * « Facture Chantier (2).pdf » would need escaping and would leak into the object key.
 */
export function attachmentStoragePath(input: {
  boatId: string;
  owner: AttachmentOwner;
  attachmentId: string;
  fileName: string;
  mimeType: string;
}): string {
  const ext = attachmentExtension(input.fileName, input.mimeType);
  return `boats/${input.boatId}/${input.owner.type}/${input.owner.id}/${input.attachmentId}.${ext}`;
}

/**
 * Written after the browser has uploaded the object (rule 11: upsert on the id drawn before
 * the upload, so a retry writes one row and rewrites the same object).
 */
export const saveAttachmentSchema = z.object({
  id: uuid,
  boatId: uuid,
  ownerType: attachmentOwnerSchema,
  ownerId: uuid,
  storagePath: z.string().trim().min(1).max(500),
  fileName: requiredText(255),
  mimeType: attachmentMime,
  sizeBytes: z.number().int().min(1).max(ATTACHMENT_MAX_BYTES),
  caption: nullableText(200),
});
export type SaveAttachmentInput = z.input<typeof saveAttachmentSchema>;

/** Same payload for a batch: « Importer des documents » commits several files at once. */
export const saveAttachmentsSchema = z.object({
  boatId: uuid,
  items: z
    .array(saveAttachmentSchema.omit({ boatId: true }))
    .min(1)
    .max(50),
});
export type SaveAttachmentsInput = z.input<typeof saveAttachmentsSchema>;

const attachmentRef = z.object({ boatId: uuid, attachmentId: uuid });

export const trashAttachmentSchema = attachmentRef;
export const restoreAttachmentSchema = attachmentRef;

export const updateAttachmentCaptionSchema = attachmentRef.extend({
  caption: nullableText(200),
});
