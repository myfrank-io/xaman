import "server-only";

import {
  inboundExternalRef,
  receivedAttachmentUrl,
  type InboundAttachment,
  type InboundEmail,
} from "@/lib/inbox/resend-inbound";
import {
  ATTACHMENT_BUCKET,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MIME_TYPES,
} from "@/lib/schemas/attachments";
import { inboxStoragePath, inboxTokenFromAddress } from "@/lib/schemas/inbox";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * The boat's own address (D91): `<slug>-<token>@<INBOUND_EMAIL_DOMAIN>`. Without the domain the
 * feature is simply absent — no address on the Bateau screen, and an inbound event is ignored.
 */
export function inboundDomain(): string | null {
  const domain = (process.env.INBOUND_EMAIL_DOMAIN ?? "").trim().toLowerCase();
  return domain === "" ? null : domain;
}

export type ReceivedMail = {
  boatId: string;
  /** The rows created by this event — empty when every attachment was already there. */
  itemIds: string[];
  /** Attachments the inbox could not take: wrong type, too big, or unreachable. */
  skipped: number;
};

/**
 * A message reached a boat's address: its attachments become rows of the inbox (D91).
 *
 * Service key throughout — a webhook has no session. The boat is found by the token of the
 * address, never by its name; an address that names no boat is answered « ignored », not an
 * error, so the mailer stops retrying. Each attachment is stored once (`external_ref` is the
 * message id and the attachment id), so a redelivered event adds nothing.
 *
 * The bytes are fetched here, before the row exists: a row whose object is missing would be a
 * card nobody can read. An attachment that cannot be fetched is counted and logged, and the
 * others still land.
 */
export async function receiveInboundEmail(mail: InboundEmail): Promise<ReceivedMail | null> {
  const domain = inboundDomain();
  if (!domain) return null;
  const token = mail.recipients
    .map((recipient) => inboxTokenFromAddress(recipient, domain))
    .find((value): value is string => value !== null);
  if (!token) return null;

  const admin = createAdminClient();
  const { data: boat } = await admin
    .from("boats")
    .select("id")
    .eq("inbox_token", token)
    .maybeSingle();
  if (!boat) return null;

  const itemIds: string[] = [];
  let skipped = 0;

  for (const attachment of mail.attachments) {
    if (!acceptable(attachment)) {
      skipped += 1;
      continue;
    }
    const externalRef = inboundExternalRef(mail.emailId, attachment.id);
    const { data: existing } = await admin
      .from("inbox_items")
      .select("id")
      .eq("boat_id", boat.id)
      .eq("external_ref", externalRef)
      .maybeSingle();
    if (existing) continue;

    const bytes = await fetchAttachmentBytes(mail.emailId, attachment);
    if (!bytes || bytes.byteLength === 0 || bytes.byteLength > ATTACHMENT_MAX_BYTES) {
      console.error("inbox: attachment not fetched", mail.emailId, attachment.id);
      skipped += 1;
      continue;
    }

    const itemId = crypto.randomUUID();
    const storagePath = inboxStoragePath({
      boatId: boat.id,
      itemId,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    });
    const { error: uploadError } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .upload(storagePath, bytes, { contentType: attachment.mimeType, upsert: true });
    if (uploadError) {
      console.error("inbox: could not store the attachment", uploadError.message);
      skipped += 1;
      continue;
    }

    const { error: insertError } = await admin.from("inbox_items").insert({
      id: itemId,
      boat_id: boat.id,
      source: "email",
      status: "received",
      received_at: mail.receivedAt,
      sender_email: mail.senderEmail,
      sender_name: mail.senderName,
      subject: mail.subject,
      file_name: attachment.fileName,
      mime_type: attachment.mimeType,
      size_bytes: bytes.byteLength,
      storage_path: storagePath,
      external_ref: externalRef,
    });
    if (insertError) {
      // The unique key on (boat, external_ref) turns a race between two deliveries into a no-op.
      if (insertError.code !== "23505") {
        console.error("inbox: could not insert the item", insertError.message);
        skipped += 1;
      }
      continue;
    }
    itemIds.push(itemId);
  }

  return { boatId: boat.id, itemIds, skipped };
}

function acceptable(attachment: InboundAttachment): boolean {
  if (!(ATTACHMENT_MIME_TYPES as readonly string[]).includes(attachment.mimeType)) return false;
  if (attachment.sizeBytes !== null && attachment.sizeBytes > ATTACHMENT_MAX_BYTES) return false;
  return true;
}

/**
 * The bytes of one attachment, whichever way the provider offers them: inlined in the event,
 * behind a download URL the event carries, or behind the attachment endpoint of the received
 * message (which answers with a `download_url`).
 */
async function fetchAttachmentBytes(
  emailId: string,
  attachment: InboundAttachment,
): Promise<Uint8Array | null> {
  if (attachment.contentBase64) {
    try {
      return new Uint8Array(Buffer.from(attachment.contentBase64, "base64"));
    } catch {
      return null;
    }
  }
  let url = attachment.downloadUrl;
  if (!url) {
    const key = process.env.RESEND_API_KEY ?? "";
    if (!key) {
      console.error("inbox: RESEND_API_KEY is not set, attachment cannot be fetched");
      return null;
    }
    try {
      const res = await fetch(receivedAttachmentUrl(emailId, attachment.id), {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) {
        console.error(`inbox: resend ${res.status} on attachment`, await res.text());
        return null;
      }
      const body = (await res.json()) as { download_url?: unknown; url?: unknown };
      const candidate = body.download_url ?? body.url;
      url = typeof candidate === "string" ? candidate : null;
    } catch (error) {
      console.error("inbox: resend attachment request failed", error);
      return null;
    }
  }
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch (error) {
    console.error("inbox: attachment download failed", error);
    return null;
  }
}
