import type { SupabaseClient } from "@supabase/supabase-js";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { ContactOption } from "@/components/contacts/specialties";
import type { LogFormChoice, LogFormEngine } from "@/components/logs/log-form-values";
import { formatDate } from "@/lib/format";
import type { Database } from "@/types/database";

export type LogFormData = {
  categories: CategoryChoice[];
  engines: LogFormEngine[];
  /** Categories the hours block opens for: the engine ones (D3). */
  engineCategoryIds: string[];
  contacts: ContactOption[];
  equipment: LogFormChoice[];
  haulOuts: LogFormChoice[];
};

/**
 * Everything the intervention form needs besides the intervention itself. Read on the server
 * (Server Components by default) and handed down as plain props.
 */
export async function logFormData(
  supabase: SupabaseClient<Database>,
  boatId: string,
  /** « (déposé) » — comes from fr.json, this module never spells UI text (rule 7). */
  removedLabel: string,
): Promise<LogFormData> {
  const [
    { data: categories },
    { data: engines },
    { data: readings },
    { data: engineItems },
    { data: contacts },
    { data: equipment },
    { data: haulOuts },
  ] = await Promise.all([
    supabase
      .from("boat_categories")
      .select("id, name, color, icon, external_ref")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("engines")
      .select("id, label, sort_order")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("engine_current_hours").select("engine_id, hours, read_at").eq("boat_id", boatId),
    // A category carrying engine-linked points is an « engine » category whatever its name.
    supabase
      .from("checklist_items")
      .select("category_id")
      .eq("boat_id", boatId)
      .eq("is_active", true)
      .not("engine_id", "is", null),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, phone")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("equipment")
      .select("id, name, brand, removed_at")
      .eq("boat_id", boatId)
      .order("name"),
    supabase
      .from("haul_outs")
      .select("id, started_at, yard_name")
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("started_at", { ascending: false }),
  ]);

  const engineCategoryIds = new Set<string>(
    (engineItems ?? []).map((row) => row.category_id).filter((id): id is string => Boolean(id)),
  );
  for (const category of categories ?? []) {
    if (category.external_ref === "engines") engineCategoryIds.add(category.id);
  }

  return {
    categories: (categories ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
      icon: row.icon,
    })),
    engines: (engines ?? []).map((row) => {
      const reading = (readings ?? []).find((entry) => entry.engine_id === row.id);
      return {
        id: row.id,
        label: row.label,
        lastHours: reading?.hours ?? null,
        lastDate: reading?.read_at ?? null,
      };
    }),
    engineCategoryIds: [...engineCategoryIds],
    contacts: contacts ?? [],
    equipment: (equipment ?? []).map((row) => ({
      id: row.id,
      label:
        [row.name, row.brand].filter(Boolean).join(" · ") +
        (row.removed_at ? ` (${removedLabel})` : ""),
    })),
    haulOuts: (haulOuts ?? []).map((row) => ({
      id: row.id,
      label: [formatDate(row.started_at), row.yard_name].filter(Boolean).join(" · "),
    })),
  };
}
