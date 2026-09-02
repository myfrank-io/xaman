"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { boatPath, contactPath } from "@/lib/queries/boat-routes";
import { deleteContactSchema, upsertContactSchema } from "@/lib/schemas/contacts";
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

// Physical delete: every FK to contacts is `on delete set null`, the UI shows the counts first.
export async function deleteContact(input: unknown): Promise<ActionResult> {
  const parsed = parseInput(deleteContactSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, contactId } = parsed.data;

  const supabase = await createClient();
  const { error, count } = await supabase
    .from("contacts")
    .delete({ count: "exact" })
    .eq("id", contactId)
    .eq("boat_id", boatId);
  if (error) return fail(dbErrorKey(error));
  if (!count) return fail("errors.forbidden");

  revalidatePath(boatPath(boatId, "contacts"));
  revalidatePath(boatPath(boatId, "logs"), "layout");
  revalidatePath(boatPath(boatId, "supplies"));
  return ok(undefined);
}
