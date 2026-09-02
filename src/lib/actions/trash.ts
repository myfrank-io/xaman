"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { restoreEntitySchema } from "@/lib/schemas/logs";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// Restoring changes the counters, the expenses and the queue: the boat subtree is revalidated.
function revalidateBoat(boatId: string) {
  revalidatePath(`/boats/${boatId}`, "layout");
}

type Restorable = "maintenance_logs" | "purchases" | "haul_outs";

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
