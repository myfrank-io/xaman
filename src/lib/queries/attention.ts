import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isDueToday,
  itemNeedsAttention,
  logNeedsAttention,
  OPEN_LOG_STATUSES,
} from "@/lib/attention";
import { todayString } from "@/lib/format";
import type { Database } from "@/types/database";

/** Ce qui est à faire aujourd'hui sur un bateau, tel que les points rouges le racontent (D81). */
export type BoatAttention = {
  /** Points de checklist en retard ou dus dans la journée. */
  items: number;
  /** Interventions urgentes, ou ouvertes et datées d'aujourd'hui ou d'avant. */
  logs: number;
  /**
   * Les seuls points dus dans la journée, par système : la tuile de la grille y ajoute son
   * propre compte de retards (`checklist_category_progress.overdue_count`).
   */
  dueTodayByCategory: Map<string, number>;
};

type Client = SupabaseClient<Database>;

/**
 * Points de checklist : « ok » et « never » ne peuvent pas être dus aujourd'hui, la vue les a
 * déjà écartés. La soustraction, elle, est faite en base (`days_remaining`) — la règle du point
 * rouge ne recalcule aucune échéance, elle lit celle de `checklist_item_status` (règle 8).
 */
export async function loadItemAttention(
  supabase: Client,
  boatId: string,
): Promise<Pick<BoatAttention, "items" | "dueTodayByCategory">> {
  const { data } = await supabase
    .from("checklist_item_status")
    .select("category_id, status, days_remaining")
    .eq("boat_id", boatId)
    .in("status", ["overdue", "soon"]);

  const dueTodayByCategory = new Map<string, number>();
  let items = 0;
  for (const row of data ?? []) {
    const item = { status: row.status, daysRemaining: row.days_remaining };
    if (!itemNeedsAttention(item)) continue;
    items += 1;
    if (!isDueToday(item)) continue;
    const key = row.category_id ?? "";
    dueTodayByCategory.set(key, (dueTodayByCategory.get(key) ?? 0) + 1);
  }
  return { items, dueTodayByCategory };
}

/** Interventions : la vue ne montre que les lignes vivantes (`deleted_at is null`). */
export async function loadLogAttention(
  supabase: Client,
  boatId: string,
  today: string = todayString(),
): Promise<number> {
  const { data } = await supabase
    .from("maintenance_logs_view")
    .select("status, performed_at")
    .eq("boat_id", boatId)
    .in("status", [...OPEN_LOG_STATUSES]);

  return (data ?? []).filter((row) =>
    logNeedsAttention({ status: row.status ?? "planned", performedAt: row.performed_at }, today),
  ).length;
}

/**
 * Un seul chargement pour tous les points rouges de l'application : la navigation (qui le lit à
 * chaque écran) et le tableau de bord. Deux lectures étroites plutôt que `boat_dashboard_stats`,
 * dont les sous-requêtes (dépenses sur douze mois, sorties de l'eau, stock) ne servent à rien
 * ici — et dont les compteurs d'interventions ouvertes ne savent pas dire ce qui est daté
 * d'aujourd'hui.
 */
export async function loadBoatAttention(
  supabase: Client,
  boatId: string,
  today: string = todayString(),
): Promise<BoatAttention> {
  const [items, logs] = await Promise.all([
    loadItemAttention(supabase, boatId),
    loadLogAttention(supabase, boatId, today),
  ]);
  return { ...items, logs };
}
