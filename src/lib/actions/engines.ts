"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, enginePath } from "@/lib/queries/boat-routes";
import {
  addHourReadingSchema,
  deleteHourReadingSchema,
  generateEngineChecklistSchema,
  setEngineActiveSchema,
  updateHourReadingSchema,
  upsertEngineSchema,
} from "@/lib/schemas/engines";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// Every screen showing an engine counter or a deadline in hours.
function revalidateEngineScreens(boatId: string, engineId: string) {
  revalidatePath(boatPath(boatId, "boat"));
  revalidatePath(enginePath(boatId, engineId));
  revalidatePath(boatPath(boatId, "dashboard"));
  revalidatePath(boatPath(boatId, "checklist"), "layout");
}

// Create or edit an engine: the id comes from the form, so a double tap is one row (rule 11).
export async function upsertEngine(input: unknown): Promise<ActionResult<{ engineId: string }>> {
  const parsed = parseInput(upsertEngineSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { data: existing, error: readError } = await supabase
    .from("engines")
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
      .from("engines")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId);
    sortOrder = count ?? 0;
  }

  const { error } = await supabase.from("engines").upsert(
    {
      id,
      boat_id: boatId,
      label: values.label,
      position: values.position,
      brand: values.brand,
      model: values.model,
      serial: values.serial,
      installed_at: values.installedAt,
      notes: values.notes,
      updated_by: userId,
      ...(sortOrder === undefined ? {} : { sort_order: sortOrder, created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateEngineScreens(boatId, id);
  return ok({ engineId: id });
}

// D14: an engine is deactivated, never deleted; its checklist items leave the status view.
export async function setEngineActive(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(setEngineActiveSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, engineId, isActive } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { error, count } = await supabase
    .from("engines")
    .update({ is_active: isActive, updated_by: userId }, { count: "exact" })
    .eq("id", engineId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateEngineScreens(boatId, engineId);
  return ok(undefined);
}

// Manual hour reading (UX flow e). RLS: owner, editor or pro. D12: "the counter was replaced"
// stamps the engine so hour deadlines older than the reading are ignored.
export async function addHourReading(input: unknown): Promise<ActionResult<{ readingId: string }>> {
  const parsed = parseInput(addHourReadingSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, engineId, hours, readAt, note, counterReplaced } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  if (counterReplaced) {
    const { error, count } = await supabase
      .from("engines")
      .update(
        { counter_reset_at: readAt, counter_reset_note: note, updated_by: userId },
        { count: "exact" },
      )
      .eq("id", engineId)
      .eq("boat_id", boatId);
    if (error) return fail(dbErrorKey(error));
    if (!count) return fail("errors.forbidden");
  }

  const { error } = await supabase.from("engine_hour_readings").upsert(
    {
      id,
      boat_id: boatId,
      engine_id: engineId,
      hours,
      read_at: readAt,
      source: "manual",
      note,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateEngineScreens(boatId, engineId);
  return ok({ readingId: id });
}

// D16: the reading history is editable; nothing is denormalised, the views follow.
export async function updateHourReading(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(updateHourReadingSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, readingId, expectedUpdatedAt, hours, readAt, note } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  let query = supabase
    .from("engine_hour_readings")
    .update({ hours, read_at: readAt, note, updated_by: userId }, { count: "exact" })
    .eq("id", readingId)
    .eq("boat_id", boatId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { data, error, count } = await query.select("engine_id");
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail(expectedUpdatedAt ? "errors.conflict" : "errors.forbidden");

  revalidateEngineScreens(boatId, data?.[0]?.engine_id ?? "");
  return ok(undefined);
}

export async function deleteHourReading(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(deleteHourReadingSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, readingId } = parsed.data;

  const supabase = await createClient();
  const { data, error, count } = await supabase
    .from("engine_hour_readings")
    .delete({ count: "exact" })
    .eq("id", readingId)
    .eq("boat_id", boatId)
    .select("engine_id");
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateEngineScreens(boatId, data?.[0]?.engine_id ?? "");
  return ok(undefined);
}

// Instantiates the boat's template for one engine (only offered while it has no item).
export async function generateEngineChecklist(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(generateEngineChecklistSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, engineId } = parsed.data;

  const supabase = await createClient();
  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("checklist_template_id")
    .eq("id", boatId)
    .maybeSingle();
  if (boatError) return fail(dbErrorKey(boatError));
  if (!boat?.checklist_template_id) return fail("errors.template_not_found");

  const { error } = await supabase.rpc("apply_checklist_template", {
    p_boat_id: boatId,
    p_template_id: boat.checklist_template_id,
    p_engine_id: engineId,
  });
  if (error) return fail(dbErrorKey(error));

  revalidateEngineScreens(boatId, engineId);
  return ok(undefined);
}
