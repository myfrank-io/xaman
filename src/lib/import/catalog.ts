import type { ImportCatalog, EntityDescriptor } from "@/lib/import/entities";
import type { createClient } from "@/lib/supabase/server";

type Client = Awaited<ReturnType<typeof createClient>>;

/**
 * A spreadsheet of completed checklist points or of hour readings names its subject in a
 * person's own words — « Vidange bâbord », « BB » — never by id. This reads what the boat
 * carries so the same names can be resolved twice with the same answer: once by the preview,
 * which announces « 3 refusées » before anything is written, once by the Server Action.
 *
 * Read through the caller's client, so RLS decides what is visible exactly as everywhere else.
 */

/**
 * The most recent readings are what a new sheet is compared against; a boat with more than
 * this many has a decade of logbook, and its oldest lines simply lose the backwards check.
 */
const READINGS_MAX = 2000;

export async function loadImportCatalog(
  supabase: Client,
  boatId: string,
  descriptor: EntityDescriptor,
): Promise<ImportCatalog> {
  if (descriptor.catalog === "checklist") {
    // Inactive points included on purpose: a point retired last winter still received the
    // completions written in the paper logbook, and refusing them would lose real history.
    const { data } = await supabase
      .from("checklist_items")
      .select("id, label, interval_hours")
      .eq("boat_id", boatId);
    return {
      items: (data ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        intervalHours: item.interval_hours,
      })),
    };
  }

  if (descriptor.catalog === "engines") {
    const [{ data: engines }, { data: readings }] = await Promise.all([
      supabase.from("engines").select("id, label, position").eq("boat_id", boatId),
      supabase
        .from("engine_hour_readings")
        .select("engine_id, read_at, hours")
        .eq("boat_id", boatId)
        .order("read_at", { ascending: false })
        .limit(READINGS_MAX),
    ]);
    return {
      engines: (engines ?? []).map((engine) => ({
        id: engine.id,
        label: engine.label,
        position: engine.position,
      })),
      readings: (readings ?? []).map((reading) => ({
        engineId: reading.engine_id,
        readAt: reading.read_at,
        hours: reading.hours,
      })),
    };
  }

  return {};
}
