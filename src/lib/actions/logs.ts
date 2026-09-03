"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath } from "@/lib/queries/boat-routes";
import {
  recurringFromLogSchema,
  saveLogSchema,
  suggestItemsSchema,
  titleSuggestionsSchema,
  trashLogSchema,
} from "@/lib/schemas/logs";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// An intervention moves the journal, the dashboard, the engine counters and — when it ticks
// checklist points — the whole checklist: the boat subtree is revalidated as a whole.
function revalidateBoat(boatId: string) {
  revalidatePath(`/boats/${boatId}`, "layout");
}

export type SavedLog = {
  logId: string;
  /** Readings actually written, for the factual toast (« Relevé Moteur SB 1 256 h »). */
  readings: { engineId: string; hours: number }[];
  completions: number;
};

/**
 * Single entry point of the journal form (E3-3, D3, D18): upsert of the intervention on the id
 * drawn when the form opened, upsert of one reading per filled engine field, and one completion
 * per ticked checklist point. A field left empty writes no reading and removes the one it had.
 */
export async function saveLog(input: unknown): Promise<ActionResult<SavedLog>> {
  const parsed = parseInput(saveLogSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, engineHours, checklistItemIds, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: existing, error: readError } = await supabase
    .from("maintenance_logs")
    .select("id, updated_at")
    .eq("id", id)
    .eq("boat_id", boatId)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (existing && expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
    return fail("errors.conflict");
  }

  const row = {
    id,
    boat_id: boatId,
    title: values.title,
    category_id: values.categoryId,
    status: values.status,
    performed_at: values.performedAt,
    cost: values.cost,
    contact_id: values.contactId,
    equipment_id: values.equipmentId,
    haul_out_id: values.haulOutId,
    notes: values.notes,
    updated_by: userId,
  };

  // A line that exists is UPDATEd, never upserted (D42). `maintenance_logs_insert` checks
  // `created_by = auth.uid()`, and Postgres runs that check against the proposed row *before*
  // it resolves the conflict — so an upsert that leaves `created_by` alone, as E10-4 requires
  // (« créé par » must stay true), is refused for everyone, the owner included. The UPDATE
  // policy is the one that says who may edit an existing line; it is the one that must apply.
  // Creation keeps the upsert: the id is drawn when the form opens, so a double tap writes one
  // row (rule 11), and `created_by` is the signed-in user, which the INSERT check accepts.
  const { error } = existing
    ? await supabase.from("maintenance_logs").update(row).eq("id", id).eq("boat_id", boatId)
    : await supabase
        .from("maintenance_logs")
        .upsert({ ...row, created_by: userId }, { onConflict: "id" });
  if (error) return fail(dbErrorKey(error));

  // ---- engine readings ------------------------------------------------------------------
  const filled = engineHours.filter(
    (entry): entry is { engineId: string; hours: number } => entry.hours !== null,
  );
  const emptied = engineHours.filter((entry) => entry.hours === null).map((e) => e.engineId);

  if (filled.length > 0) {
    const { error: readingError } = await supabase.from("engine_hour_readings").upsert(
      filled.map((entry) => ({
        boat_id: boatId,
        engine_id: entry.engineId,
        hours: entry.hours,
        read_at: values.performedAt,
        source: "maintenance_log" as const,
        maintenance_log_id: id,
        created_by: userId,
        updated_by: userId,
      })),
      { onConflict: "maintenance_log_id,engine_id" },
    );
    if (readingError) return fail(dbErrorKey(readingError));
  }
  if (emptied.length > 0) {
    const { error: deleteError } = await supabase
      .from("engine_hour_readings")
      .delete()
      .eq("maintenance_log_id", id)
      .in("engine_id", emptied);
    if (deleteError) return fail(dbErrorKey(deleteError));
  }

  // ---- checklist completions ------------------------------------------------------------
  // Only work that is done acknowledges a checklist point.
  const ticked = values.status === "done" ? checklistItemIds : [];
  const { data: linked, error: linkedError } = await supabase
    .from("checklist_completions")
    .select("id, checklist_item_id")
    .eq("maintenance_log_id", id);
  if (linkedError) return fail(dbErrorKey(linkedError));

  const obsolete = (linked ?? []).filter((row) => !ticked.includes(row.checklist_item_id));
  if (obsolete.length > 0) {
    const { error: dropError } = await supabase
      .from("checklist_completions")
      .delete()
      .in(
        "id",
        obsolete.map((row) => row.id),
      );
    if (dropError) return fail(dbErrorKey(dropError));
  }

  const missing = ticked.filter(
    (itemId) => !(linked ?? []).some((row) => row.checklist_item_id === itemId),
  );
  if (missing.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("checklist_items")
      .select("id, engine_id, interval_hours")
      .eq("boat_id", boatId)
      .in("id", missing);
    if (itemsError) return fail(dbErrorKey(itemsError));

    const hoursOf = (engineId: string | null) =>
      engineId ? (filled.find((entry) => entry.engineId === engineId)?.hours ?? null) : null;

    // The database refuses a completion without hours on an hour-based point; the form greys
    // those points out, so reaching this is a race — say so instead of writing half the form.
    const blocked = (items ?? []).find(
      (item) => item.interval_hours !== null && hoursOf(item.engine_id) === null,
    );
    if (blocked) return fail("errors.engine_hours_required");

    const { error: completionError } = await supabase.from("checklist_completions").insert(
      (items ?? []).map((item) => ({
        boat_id: boatId,
        checklist_item_id: item.id,
        completed_at: values.performedAt,
        completed_by: userId,
        engine_hours: hoursOf(item.engine_id),
        maintenance_log_id: id,
        created_by: userId,
        updated_by: userId,
      })),
    );
    if (completionError) return fail(dbErrorKey(completionError));
  }

  revalidateBoat(boatId);
  return ok({ logId: id, readings: filled, completions: ticked.length });
}

