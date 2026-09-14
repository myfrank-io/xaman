import type { SupabaseClient } from "@supabase/supabase-js";

import { ATTACHMENT_BUCKET } from "@/lib/schemas/attachments";
import {
  inboxErrorKeySchema,
  parseSuggestion,
  type InboxErrorKey,
  type InboxSource,
  type InboxStatus,
  type InboxSuggestion,
} from "@/lib/schemas/inbox";
import { SIGNED_URL_TTL_SECONDS } from "@/lib/queries/attachments";
import type { Database } from "@/types/database";

/** One document of the inbox as the screen shows it (D91). */
export type InboxItem = {
  id: string;
  source: InboxSource;
  status: InboxStatus;
  receivedAt: string;
  senderEmail: string | null;
  senderName: string | null;
  subject: string | null;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  /** Signed, one hour; null when signing failed — the card then shows the name alone. */
  url: string | null;
  suggestion: InboxSuggestion | null;
  error: InboxErrorKey | null;
  logId: string | null;
  purchaseId: string | null;
  /**
   * Set when the document was filed as a deadline (E17-6). A realisation has no column on the
   * row and needs none: the attachment the validation wrote carries the link, so the id is read
   * back from it rather than stored twice.
   */
  completionId: string | null;
  validatedAt: string | null;
  updatedAt: string;
};

const PENDING: InboxStatus[] = ["received", "analysing", "ready"];

/**
 * What is waiting, newest first, plus the last few that were filed — so the screen says where a
 * document went rather than making it vanish. Works with the server client (first paint) and the
 * browser client; the bucket is private, so every preview goes through a signature.
 */
export async function listInboxItems(
  supabase: SupabaseClient<Database>,
  boatId: string,
  { history = 10 }: { history?: number } = {},
): Promise<{ pending: InboxItem[]; done: InboxItem[] }> {
  const [{ data: pendingRows, error: pendingError }, { data: doneRows, error: doneError }] =
    await Promise.all([
      supabase
        .from("inbox_items")
        .select("*")
        .eq("boat_id", boatId)
        .in("status", PENDING)
        .order("received_at", { ascending: false }),
      supabase
        .from("inbox_items")
        .select("*")
        .eq("boat_id", boatId)
        .in("status", ["validated", "dismissed"])
        .order("validated_at", { ascending: false, nullsFirst: false })
        .limit(history),
    ]);
  if (pendingError) throw pendingError;
  if (doneError) throw doneError;

  const rows = [...(pendingRows ?? []), ...(doneRows ?? [])];
  // Which of the filed ones became a realisation, asked of the attachments rather than guessed
  // from what is missing on the row.
  const attachmentIds = (doneRows ?? [])
    .map((row) => row.attachment_id)
    .filter((id): id is string => id !== null);
  const completionOf = new Map<string, string>();
  if (attachmentIds.length > 0) {
    const { data: attachments } = await supabase
      .from("attachments")
      .select("id, entity_type, entity_id")
      .eq("boat_id", boatId)
      .in("id", attachmentIds);
    for (const attachment of attachments ?? []) {
      if (attachment.entity_type === "checklist_completion") {
        completionOf.set(attachment.id, attachment.entity_id);
      }
    }
  }
  const signed =
    rows.length > 0
      ? await supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(
          rows.map((row) => row.storage_path),
          SIGNED_URL_TTL_SECONDS,
        )
      : { data: [] };
  const urls = new Map((signed.data ?? []).map((row) => [row.path ?? "", row.signedUrl]));

  const toItem = (row: (typeof rows)[number]): InboxItem => {
    const error = inboxErrorKeySchema.safeParse(row.error_key);
    return {
      id: row.id,
      source: row.source,
      status: row.status,
      receivedAt: row.received_at,
      senderEmail: row.sender_email,
      senderName: row.sender_name,
      subject: row.subject,
      fileName: row.file_name,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      storagePath: row.storage_path,
      url: urls.get(row.storage_path) ?? null,
      suggestion: parseSuggestion(row.suggestion),
      error: error.success ? error.data : row.error_key ? "analysis" : null,
      logId: row.log_id,
      purchaseId: row.purchase_id,
      completionId: row.attachment_id ? (completionOf.get(row.attachment_id) ?? null) : null,
      validatedAt: row.validated_at,
      updatedAt: row.updated_at,
    };
  };

  return {
    pending: (pendingRows ?? []).map(toItem),
    done: (doneRows ?? []).map(toItem),
  };
}

/** How many documents wait for a decision: the banner and the « Plus » sheet read this. */
export async function pendingInboxCount(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<number> {
  const { count } = await supabase
    .from("inbox_items")
    .select("id", { count: "exact", head: true })
    .eq("boat_id", boatId)
    .in("status", PENDING);
  return count ?? 0;
}

/**
 * The checklist points a paper can land on (E17-6), for the select on a card and for the reading.
 *
 * The active points with no hour interval: a certificate never carries an hour meter, and an
 * hour-based point could not be completed without one (`check_completion_hours`). A boat whose
 * plan has not been chosen yet has none, and the filing simply does not appear.
 */
export async function deadlineItemChoices(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<{ id: string; label: string; categoryName: string; categoryId: string | null }[]> {
  const [{ data: items }, { data: categories }] = await Promise.all([
    supabase
      .from("checklist_items")
      .select("id, label, category_id, sort_order")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .is("interval_hours", null)
      .order("sort_order"),
    supabase.from("boat_categories").select("id, name").eq("boat_id", boatId),
  ]);
  const names = new Map((categories ?? []).map((row) => [row.id, row.name]));
  return (items ?? []).map((row) => ({
    id: row.id,
    label: row.label,
    categoryId: row.category_id,
    categoryName: names.get(row.category_id ?? "") ?? "",
  }));
}
