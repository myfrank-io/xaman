import type { SupabaseClient } from "@supabase/supabase-js";

import type { ContactOption } from "@/components/contacts/specialties";
import type { Database } from "@/types/database";

/**
 * The directory as `ContactPicker` wants it (rule 13): everyone still in the annuaire, by name,
 * with the trade the picker groups on and the two lines it shows under it. Trashed providers are
 * out — their rows keep their links until the purge, but nothing new gets filed under them.
 */
export async function contactOptions(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<ContactOption[]> {
  const { data } = await supabase
    .from("contacts")
    .select("id, name, specialty, company, phone")
    .eq("boat_id", boatId)
    .is("deleted_at", null)
    .order("name");
  return data ?? [];
}
