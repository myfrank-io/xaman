import type { SupabaseClient } from "@supabase/supabase-js";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { ContactOption } from "@/components/contacts/specialties";
import type { Database } from "@/types/database";

export type PartFormContext = {
  categories: CategoryChoice[];
  contacts: ContactOption[];
};

/** What the part form needs besides the row: the systems and the directory (E5-4). */
export async function partFormContext(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<PartFormContext> {
  const [{ data: categories }, { data: contacts }] = await Promise.all([
    supabase
      .from("boat_categories")
      .select("id, name, color, icon")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("name"),
  ]);
  return { categories: categories ?? [], contacts: contacts ?? [] };
}
