"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, haulOutPath } from "@/lib/queries/boat-routes";
import {
  restoreHaulOutSchema,
  trashHaulOutSchema,
  upsertHaulOutSchema,
} from "@/lib/schemas/haul-outs";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// A haul-out feeds the dashboard recap (« Dernière sortie ») and the expenses tab.
function revalidateHaulOutScreens(boatId: string, haulOutId: string) {
  revalidatePath(boatPath(boatId, "haulOuts"));
  revalidatePath(haulOutPath(boatId, haulOutId));
  revalidatePath(boatPath(boatId, "dashboard"));
  revalidatePath(boatPath(boatId, "supplies"));
  revalidatePath(boatPath(boatId, "trash"));
}

/**
 * Create or edit a haul-out (E6-1). Upsert on the id drawn when the form opened (rule 11);
 * a concurrent edit is reported, never merged (D27).
 */
export async function upsertHaulOut(input: unknown): Promise<ActionResult<{ haulOutId: string }>> {
  const parsed = parseInput(upsertHaulOutSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("haul_outs")
    .select("id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (existing && expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
    return fail("errors.conflict");
  }

  const { error } = await supabase.from("haul_outs").upsert(
    {
      id,
      boat_id: boatId,
      started_at: values.startedAt,
      ended_at: values.endedAt,
      // A yard picked from the directory wins over the free text: never both.
      yard_contact_id: values.yardContactId,
      yard_name: values.yardContactId ? null : values.yardName,
      works: values.works,
      cost: values.cost,
      deleted_at: null,
      updated_by: userId,
      ...(existing ? {} : { created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateHaulOutScreens(boatId, id);
  return ok({ haulOutId: id });
}

/**
 * « Mettre à la corbeille » (rule 9): soft delete. The linked maintenance logs keep their
 * `haul_out_id` and stay in the log book — only the container leaves the list.
 */
export async function trashHaulOut(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashHaulOutSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, haulOutId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("haul_outs")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId }, { count: "exact" })
    .eq("id", haulOutId)
    .eq("boat_id", boatId)
    .is("deleted_at", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateHaulOutScreens(boatId, haulOutId);
  return ok(undefined);
}

/** Undo of the toast and « Restaurer » of the trash. */
export async function restoreHaulOut(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreHaulOutSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, haulOutId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("haul_outs")
    .update({ deleted_at: null, updated_by: userId }, { count: "exact" })
    .eq("id", haulOutId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateHaulOutScreens(boatId, haulOutId);
  return ok(undefined);
}
