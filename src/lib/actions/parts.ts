"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { todayString } from "@/lib/format";
import { boatPath } from "@/lib/queries/boat-routes";
import { adjustPartQuantitySchema, deletePartSchema, upsertPartSchema } from "@/lib/schemas/parts";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// The stock tab and the dashboard recap (low_stock_parts) read the parts.
function revalidateStockScreens(boatId: string) {
  revalidatePath(boatPath(boatId, "supplies"));
  revalidatePath(boatPath(boatId, "dashboard"));
}

/**
 * Create or edit a part (E5-4). Upsert on the id drawn when the form opened (rule 11);
 * `expectedUpdatedAt` surfaces a concurrent edit (D27). Saving the sheet is a check of the
 * quantity: `checked_at` moves to today.
 */
export async function upsertPart(input: unknown): Promise<ActionResult<{ partId: string }>> {
  const parsed = parseInput(upsertPartSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("parts")
    .select("id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (existing && expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
    return fail("errors.conflict");
  }

  const { error } = await supabase.from("parts").upsert(
    {
      id,
      boat_id: boatId,
      name: values.name,
      reference: values.reference,
      quantity: values.quantity,
      min_quantity: values.minQuantity,
      unit: values.unit,
      location: values.location,
      category_id: values.categoryId,
      supplier_contact_id: values.supplierContactId,
      notes: values.notes,
      checked_at: todayString(),
      updated_by: userId,
      ...(existing ? {} : { created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateStockScreens(boatId);
  return ok({ partId: id });
}

/** + / − from the list (E5-4): one atomic statement in the database, floored at 0. */
export async function adjustPartQuantity(
  input: unknown,
): Promise<ActionResult<{ quantity: number }>> {
  const parsed = parseInput(adjustPartQuantitySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, partId, delta } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data, error } = await supabase.rpc("adjust_part_quantity", {
    p_part_id: partId,
    p_delta: delta,
  });
  if (error) return fail(dbErrorKey(error));

  revalidateStockScreens(boatId);
  return ok({ quantity: Number(data) });
}

/** Physical deletion after confirmation (D10): the stock is declarative, it has no trash. */
export async function deletePart(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(deletePartSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, partId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data, error } = await supabase
    .from("parts")
    .delete()
    .eq("id", partId)
    .eq("boat_id", boatId)
    .select("id");
  if (error) return fail(dbErrorKey(error));
  if (!data || data.length === 0) return fail("errors.forbidden");

  revalidateStockScreens(boatId);
  return ok(undefined);
}
