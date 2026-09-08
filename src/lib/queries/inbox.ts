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

/** One document of the inbox as the screen shows it (D84). */
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
