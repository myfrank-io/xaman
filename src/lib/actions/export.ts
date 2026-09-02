"use server";

import { fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { toCsv } from "@/lib/export/csv";
import { exportBoatSchema } from "@/lib/schemas/export";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

export type BoatExport = {
  /** `xaman-<boat>-<date>` without extension */
  basename: string;
  json: string;
  interventionsCsv: string;
  depensesCsv: string;
};

const TABLES = [
  "engines",
  "boat_categories",
  "checklist_items",
  "checklist_completions",
  "engine_hour_readings",
  "maintenance_logs",
  "purchases",
  "parts",
  "haul_outs",
  "contacts",
  "equipment",
  "attachments",
] as const;

// Export (E9-2, the non-lock-in guarantee): the whole logbook as JSON plus two flat CSV files,
// read through RLS with the user's own session. Any member may export (SPEC §4.3: export = write
// role; the UI shows the button to owner/editor only, the data is theirs anyway).
export async function exportBoat(input: unknown): Promise<ActionResult<BoatExport>> {
  const parsed = parseInput(exportBoatSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const { data: boat, error: boatError } = await supabase
    .from("boats")
    .select("*")
    .eq("id", boatId)
    .maybeSingle();
  if (boatError || !boat) return fail("errors.forbidden");

  const tables: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*").eq("boat_id", boatId);
    if (error) return fail("errors.loadFailed");
    tables[table] = data ?? [];
  }

  const [{ data: logs }, { data: expenses }] = await Promise.all([
    supabase
      .from("maintenance_logs_view")
      .select("*")
      .eq("boat_id", boatId)
      .order("performed_at", { ascending: false }),
    supabase
      .from("expenses_by_category")
      .select("*")
      .eq("boat_id", boatId)
      .order("date", { ascending: false }),
  ]);

  const exportedAt = new Date().toISOString();
  const json = JSON.stringify(
    { format: "xaman-boat-export", version: 1, exported_at: exportedAt, boat, ...tables },
    null,
    2,
  );

  const hoursText = (value: unknown): string => {
    if (!Array.isArray(value)) return "";
    return value
      .map((reading) => {
        const row = reading as { label?: string; hours?: number };
        return row.label && row.hours !== undefined ? `${row.label} ${row.hours} h` : "";
      })
      .filter(Boolean)
      .join(" · ");
  };

  const interventionsCsv = toCsv(logs ?? [], [
    { header: "Date", value: (row) => row.performed_at },
    { header: "Titre", value: (row) => row.title },
    { header: "Catégorie", value: (row) => row.category_name },
    { header: "Statut", value: (row) => row.status },
    { header: "Réalisé par", value: (row) => row.contact_name ?? "" },
    { header: "Coût", value: (row) => row.cost },
    { header: "Heures moteur", value: (row) => hoursText(row.engine_hours) },
    { header: "À vérifier", value: (row) => (row.needs_review ? "oui" : "") },
    { header: "Notes", value: (row) => row.notes },
    { header: "Saisi par", value: (row) => row.created_by_name },
  ]);

  const depensesCsv = toCsv(expenses ?? [], [
    { header: "Date", value: (row) => row.date },
    { header: "Libellé", value: (row) => row.label },
    { header: "Source", value: (row) => row.source },
    { header: "Type", value: (row) => row.purchase_kind ?? "" },
    { header: "Catégorie", value: (row) => row.category_name },
    { header: "Montant", value: (row) => row.amount },
    { header: "Devise", value: (row) => row.currency },
  ]);

  const slug = boat.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return ok({
    basename: `xaman-${slug || "bateau"}-${exportedAt.slice(0, 10)}`,
    json,
    interventionsCsv,
    depensesCsv,
  });
}
