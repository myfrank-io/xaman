import { prepareForUpload, isTooLargeToStore, rejectionReason } from "@/lib/attachments/image";
import {
  ATTACHMENT_BUCKET,
  attachmentStoragePath,
  type AttachmentOwner,
} from "@/lib/schemas/attachments";
import { createClient } from "@/lib/supabase/client";

/**
 * One file, from the finger to the bucket (E10-1). The bytes go straight from the browser to
 * Storage with the anon client — never through a Server Action body, which would double the
 * traffic of a 4 Mo photo on a hotspot and hit the body limit.
 */

export type UploadStage = "queued" | "preparing" | "uploading" | "saving" | "done" | "error";

/** Rough share of the work already done, for the bar under the tile. */
export const STAGE_PROGRESS: Record<UploadStage, number> = {
  queued: 0,
  preparing: 20,
  uploading: 55,
  saving: 90,
  done: 100,
  error: 100,
};

export type UploadedFile = {
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/** Translation keys under `attachments.errors`. */
export type AttachmentErrorKey = "tooLarge" | "unsupported" | "upload" | "save";

export type UploadOutcome =
  { ok: true; file: UploadedFile } | { ok: false; error: AttachmentErrorKey };

/**
 * Prepares (resize + re-encode) then uploads one file under
 * `boats/{boatId}/{owner}/{ownerId}/{attachmentId}.{ext}`. `upsert` is on, so retrying the same
 * attachment id rewrites the same object instead of leaving a half-written one (rule 11).
 */
export async function uploadAttachmentFile({
  boatId,
  owner,
  attachmentId,
  file,
  onStage,
}: {
  boatId: string;
  owner: AttachmentOwner;
  attachmentId: string;
  file: File;
  onStage?: (stage: UploadStage) => void;
}): Promise<UploadOutcome> {
  const refused = rejectionReason(file);
  if (refused) return { ok: false, error: refused };

  onStage?.("preparing");
  const prepared = await prepareForUpload(file);
  if (isTooLargeToStore(prepared.sizeBytes)) return { ok: false, error: "tooLarge" };

  const storagePath = attachmentStoragePath({
    boatId,
    owner,
    attachmentId,
    fileName: prepared.fileName,
    mimeType: prepared.mimeType,
  });

  onStage?.("uploading");
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(storagePath, prepared.blob, {
      contentType: prepared.mimeType,
      upsert: true,
      cacheControl: "3600",
    });
  if (error) return { ok: false, error: "upload" };

  return {
    ok: true,
    file: {
      storagePath,
      fileName: prepared.fileName,
      mimeType: prepared.mimeType,
      sizeBytes: prepared.sizeBytes,
    },
  };
}

/**
 * Removes an object nobody points at: a document dropped from the form before it was saved.
 * A row that exists is soft-deleted instead — the object is kept so « Annuler » works.
 */
export async function removeOrphanObject(storagePath: string): Promise<void> {
  const supabase = createClient();
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
}

/** Signed URL for a freshly uploaded object, so the tile shows the stored file, not the pick. */
export async function signedUrlFor(storagePath: string): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(storagePath, 3600);
  return data?.signedUrl ?? null;
}
