"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, equipmentPath } from "@/lib/queries/boat-routes";
import {
  removeEquipmentSchema,
  restoreEquipmentSchema,
  upsertEquipmentSchema,
} from "@/lib/schemas/equipment";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

function revalidateEquipmentScreens(boatId: string, equipmentId: string) {
  revalidatePath(boatPath(boatId, "boat"));
  revalidatePath(equipmentPath(boatId, equipmentId));
}

// Create or edit a piece of equipment (E2-3). specs are stored as a JSON object (key → value).
export async function upsertEquipment(
  input: unknown,
): Promise<ActionResult<{ equipmentId: string }>> {
  const parsed = parseInput(upsertEquipmentSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, specs, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { data: existing, error: readError } = await supabase
    .from("equipment")
    .select("id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (existing && expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
    return fail("errors.conflict");
  }

  let sortOrder: number | undefined;
  if (!existing) {
    const { count } = await supabase
      .from("equipment")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId);
    sortOrder = count ?? 0;
  }

  const { error } = await supabase.from("equipment").upsert(
    {
      id,
      boat_id: boatId,
      category_id: values.categoryId,
      name: values.name,
      brand: values.brand,
      model: values.model,
      serial: values.serial,
      quantity: values.quantity,
      installed_at: values.installedAt,
      specs: Object.fromEntries(specs.map((spec) => [spec.key, spec.value])),
      notes: values.notes,
      updated_by: userId,
      ...(sortOrder === undefined ? {} : { sort_order: sortOrder, created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateEquipmentScreens(boatId, id);
  return ok({ equipmentId: id });
}

// Equipment is never deleted: "removed on …" keeps its history readable (E2-3).
export async function removeEquipment(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(removeEquipmentSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, equipmentId, removedAt } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("equipment")
    .update({ removed_at: removedAt, updated_by: userId }, { count: "exact" })
    .eq("id", equipmentId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateEquipmentScreens(boatId, equipmentId);
  return ok(undefined);
}

export async function restoreEquipment(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreEquipmentSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, equipmentId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("equipment")
    .update({ removed_at: null, updated_by: userId }, { count: "exact" })
    .eq("id", equipmentId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateEquipmentScreens(boatId, equipmentId);
  return ok(undefined);
}
