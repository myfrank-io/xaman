import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * The trades already used on a boat, so each becomes a chip on the contact form.
 *
 * Read from the contacts themselves rather than kept in a table of their own: a trade exists
 * exactly as long as someone is filed under it, and there is nothing to tidy up when the last
 * one goes.
 */
export async function usedSpecialties(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<string[]> {
  const { data } = await supabase.from("contacts").select("specialty").eq("boat_id", boatId);
  const seen = new Set<string>();
  for (const row of data ?? []) {
    const trade = (row.specialty ?? "").trim();
    if (trade !== "") seen.add(trade);
  }
  return [...seen];
}
