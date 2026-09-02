"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { updateProfileSchema } from "@/lib/schemas/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(updateProfileSchema, input);
  if (!parsed.ok) return parsed.result;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: parsed.data.fullName, locale: parsed.data.locale })
    .eq("id", user.id);
  if (error) return fail(dbErrorKey(error));
  revalidatePath("/settings/profile");
  return ok(undefined);
}

// Deletes the account (auth.users → cascade). Refused while the user is the last owner of a boat:
// the boat's data must not become orphaned (transfer ownership first). Created data survives (FK set null).
export async function deleteAccount(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("errors.forbidden");

  const { data: ownerships, error } = await supabase
    .from("boat_members")
    .select("boat_id")
    .eq("user_id", user.id)
    .eq("role", "owner");
  if (error) return fail(dbErrorKey(error));

  const admin = createAdminClient();
  for (const { boat_id } of ownerships ?? []) {
    const { count } = await admin
      .from("boat_members")
      .select("user_id", { count: "exact", head: true })
      .eq("boat_id", boat_id)
      .eq("role", "owner")
      .neq("user_id", user.id);
    if (!count) return fail("errors.last_owner");
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return fail("errors.unknown");
  await supabase.auth.signOut();
  redirect("/login");
}
