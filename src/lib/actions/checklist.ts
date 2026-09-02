"use server";

import { revalidatePath } from "next/cache";
import { subMonths } from "date-fns";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { toIsoDate } from "@/lib/numbers";
import {
  anchorItemsSchema,
  completeItemSchema,
  deleteCompletionSchema,
  setItemActiveSchema,
  upsertChecklistItemSchema,
  WIZARD_AGE_MONTHS,
  type WizardAge,
} from "@/lib/schemas/checklist";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// A completion changes the status view, the progress, the dashboard and the engine counters.
function revalidateBoat(boatId: string) {
  revalidatePath(`/boats/${boatId}`, "layout");
}

// « Fait » (E4-5). The database requires engine hours on hour-based items and derives the
// reading (sync_engine_hours_from_completion). Idempotent on the id drawn by the dialog.
export async function completeChecklistItem(
  input: unknown,
): Promise<ActionResult<{ completionId: string }>> {
  const parsed = parseInput(completeItemSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, itemId, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error } = await supabase.from("checklist_completions").upsert(
    {
      id,
      boat_id: boatId,
      checklist_item_id: itemId,
      completed_at: values.completedAt,
      completed_by: values.completedByName ? null : (values.completedBy ?? userId),
      completed_by_name: values.completedByName,
      engine_hours: values.engineHours,
      next_due_at: values.nextDueAt,
      note: values.note,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateBoat(boatId);
  return ok({ completionId: id });
}

// D15: undo from the toast or delete from the history. RLS: owner/editor, or the pro author
// within 24 h; the derived reading goes with it (cascade).
export async function deleteCompletion(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(deleteCompletionSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, completionId } = parsed.data;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("checklist_completions")
    .delete({ count: "exact" })
    .eq("id", completionId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

// Create or edit a checklist item (E4-6). A new item is anchored today unless a last known
// completion date is given; an edited item keeps its anchor when none is given.
export async function upsertChecklistItem(
  input: unknown,
): Promise<ActionResult<{ itemId: string }>> {
  const parsed = parseInput(upsertChecklistItemSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, anchorDate, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("checklist_items")
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
      .from("checklist_items")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId)
      .eq("category_id", values.categoryId);
    sortOrder = count ?? 0;
  }

  const anchor = anchorDate ?? (existing ? undefined : toIsoDate());
  const { error } = await supabase.from("checklist_items").upsert(
    {
      id,
      boat_id: boatId,
      category_id: values.categoryId,
      label: values.label,
      description: values.description,
      interval_months: values.intervalMonths,
      interval_hours: values.intervalHours,
      engine_id: values.engineId,
      actions: values.actions,
      source: "custom",
      updated_by: userId,
      ...(anchor === undefined ? {} : { anchor_date: anchor }),
      ...(sortOrder === undefined ? {} : { sort_order: sortOrder, created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateBoat(boatId);
  return ok({ itemId: id });
}

// Items are never deleted (their history stays): deactivated and reactivated.
export async function setChecklistItemActive(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(setItemActiveSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId, isActive } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("checklist_items")
    .update({ is_active: isActive, updated_by: userId }, { count: "exact" })
    .eq("id", itemId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

// Start-up wizard (E4-9, D2): items not kept are deactivated, the others get an estimated
// anchor from the rough age given. Updates are grouped per value: a handful of requests.
export async function anchorChecklistItems(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(anchorItemsSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, items } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const today = new Date();
  const buckets = new Map<string, string[]>();
  const dropped: string[] = [];
  const kept: string[] = [];
  for (const item of items) {
    if (!item.keep) {
      dropped.push(item.itemId);
      continue;
    }
    kept.push(item.itemId);
    if (item.age) {
      const anchor = toIsoDate(subMonths(today, WIZARD_AGE_MONTHS[item.age as WizardAge]));
      buckets.set(anchor, [...(buckets.get(anchor) ?? []), item.itemId]);
    }
  }

  if (dropped.length) {
    const { error } = await supabase
      .from("checklist_items")
      .update({ is_active: false, updated_by: userId })
      .eq("boat_id", boatId)
      .in("id", dropped);
    if (error) return fail(dbErrorKey(error));
  }
  if (kept.length) {
    const { error } = await supabase
      .from("checklist_items")
      .update({ is_active: true, updated_by: userId })
      .eq("boat_id", boatId)
      .in("id", kept);
    if (error) return fail(dbErrorKey(error));
  }
  for (const [anchor, ids] of buckets) {
    const { error } = await supabase
      .from("checklist_items")
      .update({ anchor_date: anchor, updated_by: userId })
      .eq("boat_id", boatId)
      .in("id", ids);
    if (error) return fail(dbErrorKey(error));
  }

  revalidateBoat(boatId);
  return ok(undefined);
}
