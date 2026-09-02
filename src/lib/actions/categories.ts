"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import {
  archiveCategorySchema,
  createCategorySchema,
  reorderCategoriesSchema,
  restoreCategorySchema,
  updateCategorySchema,
} from "@/lib/schemas/categories";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// Categories are shown on every screen: the whole boat is revalidated.
function revalidateBoat(boatId: string) {
  revalidatePath(`/boats/${boatId}`, "layout");
}

export async function createCategory(
  input: unknown,
): Promise<ActionResult<{ categoryId: string }>> {
  const parsed = parseInput(createCategorySchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, name, color, icon } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { count } = await supabase
    .from("boat_categories")
    .select("id", { count: "exact", head: true })
    .eq("boat_id", boatId);
  const { error } = await supabase.from("boat_categories").upsert(
    {
      id,
      boat_id: boatId,
      name,
      color,
      icon,
      sort_order: count ?? 0,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateBoat(boatId);
  return ok({ categoryId: id });
}

export async function updateCategory(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(updateCategorySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, categoryId, expectedUpdatedAt, name, color, icon } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  let query = supabase
    .from("boat_categories")
    .update({ name, color, icon, updated_by: userId }, { count: "exact" })
    .eq("id", categoryId)
    .eq("boat_id", boatId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { error, count } = await query;
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail(expectedUpdatedAt ? "errors.conflict" : "errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

// The grid keeps a fixed order (D21): this is the only way it changes.
export async function reorderCategories(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(reorderCategoriesSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, orderedIds } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  for (const [index, categoryId] of orderedIds.entries()) {
    const { error } = await supabase
      .from("boat_categories")
      .update({ sort_order: index, updated_by: userId })
      .eq("id", categoryId)
      .eq("boat_id", boatId);
    if (error) return fail(dbErrorKey(error));
  }

  revalidateBoat(boatId);
  return ok(undefined);
}

// Archiving a category either archives its active items with it or moves them to another
// category (UX §4.6). Nothing is deleted: completions and history stay readable.
export async function archiveCategory(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(archiveCategorySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, categoryId, mode, targetCategoryId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  if (mode === "move_items" && targetCategoryId) {
    const { data: target } = await supabase
      .from("boat_categories")
      .select("id")
      .eq("id", targetCategoryId)
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .maybeSingle();
    if (!target) return fail("errors.invalid", { targetCategoryId: ["invalid"] });

    const moves = await Promise.all([
      supabase
        .from("checklist_items")
        .update({ category_id: targetCategoryId, updated_by: userId })
        .eq("category_id", categoryId)
        .eq("boat_id", boatId),
      supabase
        .from("equipment")
        .update({ category_id: targetCategoryId, updated_by: userId })
        .eq("category_id", categoryId)
        .eq("boat_id", boatId),
    ]);
    const moveError = moves.find((result) => result.error)?.error;
    if (moveError) return fail(dbErrorKey(moveError));
  } else {
    const { error } = await supabase
      .from("checklist_items")
      .update({ is_active: false, updated_by: userId })
      .eq("category_id", categoryId)
      .eq("boat_id", boatId)
      .eq("is_active", true);
    if (error) return fail(dbErrorKey(error));
  }

  const { error, count } = await supabase
    .from("boat_categories")
    .update({ is_active: false, updated_by: userId }, { count: "exact" })
    .eq("id", categoryId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

export async function restoreCategory(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(restoreCategorySchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, categoryId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("boat_categories")
    .update({ is_active: true, updated_by: userId }, { count: "exact" })
    .eq("id", categoryId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}
