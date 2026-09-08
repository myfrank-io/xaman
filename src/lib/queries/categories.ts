import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

type CategoryRow = Database["public"]["Tables"]["boat_categories"]["Row"];

/**
 * A category as every picker, chip row and badge reads it. `external_ref` rides along because
 * two screens need it to recognise the seeded systems (« engines » opens the hours block, D3)
 * and one shape for every call site is worth the extra slug on the wire.
 */
export type CategoryOption = Pick<CategoryRow, "id" | "name" | "color" | "icon" | "external_ref">;

/**
 * The boat's live systems, in the order they are shown everywhere (D8): the same four lines of
 * query that used to be pasted into every form loader and every screen that offers a category.
 * Deactivated systems are left out — a category you can no longer choose has no place in a
 * chooser; the screens that must resolve an *old* row's system read the table without this
 * filter.
 */
export async function activeCategories(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<CategoryOption[]> {
  const { data } = await supabase
    .from("boat_categories")
    .select("id, name, color, icon, external_ref")
    .eq("boat_id", boatId)
    .eq("is_active", true)
    .order("sort_order");
  return data ?? [];
}
