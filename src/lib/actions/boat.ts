"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath } from "@/lib/queries/boat-routes";
import { deleteBoatSchema, updateBoatSchema } from "@/lib/schemas/boat";
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
