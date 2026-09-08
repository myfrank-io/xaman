import type { SupabaseClient } from "@supabase/supabase-js";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { ContactOption } from "@/components/contacts/specialties";
import { activeCategories } from "@/lib/queries/categories";
import { contactOptions } from "@/lib/queries/contacts";
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
  const [categories, contacts] = await Promise.all([
    activeCategories(supabase, boatId),
    contactOptions(supabase, boatId),
  ]);
  return { categories, contacts };
}
