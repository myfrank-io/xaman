"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, contactPath } from "@/lib/queries/boat-routes";
import { trashContactSchema, upsertContactSchema } from "@/lib/schemas/contacts";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

function revalidateContactScreens(boatId: string, contactId: string) {
  revalidatePath(boatPath(boatId, "contacts"));
  revalidatePath(contactPath(boatId, contactId));
}

// Create or edit a contact (E6-2); also the inline creation of ContactPicker (rule 11: upsert).
export async function upsertContact(
  input: unknown,
): Promise<ActionResult<{ contactId: string; name: string; specialty: string }>> {
  const parsed = parseInput(upsertContactSchema, input);
  if (!parsed.ok) return parsed.result;
  const { id, boatId, expectedUpdatedAt, ...values } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");
  const { data: existing, error: readError } = await supabase
    .from("contacts")
    .select("id, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (readError) return fail(dbErrorKey(readError));
  if (existing && expectedUpdatedAt && existing.updated_at !== expectedUpdatedAt) {
    return fail("errors.conflict");
  }

  const { error } = await supabase.from("contacts").upsert(
    {
      id,
      boat_id: boatId,
      name: values.name,
      specialty: values.specialty,
      company: values.company,
      phone: values.phone,
      email: values.email,
      address: values.address,
      notes: values.notes,
      updated_by: userId,
      ...(existing ? {} : { created_by: userId }),
    },
    { onConflict: "id" },
  );
  if (error) return fail(dbErrorKey(error));

  revalidateContactScreens(boatId, id);
  return ok({ contactId: id, name: values.name, specialty: values.specialty });
}

// Every screen that offers the directory in a picker, plus the trash the row lands in.
function revalidateContactReferences(boatId: string) {
  revalidatePath(boatPath(boatId, "contacts"));
  revalidatePath(boatPath(boatId, "logs"), "layout");
  revalidatePath(boatPath(boatId, "supplies"));
  revalidatePath(boatPath(boatId, "boat"));
  revalidatePath(boatPath(boatId, "trash"));
}

/**
 * Move a provider to the trash (D41). The hard delete this replaces fired `on delete set null`
 * on every intervention, purchase, part and haul-out naming them: the history lost the name and
 * nothing could put it back. Trashing keeps every link; only the purge, 30 days later, severs
 * them — which is what the confirmation now says.
 */
export async function trashContact(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashContactSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, contactId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("contacts")
    .update({ deleted_at: new Date().toISOString(), updated_by: userId }, { count: "exact" })
    .eq("id", contactId)
    .eq("boat_id", boatId)
    .is("deleted_at", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateContactReferences(boatId);
  return ok(undefined);
}

/** « Annuler » of the toast, before the trash screen takes over. */
export async function untrashContact(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(trashContactSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, contactId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { error, count } = await supabase
    .from("contacts")
    .update({ deleted_at: null, updated_by: userId }, { count: "exact" })
    .eq("id", contactId)
    .eq("boat_id", boatId)
    .not("deleted_at", "is", null);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidateContactReferences(boatId);
  return ok(undefined);
}
