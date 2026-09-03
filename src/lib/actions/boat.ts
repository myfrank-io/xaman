"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath } from "@/lib/queries/boat-routes";
import { createBoatSchema, deleteBoatSchema, updateBoatSchema } from "@/lib/schemas/boat";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

// Identity of the boat (E2-1). RLS: owner or editor. D27: an update against a stale updated_at is
// refused and reported as a conflict, never merged silently.
export async function updateBoat(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(updateBoatSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, expectedUpdatedAt, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  let query = supabase
    .from("boats")
    .update(
      {
        updated_by: userId,
        name: values.name,
        type: values.type,
        builder: values.builder,
        model: values.model,
        hull_number: values.hullNumber,
        year: values.year,
        flag: values.flag,
        home_port: values.homePort,
        sail_number: values.sailNumber,
        length_m: values.lengthM,
        beam_m: values.beamM,
        draft_m: values.draftM,
        notes: values.notes,
      },
      { count: "exact" },
    )
    .eq("id", boatId);
  if (expectedUpdatedAt) query = query.eq("updated_at", expectedUpdatedAt);
  const { error, count } = await query;
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail(expectedUpdatedAt ? "errors.conflict" : "errors.forbidden");

  revalidatePath(boatPath(boatId, "boat"));
  revalidatePath(boatPath(boatId, "dashboard"));
  return ok(undefined);
}

/**
 * Opening a carnet (D63, E11-3). One call: the boat, its owner, its engines and the whole
 * checklist instantiated from the chosen model — `create_boat` does all four in one transaction,
 * because a boat that exists without an owner, or without its checklist, is a broken boat.
 *
 * `boats_insert` is still `is_platform_admin()`: this RPC is the only door, which is what
 * guarantees the « au moins un owner » rule from the first millisecond.
 *
 * Idempotent (rule 11, D18): the form draws `boatId` when it opens, so the second tap of a
 * double tap replays the same call and gets the same boat back instead of a twin.
 */
export async function createBoat(input: unknown): Promise<ActionResult<{ boatId: string }>> {
  const parsed = parseInput(createBoatSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, name, templateId, engines } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error } = await supabase.rpc("create_boat", {
    p_boat_id: boatId,
    p_name: name,
    p_template_id: templateId,
    p_engines: engines,
  });
  if (error) return fail(dbErrorKey(error));

  // The boat list and the shell's boat name are server-rendered.
  revalidatePath("/boats");
  return ok({ boatId });
}

// Deletes the boat and everything it carries (cascade). Owner only (RLS); the name must be typed.
export async function deleteBoat(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(deleteBoatSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, confirmName } = parsed.data;

  const supabase = await createClient();
  const { data: boat, error } = await supabase
    .from("boats")
    .select("name")
    .eq("id", boatId)
    .maybeSingle();
  if (error) return fail(dbErrorKey(error));
  if (!boat) return fail("errors.forbidden");
  if (boat.name.trim().toLocaleLowerCase("fr") !== confirmName.toLocaleLowerCase("fr")) {
    return fail("errors.boat_name_mismatch", { confirmName: ["boat_name_mismatch"] });
  }

  const { error: deleteError, count } = await supabase
    .from("boats")
    .delete({ count: "exact" })
    .eq("id", boatId);
  if (deleteError) return fail(dbErrorKey(deleteError));
  if (!count) return fail("errors.forbidden");

  revalidatePath("/boats");
  redirect("/boats");
}
