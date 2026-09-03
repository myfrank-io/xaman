"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, logPath } from "@/lib/queries/boat-routes";
import {
  restoreAttachmentSchema,
  saveAttachmentSchema,
  saveAttachmentsSchema,
  trashAttachmentSchema,
  updateAttachmentCaptionSchema,
  type AttachmentOwnerType,
} from "@/lib/schemas/attachments";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

/**
 * Attachments (E10-1). The bytes never travel through a Server Action: the browser uploads
 * straight to Storage with the anon client (RLS on `storage.objects` decides), and these
 * actions only write the row that describes the object. Everything is idempotent — the id and
 * the path are drawn before the upload, so a retry rewrites the same object and the same row.
 */

function revalidateOwner(boatId: string, ownerType: AttachmentOwnerType, ownerId: string) {
  if (ownerType === "maintenance_log") {
    revalidatePath(logPath(boatId, ownerId));
    revalidatePath(boatPath(boatId, "logs"));
  } else {
    revalidatePath(boatPath(boatId, "supplies"));
  }
}

type SavedAttachment = { attachmentId: string };

/** One document: called right after the browser finished uploading its object. */
export async function saveAttachment(input: unknown): Promise<ActionResult<SavedAttachment>> {
  const parsed = parseInput(saveAttachmentSchema, input);
  if (!parsed.ok) return parsed.result;
  const values = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("attachments")
    .select("id")
    .eq("id", values.id)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));

  const row = {
    id: values.id,
    boat_id: values.boatId,
    entity_type: values.ownerType,
    entity_id: values.ownerId,
    storage_path: values.storagePath,
    file_name: values.fileName,
    mime_type: values.mimeType,
    size_bytes: values.sizeBytes,
    caption: values.caption,
    deleted_at: null,
    updated_by: userId,
  };

  // A document that exists is UPDATEd, never upserted (D42) — see `saveLog`:
  // `attachments_insert` checks `created_by = auth.uid()`, and that check runs on the proposed
  // row before the conflict is resolved, so re-saving someone else's document would be refused.
  const { error } = existing
    ? await supabase
        .from("attachments")
        .update(row)
        .eq("id", values.id)
        .eq("boat_id", values.boatId)
    : await supabase
        .from("attachments")
        .upsert({ ...row, created_by: userId }, { onConflict: "id" });
  if (error) return fail(dbErrorKey(error));

  revalidateOwner(values.boatId, values.ownerType, values.ownerId);
  return ok({ attachmentId: values.id });
}

/**
 * A batch: the intervention form commits the documents uploaded while it was being typed, and
 * « Importer des documents » commits a whole drop at once. One failing row fails the call — the
 * caller keeps the files and can retry, nothing is half-written from the user's point of view.
 */
export async function saveAttachments(input: unknown): Promise<ActionResult<{ count: number }>> {
  const parsed = parseInput(saveAttachmentsSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, items } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("attachments")
    .select("id")
    .eq("boat_id", boatId)
    .in(
      "id",
      items.map((item) => item.id),
    );
  if (readError) return fail(dbErrorKey(readError));
  const known = new Set((existing ?? []).map((row) => row.id));

  const rowOf = (item: (typeof items)[number]) => ({
    id: item.id,
    boat_id: boatId,
    entity_type: item.ownerType,
    entity_id: item.ownerId,
    storage_path: item.storagePath,
    file_name: item.fileName,
    mime_type: item.mimeType,
    size_bytes: item.sizeBytes,
    caption: item.caption,
    deleted_at: null,
    updated_by: userId,
  });

  // Two writes rather than one upsert (D42), for the reason spelled out in `saveLog`: the
  // INSERT check `created_by = auth.uid()` is evaluated on every proposed row, so a batch
  // holding one document created by someone else would be refused whole. The new ones go in
  // together; the ones already there are updated, which is the policy that describes editing.
  const fresh = items.filter((item) => !known.has(item.id));
  if (fresh.length > 0) {
    const { error: insertError } = await supabase.from("attachments").upsert(
      fresh.map((item) => ({ ...rowOf(item), created_by: userId })),
      { onConflict: "id" },
    );
    if (insertError) return fail(dbErrorKey(insertError));
  }
  for (const item of items.filter((entry) => known.has(entry.id))) {
    const { error: updateError } = await supabase
      .from("attachments")
      .update(rowOf(item))
      .eq("id", item.id)
      .eq("boat_id", boatId);
    if (updateError) return fail(dbErrorKey(updateError));
  }

  for (const owner of new Set(items.map((item) => `${item.ownerType}:${item.ownerId}`))) {
    const [type, id] = owner.split(":");
    if (type && id) revalidateOwner(boatId, type as AttachmentOwnerType, id);
  }
  return ok({ count: items.length });
}

/** The legend typed under a thumbnail. */
export async function updateAttachmentCaption(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(updateAttachmentCaptionSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, attachmentId, caption } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data, error } = await supabase
    .from("attachments")
    .update({ caption, updated_by: userId })
    .eq("id", attachmentId)
    .eq("boat_id", boatId)
    .select("entity_type, entity_id");
  if (error) return fail(dbErrorKey(error));
  const row = data?.[0];
  if (!row) return fail("errors.forbidden");

  revalidateOwner(boatId, row.entity_type as AttachmentOwnerType, row.entity_id);
  return ok(undefined);
}

/**
 * Soft delete (rule 9). The Storage object is deliberately kept: « Annuler » must give the
 * document back, and an invoice is exactly the thing nobody wants to lose to a mis-tap.
 */
export async function trashAttachment(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashAttachmentSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, attachmentId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data, error } = await supabase
    .from("attachments")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq("id", attachmentId)
    .eq("boat_id", boatId)
    .is("deleted_at", null)
    .select("entity_type, entity_id");
  if (error) return fail(dbErrorKey(error));
  const row = data?.[0];
  if (!row) return fail("errors.forbidden");

  revalidateOwner(boatId, row.entity_type as AttachmentOwnerType, row.entity_id);
  return ok(undefined);
}

/** Undo of the toast: the same one-column write the other soft deletes use. */
export async function restoreAttachment(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreAttachmentSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, attachmentId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data, error } = await supabase
    .from("attachments")
    .update({ deleted_at: null, updated_by: userId })
    .eq("id", attachmentId)
    .eq("boat_id", boatId)
    .select("entity_type, entity_id");
  if (error) return fail(dbErrorKey(error));
  const row = data?.[0];
  if (!row) return fail("errors.forbidden");

  revalidateOwner(boatId, row.entity_type as AttachmentOwnerType, row.entity_id);
  return ok(undefined);
}
