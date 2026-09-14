import type { SupabaseClient } from "@supabase/supabase-js";

import type { EquipmentKind } from "@/lib/equipment-kinds";
import type { Database } from "@/types/database";

/**
 * The catalogue of equipment families (E17-3), in the order it is offered.
 *
 * A reference table with no `boat_id` (migration `0032`): the same list for every boat, readable
 * by anyone signed in. RLS already hides the deactivated ones from everybody but the platform
 * admin, so the query says nothing about `is_active` — a family retired while a boat still points
 * at it keeps its row, and that boat keeps its family.
 */
export async function equipmentKindChoices(
  supabase: SupabaseClient<Database>,
): Promise<EquipmentKind[]> {
  const { data } = await supabase
    .from("equipment_kinds")
    .select("id, external_ref, label, category_ref, synonyms")
    .order("sort_order")
    .order("label");
  return (data ?? []).map((row) => ({
    id: row.id,
    externalRef: row.external_ref,
    label: row.label,
    categoryRef: row.category_ref,
    synonyms: row.synonyms,
  }));
}
