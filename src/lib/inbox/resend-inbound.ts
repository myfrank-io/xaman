import { z } from "zod";

/**
 * What the mailer posts when a message reaches the boat's address (D84).
 *
 * Resend delivers an `email.received` event for every inbound message on a receiving domain, in
 * the same signed envelope as the delivery events of D79 (Svix headers, `type`, `created_at`,
 * `data`). Only what the inbox needs is read: the message id, who wrote, to whom, the subject, and
 * the attachments' metadata. Everything else in the payload is ignored, and a field missing from
 * a future version of the event turns the message into « not ours » rather than into a crash.
 *
 * The attachment bytes are not in the event. Each attachment is fetched afterwards, with the API
 * key, either from a download URL the event carries or from the attachment endpoint of the
 * received message — the two shapes the receiving API documents. The endpoint paths and the
 * `download_url` field are the ones of Resend's « Receiving » API: check them against the
 * documentation when wiring the domain, they are the one thing this file cannot test.
 */
export const INBOUND_EVENT_TYPE = "email.received";

const address = z.string().trim().min(1);
const addressList = z
  .union([z.array(address), address])
  .transform((value) => (Array.isArray(value) ? value : [value]));

const attachmentSchema = z.object({
  id: z.string().trim().min(1).optional(),
  filename: z.string().trim().min(1).optional(),
  content_type: z.string().trim().min(1).optional(),
  size: z.number().int().nonnegative().optional(),
  /** A signed URL to the bytes, when the event carries one. */
  download_url: z.string().url().optional(),
  /** The bytes themselves, base64, when the event inlines them (small attachments). */
  content: z.string().optional(),
});

const eventSchema = z.object({
  type: z.literal(INBOUND_EVENT_TYPE),
  created_at: z.string().optional(),
  data: z.object({
    email_id: z.string().trim().min(1),
    from: address,
    to: addressList,
    cc: addressList.optional(),
    subject: z.string().optional().nullable(),
    created_at: z.string().optional(),
    attachments: z.array(attachmentSchema).optional().default([]),
  }),
});

export type InboundAttachment = {
  /** The provider's id, or the index when it has none — what the external_ref is built on. */
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number | null;
  downloadUrl: string | null;
  contentBase64: string | null;
};

export type InboundEmail = {
  emailId: string;
  from: string;
  senderEmail: string;
  senderName: string | null;
  /** Every address the message was addressed to — `to` and `cc` — as the server wrote them. */
  recipients: string[];
  subject: string | null;
  receivedAt: string;
  attachments: InboundAttachment[];
};

/** `"Chantier Naval" <compta@chantier.fr>` → the address and the name; a bare address → itself. */
export function splitAddress(value: string): { email: string; name: string | null } {
  const match = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(value);
  if (match) {
    const name = (match[1] ?? "").trim();
    return { email: (match[2] ?? "").trim().toLowerCase(), name: name || null };
  }
  return { email: value.trim().toLowerCase(), name: null };
}

/** The inbound event, or null for anything else the endpoint receives. */
export function inboundFromEvent(payload: unknown): InboundEmail | null {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { data, created_at: eventAt } = parsed.data;
  const sender = splitAddress(data.from);
  return {
    emailId: data.email_id,
    from: data.from,
    senderEmail: sender.email,
    senderName: sender.name,
    recipients: [...data.to, ...(data.cc ?? [])],
    subject: data.subject?.trim() || null,
    receivedAt: data.created_at ?? eventAt ?? new Date().toISOString(),
    attachments: data.attachments.map((attachment, index) => ({
      id: attachment.id ?? String(index),
      fileName: attachment.filename ?? `document-${index + 1}`,
      mimeType: (attachment.content_type ?? "application/octet-stream").toLowerCase(),
      sizeBytes: attachment.size ?? null,
      downloadUrl: attachment.download_url ?? null,
      contentBase64: attachment.content ?? null,
    })),
  };
}

/** Idempotency key of one attachment of one message: the webhook may deliver the event twice. */
export function inboundExternalRef(emailId: string, attachmentId: string): string {
  return `resend:${emailId}:${attachmentId}`;
}

/** The receiving API, the one place its paths are written. */
export const RECEIVING_ENDPOINT = "https://api.resend.com/emails/receiving";

export function receivedAttachmentUrl(emailId: string, attachmentId: string): string {
  return `${RECEIVING_ENDPOINT}/${encodeURIComponent(emailId)}/attachments/${encodeURIComponent(attachmentId)}`;
}
