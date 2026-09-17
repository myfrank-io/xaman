"use server";

import { revalidatePath } from "next/cache";
import { subMonths } from "date-fns";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { toIsoDate } from "@/lib/numbers";
import {
  anchorItemsSchema,
  chooseTemplateSchema,
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

export type TickedItem = {
  /** The completion the database derived from the intervention. */
  completionId: string;
  /** The intervention the tick wrote — or finished, when the point was already in someone's hands. */
  logId: string;
};

/**
 * « Fait » (E4-5, D140): a tick writes an intervention.
 *
 * The checklist and the journal used to be two ways of saying « c'est fait » that never met: a
 * completion nobody saw in the journal, an intervention that only touched the checklist if the
 * points were re-ticked in the form. Now the tick writes the line the journal shows — the point's
 * label as title, its system, the day, the counter read — and the database derives the point's
 * completion from that line (`sync_log_completion`). One history, told once.
 *
 * When the point already carries a planned intervention (« Confié au chantier », D141), the tick
 * finishes *that* line rather than writing a second one for the same job: the plan becomes the
 * record. Idempotent on the id drawn by the gesture (rule 11): a replay from the offline queue
 * finds its row and writes nothing twice.
 */
export async function completeChecklistItem(input: unknown): Promise<ActionResult<TickedItem>> {
  const parsed = parseInput(completeItemSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId, openLogId, ...values } = parsed.data;
  // Entries queued before D140 carry the completion's id only: it serves as the line's id.
  const drawnLogId = parsed.data.logId ?? parsed.data.id ?? crypto.randomUUID();

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: item, error: itemError } = await supabase
    .from("checklist_items")
    .select("id, label, category_id, engine_id")
    .eq("id", itemId)
    .eq("boat_id", boatId)
    .maybeSingle();
  if (itemError) return fail(dbErrorKey(itemError));
  if (!item) return fail("errors.checklist_item_not_found");

  // ---- the intervention: the planned one finished, or a fresh line ------------------------
  let logId = drawnLogId;
  if (openLogId) {
    const { data: open, error: openError } = await supabase
      .from("maintenance_logs")
      .select("id, notes")
      .eq("id", openLogId)
      .eq("boat_id", boatId)
      .eq("checklist_item_id", itemId)
      .is("deleted_at", null)
      .neq("status", "done")
      .maybeSingle();
    if (openError) return fail(dbErrorKey(openError));
    if (open) {
      const { error } = await supabase
        .from("maintenance_logs")
        .update({
          status: "done",
          performed_at: values.completedAt,
          // A note typed on the tick lands on the line when the line has none of its own.
          ...(values.note && !open.notes ? { notes: values.note } : {}),
          updated_by: userId,
        })
        .eq("id", open.id)
        .eq("boat_id", boatId);
      if (error) return fail(dbErrorKey(error));
      logId = open.id;
    }
  }
  if (logId === drawnLogId) {
    const { error } = await supabase.from("maintenance_logs").upsert(
      {
        id: logId,
        boat_id: boatId,
        title: item.label,
        category_id: item.category_id,
        status: "done",
        performed_at: values.completedAt,
        notes: values.note,
        checklist_item_id: item.id,
        created_by: userId,
        updated_by: userId,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
    if (error) return fail(dbErrorKey(error));
    if (item.category_id) {
      const { error: linkError } = await supabase
        .from("maintenance_log_categories")
        .upsert(
          { log_id: logId, category_id: item.category_id, boat_id: boatId, created_by: userId },
          { onConflict: "log_id,category_id", ignoreDuplicates: true },
        );
      if (linkError) return fail(dbErrorKey(linkError));
    }
  }

  // ---- the counter read on the tick travels with the line (D5) ----------------------------
  // The completion takes its hours from there: on an hour-based point the database holds the
  // completion back until this reading lands (check_completion_hours).
  if (values.engineHours !== null && item.engine_id) {
    const { error } = await supabase.from("engine_hour_readings").upsert(
      {
        boat_id: boatId,
        engine_id: item.engine_id,
        hours: values.engineHours,
        read_at: values.completedAt,
        source: "maintenance_log",
        maintenance_log_id: logId,
        created_by: userId,
        updated_by: userId,
      },
      { onConflict: "maintenance_log_id,engine_id" },
    );
    if (error) return fail(dbErrorKey(error));
  }

  // ---- the completion, derived by the database; what only the gesture knows goes on it ----
  const { data: completion, error: completionError } = await supabase
    .from("checklist_completions")
    .select("id")
    .eq("maintenance_log_id", logId)
    .eq("checklist_item_id", itemId)
    .maybeSingle();
  if (completionError) return fail(dbErrorKey(completionError));
  // The one reason the database holds a completion back: hours it needs and did not get.
  if (!completion) return fail("errors.engine_hours_required");

  const extras = {
    ...(values.nextDueAt ? { next_due_at: values.nextDueAt } : {}),
    ...(values.note ? { note: values.note } : {}),
    ...(values.completedByName
      ? { completed_by_name: values.completedByName, completed_by: null }
      : values.completedBy && values.completedBy !== userId
        ? { completed_by: values.completedBy }
        : {}),
  };
  if (Object.keys(extras).length > 0) {
    const { error } = await supabase
      .from("checklist_completions")
      .update({ ...extras, updated_by: userId })
      .eq("id", completion.id)
      .eq("boat_id", boatId);
    if (error) return fail(dbErrorKey(error));
  }

  revalidateBoat(boatId);
  return ok({ completionId: completion.id, logId });
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

/**
 * « Choisir un modèle d'entretien » (D65). The second half of the split: creation gave the boat
 * its systems, this gives them their points.
 *
 * It is the same `apply_checklist_template` the seed and the per-engine action already use, so
 * the categories created at onboarding are linked rather than duplicated (same external_ref) and
 * a point the owner has already written by hand is left alone. Applying a second model therefore
 * adds to the checklist instead of replacing it — which is why the screen offering this only
 * offers it while the boat has no plan.
 */
export async function chooseChecklistTemplate(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(chooseTemplateSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, templateId } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_checklist_template", {
    p_boat_id: boatId,
    p_template_id: templateId,
  });
  if (error) return fail(dbErrorKey(error));

  revalidateBoat(boatId);
  return ok(undefined);
}
