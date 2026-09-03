import type { SupabaseClient } from "@supabase/supabase-js";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { ContactOption } from "@/components/contacts/specialties";
import type { LogOption } from "@/components/supplies/PurchaseForm";
import type { Database } from "@/types/database";

/** Recent interventions offered by « Intervention liée », and past designations. */
const RECENT_LOGS = 40;
const SUGGESTION_SOURCE = 200;
const MAX_SUGGESTIONS = 30;

export type PurchaseFormContext = {
  categories: CategoryChoice[];
  contacts: ContactOption[];
  logs: LogOption[];
  suggestions: string[];
};

/**
 * Everything the purchase form needs besides the row itself (E5-2). Designations are ranked
 * by how often they were typed, then by recency: it is the « déjà saisi » shortcut of
 * ux-flows §4.6, computed here rather than with a distinct query per keystroke.
 */
export async function purchaseFormContext(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<PurchaseFormContext> {
  const [{ data: categories }, { data: contacts }, { data: logs }, { data: past }] =
    await Promise.all([
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
      supabase
        .from("maintenance_logs")
        .select("id, title, performed_at")
        .eq("boat_id", boatId)
        .is("deleted_at", null)
        .order("performed_at", { ascending: false })
        .limit(RECENT_LOGS),
      supabase
        .from("purchases")
        .select("designation")
        .eq("boat_id", boatId)
        .is("deleted_at", null)
        .order("purchased_at", { ascending: false })
        .limit(SUGGESTION_SOURCE),
    ]);

  const counts = new Map<string, number>();
  for (const row of past ?? []) {
    const value = row.designation.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return {
    categories: categories ?? [],
    contacts: contacts ?? [],
    logs: (logs ?? []).map((log) => ({
      id: log.id,
      title: log.title,
      performedAt: log.performed_at,
    })),
    suggestions: [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SUGGESTIONS)
      .map(([value]) => value),
  };
}
