"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { getTranslations } from "next-intl/server";

import { saveLog } from "@/lib/actions/logs";
import { upsertPurchase } from "@/lib/actions/purchases";
import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { analyseInboxItem, type AnalysisOutcome } from "@/lib/inbox/analyse";
import { notifyInboxValidated } from "@/lib/inbox/notify";
import { boatPath, inboxPath, logPath } from "@/lib/queries/boat-routes";
import { ATTACHMENT_BUCKET } from "@/lib/schemas/attachments";
import {
  createInboxUploadSchema,
  inboxItemRefSchema,
  validateInboxItemSchema,
} from "@/lib/schemas/inbox";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

/**
 * The inbox (D91): what turns a document into a line of the carnet, and only on a person's tap.
 *
 * Reading a document runs with the service key (`analyseInboxItem`): it is the same reading for
 * a photo and for a mail, and neither has a session where it runs. Everything that writes the
 * carnet runs with the person's own client, through the very Server Actions the forms call —
 * `saveLog`, `upsertPurchase` — so a validated document obeys exactly the rules a typed line
 * does: RLS, the shared zod schemas, the idempotent upsert on an id drawn beforehand.
 */
function revalidateInbox(boatId: string) {
  revalidatePath(inboxPath(boatId));
  revalidatePath(boatPath(boatId, "dashboard"));
}

/**
 * A photo taken in the app, after the browser put the object in the bucket. The row is written
 * with the person's client (RLS: contribute), then read at once: the person is waiting on the
 * screen, and thirty seconds with a progress bar beat a card that says « en cours » forever.
 *
 * A pile dropped at once asks for `deferReading` (D95): the row is written, the response goes
 * back, and the reading runs behind it — one reading per action, each within its own budget —
 * while the screen's polling fills the cards in as they come out `ready`.
 */
