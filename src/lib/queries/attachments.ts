import type { SupabaseClient } from "@supabase/supabase-js";

import { ATTACHMENT_BUCKET, type AttachmentOwner } from "@/lib/schemas/attachments";
import type { Database } from "@/types/database";

/** One document as every screen shows it: the row plus a signed URL for the bucket object. */
export type AttachmentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string | null;
  storagePath: string;
  createdAt: string;
  createdByName: string | null;
  /** Signed, one hour. Null when signing failed — the tile then says so instead of breaking. */
  url: string | null;
};

/** Signed URLs live an hour; the query that holds them is refreshed well before they die. */
export const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Documents of one intervention or one purchase (E10-1), trashed ones excluded. Works with the
 * server client (first paint of a detail sheet) and with the browser client (the hook that
 * refreshes it). The bucket is private: nothing is readable without one of these signatures.
 */
export async function listAttachments(
  supabase: SupabaseClient<Database>,
  boatId: string,
  owner: AttachmentOwner,
): Promise<AttachmentItem[]> {
  const { data, error } = await supabase
    .from("attachments")
    .select("id, file_name, mime_type, size_bytes, caption, storage_path, created_at, created_by")
    .eq("boat_id", boatId)
    .eq("entity_type", owner.type)
    .eq("entity_id", owner.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const authorIds = [...new Set(rows.map((row) => row.created_by).filter((id) => id !== null))];
  const [profiles, signed] = await Promise.all([
    authorIds.length > 0
      ? supabase.from("profiles").select("id, full_name, email").in("id", authorIds)
      : Promise.resolve({ data: [] as { id: string; full_name: string | null; email: string }[] }),
    supabase.storage.from(ATTACHMENT_BUCKET).createSignedUrls(
      rows.map((row) => row.storage_path),
      SIGNED_URL_TTL_SECONDS,
    ),
  ]);
  const names = new Map((profiles.data ?? []).map((row) => [row.id, row.full_name ?? row.email]));
  const urls = new Map((signed.data ?? []).map((row) => [row.path ?? "", row.signedUrl]));

  return rows.map((row) => ({
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    caption: row.caption,
    storagePath: row.storage_path,
    createdAt: row.created_at,
    createdByName: row.created_by ? (names.get(row.created_by) ?? null) : null,
    url: urls.get(row.storage_path) ?? null,
  }));
}
