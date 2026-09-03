"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { ATTACHMENT_BUCKET } from "@/lib/schemas/attachments";
import { restoreEntitySchema } from "@/lib/schemas/logs";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// Restoring or purging changes the counters, the expenses, the stock and the queue: the whole
// boat subtree is revalidated rather than guessing which screen was showing.
function revalidateBoat(boatId: string) {
  revalidatePath(`/boats/${boatId}`, "layout");
}

/** Every table that has a trash (rule 9, D40). */
export type Restorable =
  | "maintenance_logs"
  | "purchases"
  | "haul_outs"
  | "parts"
  | "contacts"
  | "attachments"
  | "equipment";

// Soft delete only (rule 9): restoring is `deleted_at = null`, nothing is ever re-created.
// RLS reserves it to owner / editor; a pro never sees the trash.
async function restore(table: Restorable, input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreEntitySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, id } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from(table)
    .update({ deleted_at: null, updated_by: userId }, { count: "exact" })
    .eq("id", id)
    .eq("boat_id", boatId)
    .not("deleted_at", "is", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

/**
 * « Supprimer définitivement » from the trash screen: the hard delete the nightly purge would
 * have done on day 30, asked for early. `deleted_at is not null` is the guard that matters — a
 * row that is not in the trash can never be destroyed through this path.
 */
async function purge(table: Restorable, input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreEntitySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, id } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from(table)
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("boat_id", boatId)
    .not("deleted_at", "is", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

/** D5: the parked readings are recreated by the database trigger. */
export async function restoreLog(input: unknown): Promise<ActionResult> {
  return restore("maintenance_logs", input);
}

export async function restorePurchase(input: unknown): Promise<ActionResult> {
  return restore("purchases", input);
}

export async function restoreHaulOut(input: unknown): Promise<ActionResult> {
  return restore("haul_outs", input);
}

/** D40: the stock left the « no trash » regime of D10. */
export async function restorePart(input: unknown): Promise<ActionResult> {
  return restore("parts", input);
}

/** D41: the links from the interventions were never severed, so there is nothing to rebuild. */
export async function restoreContact(input: unknown): Promise<ActionResult> {
  return restore("contacts", input);
}

/** Same row as the « Annuler » of the gallery, reached from the trash instead of the toast. */
export async function restoreTrashedAttachment(input: unknown): Promise<ActionResult> {
  return restore("attachments", input);
}

/** D61: « Supprimer » un équipement le met ici, distinct de « Déposer » (removed_at). */
export async function restoreTrashedEquipment(input: unknown): Promise<ActionResult> {
  return restore("equipment", input);
}

export async function purgeLog(input: unknown): Promise<ActionResult> {
  return purge("maintenance_logs", input);
}

export async function purgePurchase(input: unknown): Promise<ActionResult> {
  return purge("purchases", input);
}

export async function purgeHaulOut(input: unknown): Promise<ActionResult> {
  return purge("haul_outs", input);
}

export async function purgePart(input: unknown): Promise<ActionResult> {
  return purge("parts", input);
}

/** Purging a contact is what fires `on delete set null`: the dialog says so before it happens. */
export async function purgeContact(input: unknown): Promise<ActionResult> {
  return purge("contacts", input);
}

/** D61: `maintenance_logs.equipment_id` is `on delete set null`, so history keeps its title. */
export async function purgeEquipment(input: unknown): Promise<ActionResult> {
  return purge("equipment", input);
}

/**
 * The one purge that also has a file behind it: the row goes, and so does the Storage object.
 * Read the path first — after the delete there is nothing left to read it from — and remove the
 * object last, so a failed delete never leaves a row pointing at a file that is gone.
 */
export async function purgeAttachment(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreEntitySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, id } = parsed.data;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("id", id)
    .eq("boat_id", boatId)
    .not("deleted_at", "is", null)
    .maybeSingle();

  const result = await purge("attachments", input);
  if (!result.ok) return result;

  if (row?.storage_path) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([row.storage_path]);
  }
  return result;
}