/** Soft delete (rule 9). The database parks the readings in pending_engine_hours (D5). */
export async function trashLog(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashLogSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, logId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("maintenance_logs")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId }, { count: "exact" })
    .eq("id", logId)
    .eq("boat_id", boatId)
    .is("deleted_at", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateBoat(boatId);
  return ok(undefined);
}

export type TitleSuggestion = {
  title: string;
  categoryId: string | null;
  engineId: string | null;
  occurrences: number;
  lastPerformedAt: string | null;
};

/** Titles already used on this boat (ux-flows §4.6): the 45 s budget rests on them. */
export async function suggestLogTitles(input: unknown): Promise<ActionResult<TitleSuggestion[]>> {
  const parsed = parseInput(titleSuggestionsSchema, input);
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("log_title_suggestions", {
    p_boat_id: parsed.data.boatId,
    p_query: parsed.data.query,
  });
  if (error) return fail(dbErrorKey(error));

  return ok(
    (data ?? []).map((row) => ({
      title: row.title,
      categoryId: row.category_id,
      engineId: row.engine_id,
      occurrences: row.occurrences,
      lastPerformedAt: row.last_performed_at,
    })),
  );
}

export type ItemSuggestion = {
  id: string;
  label: string;
  engineId: string | null;
  engineLabel: string | null;
  intervalMonths: number | null;
  intervalHours: number | null;
  status: "never" | "ok" | "soon" | "overdue";
  daysRemaining: number | null;
  hoursRemaining: number | null;
  currentHours: number | null;
  score: number;
};

/** Checklist points named by this title, in this category (E3-3b, D3). */
export async function suggestChecklistItems(
  input: unknown,
): Promise<ActionResult<ItemSuggestion[]>> {
  const parsed = parseInput(suggestItemsSchema, input);
  if (!parsed.ok) return parsed.result;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("suggest_checklist_items", {
    p_boat_id: parsed.data.boatId,
    p_category_id: parsed.data.categoryId,
    p_title: parsed.data.title,
  });
  if (error) return fail(dbErrorKey(error));

  return ok(
    (data ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      engineId: row.engine_id,
      engineLabel: row.engine_label,
      intervalMonths: row.interval_months,
      intervalHours: row.interval_hours,
      status: row.status,
      daysRemaining: row.days_remaining,
      hoursRemaining: row.hours_remaining,
      currentHours: row.current_hours,
      score: row.score,
    })),
  );
}

/**
 * « En faire un entretien récurrent » (E3-4): the intervention becomes a checklist point
 * anchored on its own date, and is registered as its first completion so the next deadline
 * counts from there.
 */
export async function createRecurringFromLog(
  input: unknown,
): Promise<ActionResult<{ itemId: string; categoryId: string }>> {
  const parsed = parseInput(recurringFromLogSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, logId, itemId, intervalMonths, intervalHours, engineId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: log, error: logError } = await supabase
    .from("maintenance_logs")
    .select("id, title, category_id, performed_at, notes")
    .eq("id", logId)
    .eq("boat_id", boatId)
    .is("deleted_at", null)
    .maybeSingle();
  if (logError) return fail(dbErrorKey(logError));
  if (!log?.category_id) return fail("errors.log_not_found");

  // Hours of the chosen engine on this very intervention: the anchor of the hour deadline.
  let hours: number | null = null;
  if (engineId) {
    const { data: reading, error: readingError } = await supabase
      .from("engine_hour_readings")
      .select("hours")
      .eq("maintenance_log_id", logId)
      .eq("engine_id", engineId)
      .maybeSingle();
    if (readingError) return fail(dbErrorKey(readingError));
    hours = reading?.hours ?? null;
  }
  if (intervalHours !== null && hours === null) return fail("errors.engine_hours_required");

  const { count } = await supabase
    .from("checklist_items")
    .select("id", { count: "exact", head: true })
    .eq("boat_id", boatId)
    .eq("category_id", log.category_id);

  const { error: itemError } = await supabase.from("checklist_items").upsert(
    {
      id: itemId,
      boat_id: boatId,
      category_id: log.category_id,
      label: log.title,
      interval_months: intervalMonths,
      interval_hours: intervalHours,
      engine_id: engineId,
      source: "custom" as const,
      sort_order: count ?? 0,
      anchor_date: log.performed_at,
      anchor_hours: hours,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (itemError) return fail(dbErrorKey(itemError));

  const { error: completionError } = await supabase.from("checklist_completions").insert({
    boat_id: boatId,
    checklist_item_id: itemId,
    completed_at: log.performed_at,
    completed_by: userId,
    engine_hours: hours,
    maintenance_log_id: logId,
    created_by: userId,
    updated_by: userId,
  });
  if (completionError) return fail(dbErrorKey(completionError));

  revalidateBoat(boatId);
  revalidatePath(boatPath(boatId, "checklist"), "layout");
  return ok({ itemId, categoryId: log.category_id });
}
