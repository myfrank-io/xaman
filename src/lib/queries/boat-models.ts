import type { SupabaseClient } from "@supabase/supabase-js";

import type { BoatModelOption } from "@/lib/boat-models";
import type { Database } from "@/types/database";

/**
 * The whole catalogue, once (0019, 0020).
 *
 * The whole catalogue goes to the client in one go and is matched there, which is what lets a chip
 * appear on the keystroke rather than after a round trip. Measured at 596 models: 109 KB of JSON,
 * 7.7 KB over the wire once compressed. Dropping the three dimensions — which only the Bateau
 * screen reads — would save 4.5 KB of that, and is not worth two shapes of the same query.
 * `boat_models_select` shows only active rows to anyone but the platform admin, so a model retired
 * from `seed/boat-models.json` stops being suggested without the query knowing anything about it.
 */
export async function boatModels(supabase: SupabaseClient<Database>): Promise<BoatModelOption[]> {
  const { data } = await supabase
    .from("boat_models")
    .select("id, builder, model, boat_type, year_from, year_to, length_m, beam_m, draft_m")
    .order("builder")
    .order("length_m", { nullsFirst: false });

  return (data ?? []).map((row) => ({
    id: row.id,
    builder: row.builder,
    model: row.model,
    boatType: row.boat_type,
    yearFrom: row.year_from,
    yearTo: row.year_to,
    lengthM: row.length_m,
    beamM: row.beam_m,
    draftM: row.draft_m,
  }));
}