export async function createInboxUpload(
  input: unknown,
): Promise<ActionResult<{ itemId: string; deferred: boolean } & AnalysisOutcome>> {
  const parsed = parseInput(createInboxUploadSchema, input);
  if (!parsed.ok) return parsed.result;
  const values = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error } = await supabase.from("inbox_items").upsert(
    {
      id: values.id,
      boat_id: values.boatId,
      source: "upload",
      status: "received",
      file_name: values.fileName,
      mime_type: values.mimeType,
      size_bytes: values.sizeBytes,
      storage_path: values.storagePath,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return fail(dbErrorKey(error));

  if (values.deferReading) {
    after(() => analyseInboxItem(values.id));
    revalidateInbox(values.boatId);
    return ok({ itemId: values.id, deferred: true, suggestion: null, error: null });
  }

  const outcome = await analyseInboxItem(values.id);
  revalidateInbox(values.boatId);
  return ok({ itemId: values.id, deferred: false, ...outcome });
}

/** « Relire » — the analysis again, for a document that failed or that arrived unconfigured. */
export async function reanalyseInboxItem(input: unknown): Promise<ActionResult<AnalysisOutcome>> {
  const parsed = parseInput(inboxItemRefSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  // RLS answers the question « may this person see this item » before the service key reads it.
  const { data: item, error } = await supabase
    .from("inbox_items")
    .select("id, status")
    .eq("id", itemId)
    .eq("boat_id", boatId)
    .maybeSingle();
  if (error) return fail(dbErrorKey(error));
  if (!item) return fail("errors.forbidden");
  if (item.status === "validated" || item.status === "dismissed") return fail("errors.conflict");

  const outcome = await analyseInboxItem(itemId);
  revalidateInbox(boatId);
  return ok(outcome);
}

/**
 * « Valider » — the tap that writes the carnet. The intervention or the purchase is created by
 * the form's own action, the document becomes its attachment (same object, new row), and the
 * inbox row remembers what it became. Idempotent: a second tap on a validated row is refused
 * with a conflict, never a second line.
 *
 * The third filing, `attach` (D95), creates nothing: the document joins the attachments of an
 * intervention that already exists, and the row remembers which one.
 */
export async function validateInboxItem(input: unknown): Promise<
  ActionResult<{
    kind: "log" | "purchase" | "attach";
    entityId: string;
    title: string;
    href: string;
  }>
> {
  const parsed = parseInput(validateInboxItemSchema, input);
  if (!parsed.ok) return parsed.result;
  const values = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: item, error: readError } = await supabase
    .from("inbox_items")
    .select("id, status, storage_path, file_name, mime_type, size_bytes, log_id, purchase_id")
    .eq("id", values.itemId)
    .eq("boat_id", values.boatId)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (!item) return fail("errors.forbidden");
  if (item.status === "validated" || item.status === "dismissed") return fail("errors.conflict");

  // The ids are drawn here rather than by the form: the row is the memory of the tap, and an
  // action that fails after the line is written finds it again below (`log_id` / `purchase_id`).
  // An attachment brings its own: the intervention the person picked.
  const entityId =
    values.kind === "attach"
      ? (values.logId ?? "")
      : (item.log_id ?? item.purchase_id ?? crypto.randomUUID());
  const notes = values.notes;
  // What the line is called once written — the intervention's own title for an attachment.
  let title = values.title;
  let date = values.date;
  let amount = values.amount;

  if (values.kind === "attach") {
    // RLS scopes the read; a trashed intervention is not one a document should land on.
    const { data: log, error: logError } = await supabase
      .from("maintenance_logs")
      .select("id, title, performed_at")
      .eq("id", entityId)
      .eq("boat_id", values.boatId)
      .is("deleted_at", null)
      .maybeSingle();
    if (logError) return fail(dbErrorKey(logError));
    if (!log) return fail("errors.log_not_found");
    title = log.title;
    date = log.performed_at;
    amount = null;
  } else if (values.kind === "log") {
    const created = await saveLog({
      id: entityId,
      boatId: values.boatId,
      title: values.title,
      categoryId: values.categoryId ?? "",
      status: "done",
      performedAt: values.date,
      cost: values.amount,
      contactId: values.contactId,
      equipmentId: null,
      haulOutId: null,
      notes,
      engineHours: values.engineHours,
      checklistItemIds: [],
    });
    if (!created.ok) return created;
  } else {
    const created = await upsertPurchase({
      id: entityId,
      boatId: values.boatId,
      kind: values.purchaseKind,
      designation: values.title,
      amount: values.amount,
      purchasedAt: values.date,
      supplierContactId: values.contactId,
      supplierName: values.supplierName,
      categoryId: values.categoryId,
      bottleType: null,
      maintenanceLogId: null,
      notes,
      needsReview: false,
    });
    if (!created.ok) return created;
  }

  // The document, hung on the line it produced — or joined. Same object in the bucket, one
  // more row.
  const attachmentId = crypto.randomUUID();
  const { error: attachmentError } = await supabase.from("attachments").upsert(
    {
      id: attachmentId,
      boat_id: values.boatId,
      entity_type: values.kind === "purchase" ? "purchase" : "maintenance_log",
      entity_id: entityId,
      storage_path: item.storage_path,
      file_name: item.file_name,
      mime_type: item.mime_type,
      size_bytes: item.size_bytes,
      caption: null,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "storage_path", ignoreDuplicates: true },
  );
  if (attachmentError) return fail(dbErrorKey(attachmentError));

  const { error: updateError, count } = await supabase
    .from("inbox_items")
    .update(
      {
        status: "validated",
        log_id: values.kind === "purchase" ? null : entityId,
        purchase_id: values.kind === "purchase" ? entityId : null,
        attachment_id: attachmentId,
        validated_by: userId,
        validated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { count: "exact" },
    )
    .eq("id", values.itemId)
    .eq("boat_id", values.boatId);
  if (updateError) return fail(dbErrorKey(updateError));
  if (!count) return fail("errors.forbidden");

  // The others hear about it once the response is gone — never before, never instead.
  const [t, { data: profile }] = await Promise.all([
    getTranslations("inbox"),
    supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
  ]);
  // An attachment is « in the carnet » on the intervention's own terms: its title, its date.
  const kind = values.kind === "purchase" ? "purchase" : "log";
  const kindLabel = t(`kind.${kind}`);
  const validatorName = profile?.full_name ?? profile?.email ?? "";
  after(() =>
    notifyInboxValidated({
      boatId: values.boatId,
      validatorId: userId,
      validatorName,
      kind,
      entityId,
      title,
      date,
      amount,
      kindLabel,
    }),
  );

  revalidateInbox(values.boatId);
  revalidatePath(boatPath(values.boatId, kind === "log" ? "logs" : "supplies"));
  if (kind === "log") revalidatePath(logPath(values.boatId, entityId));
  return ok({
    kind: values.kind,
    entityId,
    title,
    href: kind === "log" ? logPath(values.boatId, entityId) : boatPath(values.boatId, "supplies"),
  });
}

/**
 * « Ignorer » — a status, not a deletion: the document stays readable in the history, where
 * « Réouvrir » brings it back and « Supprimer » is the only thing that ever destroys it (D93).
 */
export async function dismissInboxItem(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(inboxItemRefSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("inbox_items")
    .update(
      {
        status: "dismissed",
        validated_by: userId,
        validated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { count: "exact" },
    )
    .eq("id", itemId)
    .eq("boat_id", boatId)
    .in("status", ["received", "analysing", "ready"]);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateInbox(boatId);
  return ok(undefined);
}

/**
 * « Réouvrir » — the way back out of « Ignoré » (D93). A mis-tap on a phone is one card away from
 * the right one, and the history had no button at all. The row returns to `ready`, where the card
 * shows its fields again, with the reading it already had: nothing is re-read, nothing is lost.
 * `validated_at` goes back to null, because the document is once more waiting for a decision.
 */
export async function reopenInboxItem(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(inboxItemRefSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  // Only a dismissed row: a validated document became an intervention, and un-validating it here
  // would leave that line behind without its origin.
  const { error, count } = await supabase
    .from("inbox_items")
    .update(
      { status: "ready", validated_by: null, validated_at: null, updated_by: userId },
      { count: "exact" },
    )
    .eq("id", itemId)
    .eq("boat_id", boatId)
    .eq("status", "dismissed");
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.conflict");

  revalidateInbox(boatId);
  return ok(undefined);
}

/**
 * « Supprimer » — the document leaves for good, row and object (D93). Reserved to a dismissed
 * row, in the database as well as here (`inbox_items_delete`, migration `0027`): a document has
 * to be ignored before it can be destroyed, which is two taps and never one, and a validated one
 * is out of reach — its object is the attachment of the line it produced.
 *
 * The path is read before the delete — afterwards there is nothing left to read it from — and the
 * object is removed last, so a refused delete never leaves a row pointing at a file that is gone.
 * Same order as `purgeAttachment`.
 */
export async function deleteInboxItem(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(inboxItemRefSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: item, error: readError } = await supabase
    .from("inbox_items")
    .select("storage_path")
    .eq("id", itemId)
    .eq("boat_id", boatId)
    .eq("status", "dismissed")
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (!item) return fail("errors.conflict");

  const { error, count } = await supabase
    .from("inbox_items")
    .delete({ count: "exact" })
    .eq("id", itemId)
    .eq("boat_id", boatId)
    .eq("status", "dismissed");
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([item.storage_path]);

  revalidateInbox(boatId);
  return ok(undefined);
}
