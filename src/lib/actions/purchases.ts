"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, logPath } from "@/lib/queries/boat-routes";
import {
  markPurchaseReviewedSchema,
  restorePurchaseSchema,
  trashPurchaseSchema,
  upsertPurchaseSchema,
} from "@/lib/schemas/purchases";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// A purchase shows up on the expenses tab, in the dashboard recap and, when linked, on the log.
function revalidatePurchaseScreens(boatId: string, maintenanceLogId?: string | null) {
  revalidatePath(boatPath(boatId, "supplies"));
  revalidatePath(boatPath(boatId, "dashboard"));
  revalidatePath(boatPath(boatId, "trash"));
  if (maintenanceLogId) revalidatePath(logPath(boatId, maintenanceLogId));
}

/**
 * Create or edit a purchase (E5-2, E5-3). Upsert on the id drawn when the form opened, so a
 * double tap writes one row (rule 11); `expectedUpdatedAt` makes a concurrent edit visible
 * instead of silent (D27).
 */
export async function upsertPurchase(
  input: unknown,
): Promise<ActionResult<{ purchaseId: string }>> {
  const parsed = parseInput(upsertPurchaseSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("purchases")
    .select("id, updated_at, maintenance_log_id")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (existing && expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
    return fail("errors.conflict");
  }

  const { error } = await supabase.from("purchases").upsert(
    {
      id,
      boat_id: boatId,
      kind: values.kind,
      designation: values.designation,
      amount: values.amount,
      purchased_at: values.purchasedAt,
      // A supplier taken from the directory wins over the free text: never both.
      supplier_contact_id: values.supplierContactId,
      supplier_name: values.supplierContactId ? null : values.supplierName,
      category_id: values.categoryId,
      bottle_type: values.kind === "gas" ? values.bottleType : null,
      maintenance_log_id: values.maintenanceLogId,
      notes: values.notes,
      needs_review: values.needsReview,
      deleted_at: null,
      updated_by: userId,
      ...(existing ? {} : { created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidatePurchaseScreens(boatId, values.maintenanceLogId);
  if (existing?.maintenance_log_id && existing.maintenance_log_id !== values.maintenanceLogId) {
    revalidatePath(logPath(boatId, existing.maintenance_log_id));
  }
  return ok({ purchaseId: id });
}

/** « Mettre à la corbeille » (rule 9, ux-flows §5.6): soft delete, restorable for 30 days. */
export async function trashPurchase(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashPurchaseSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, purchaseId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { data, error } = await supabase
    .from("purchases")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId })
    .eq("id", purchaseId)
    .eq("boat_id", boatId)
    .is("deleted_at", null)
    .select("id, maintenance_log_id");
  if (error) return fail(dbErrorKey(error));
  if (!data || data.length === 0) return fail("errors.forbidden");

  revalidatePurchaseScreens(boatId, data[0]?.maintenance_log_id);
  return ok(undefined);
}

/** Undo of the toast and « Restaurer » of the trash: the same one-column write. */
export async function restorePurchase(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restorePurchaseSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, purchaseId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { data, error } = await supabase
    .from("purchases")
    .update({ deleted_at: null, updated_by: userId })
    .eq("id", purchaseId)
    .eq("boat_id", boatId)
    .select("id, maintenance_log_id");
  if (error) return fail(dbErrorKey(error));
  if (!data || data.length === 0) return fail("errors.forbidden");

  revalidatePurchaseScreens(boatId, data[0]?.maintenance_log_id);
  return ok(undefined);
}

/** « Marquer comme vérifié » on an imported line (E5-2): clears the amber badge. */
export async function markPurchaseReviewed(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(markPurchaseReviewedSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, purchaseId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("purchases")
    .update({ needs_review: false, updated_by: userId }, { count: "exact" })
    .eq("id", purchaseId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidatePurchaseScreens(boatId);
  return ok(undefined);
}
