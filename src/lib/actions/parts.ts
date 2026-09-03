"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { todayString } from "@/lib/format";
import { boatPath } from "@/lib/queries/boat-routes";
import { restockDelta } from "@/lib/parts";
import {
  adjustPartQuantitySchema,
  restockPartSchema,
  trashPartSchema,
  upsertPartSchema,
} from "@/lib/schemas/parts";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// The stock list (Bateau › Équipements since D34, not Dépenses) and the dashboard recap
// (low_stock_parts) both read the parts; the trash screen hangs off the boat layout.
function revalidateStockScreens(boatId: string) {
  revalidatePath(boatPath(boatId, "boat"));
  revalidatePath(boatPath(boatId, "dashboard"));
  revalidatePath(boatPath(boatId, "trash"));
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
    .is("deleted_at", null)
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

/**
 * Tick a low part off the « À racheter » checklist (D61): it has been bought back and stowed,
 * so its quantity climbs just above the threshold and the line leaves the list. Derived from
 * the stock, never a second entry — it writes the same `parts` row the +/− and the sheet do,
 * through the same atomic RPC. The current quantity is read fresh here (not trusted from the
 * client), so two devices restocking the same part never overshoot; a part already back in
 * stock is a no-op that returns its quantity unchanged.
 */
export async function restockPart(
  input: unknown,
): Promise<ActionResult<{ quantity: number; delta: number }>> {
  const parsed = parseInput(restockPartSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, partId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: part, error: readError } = await supabase
    .from("parts")
    .select("quantity, min_quantity")
    .eq("id", partId)
    .eq("boat_id", boatId)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (!part) return fail("errors.part_not_found");

  const delta = restockDelta({ quantity: part.quantity, minQuantity: part.min_quantity });
  // Already at or above the threshold (another device got there first): nothing to buy back.
  if (delta <= 0) return ok({ quantity: part.quantity, delta: 0 });

  const { data, error } = await supabase.rpc("adjust_part_quantity", {
    p_part_id: partId,
    p_delta: delta,
  });
  if (error) return fail(dbErrorKey(error));

  revalidateStockScreens(boatId);
  return ok({ quantity: Number(data), delta });
}

/**
 * Move a part to the trash (D40, reversing D10). A spare part is an object aboard, not a
 * scratch note: it goes where the interventions, the purchases and the haul-outs go, and comes
 * back from « Annuler » or from the trash screen for 30 days.
 */
export async function trashPart(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashPartSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, partId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("parts")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId }, { count: "exact" })
    .eq("id", partId)
    .eq("boat_id", boatId)
    .is("deleted_at", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateStockScreens(boatId);
  return ok(undefined);
}

/** « Annuler » of the toast: the same one-column write the other soft deletes use. */
export async function untrashPart(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashPartSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, partId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("parts")
    .update({ deleted_at: null, updated_by: userId }, { count: "exact" })
    .eq("id", partId)
    .eq("boat_id", boatId)
    .not("deleted_at", "is", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateStockScreens(boatId);
  return ok(undefined);
}
