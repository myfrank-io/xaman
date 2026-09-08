import type { SupabaseClient } from "@supabase/supabase-js";

import {
  isDueToday,
  isNewlyOverdue,
  itemNeedsAttention,
  logNeedsAttention,
  OPEN_LOG_STATUSES,
} from "@/lib/attention";
import { todayString } from "@/lib/format";
import type { Database } from "@/types/database";

/** Ce qui est à faire aujourd'hui sur un bateau, tel que les points rouges le racontent (D88). */
export type BoatAttention = {
  /** Points de checklist en retard ou dus dans la journée. */
  items: number;
  /** Interventions urgentes, ou ouvertes et datées d'aujourd'hui ou d'avant. */
  logs: number;
  /**
   * Points passés en retard dans les sept derniers jours : ce que la phrase d'état appelle
   * « nouveau ». Zéro se dit « rien de nouveau en retard » — la seule bonne nouvelle qu'un
   * état sait donner sans mentir.
   */
  newlyOverdue: number;
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
): Promise<Pick<BoatAttention, "items" | "newlyOverdue" | "dueTodayByCategory">> {
  const { data } = await supabase
    .from("checklist_item_status")
    .select("category_id, status, days_remaining")
    .eq("boat_id", boatId)
    .in("status", ["overdue", "soon"]);

  const dueTodayByCategory = new Map<string, number>();
  let items = 0;
  let newlyOverdue = 0;
  for (const row of data ?? []) {
    const item = { status: row.status, daysRemaining: row.days_remaining };
    if (isNewlyOverdue(item)) newlyOverdue += 1;
    if (!itemNeedsAttention(item)) continue;
    items += 1;
    if (!isDueToday(item)) continue;
    const key = row.category_id ?? "";
    dueTodayByCategory.set(key, (dueTodayByCategory.get(key) ?? 0) + 1);
  }
  return { items, newlyOverdue, dueTodayByCategory };
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

/* ------------------------------------------------------------------------------------------ */
/* Ce qui a bougé cette semaine (phrase d'état + 4ᵉ vignette du tableau de bord)                */
/* ------------------------------------------------------------------------------------------ */

/**
 * Ce qui a été *réglé* sur les sept derniers jours : des cochages et des interventions
 * terminées, et les personnes qui les ont notés.
 *
 * C'est la définition d'activité que l'audit s'est déjà donnée (AUDIT §6, « événements de suivi
 * saisis par semaine : cochages + interventions + relevés ») ; les relevés d'heures en sont
 * absents parce que la bande des moteurs les dit déjà, à la ligne au-dessus.
 */
export type WeekActivity = {
  /** Cochages de points de checklist. */
  completions: number;
  /** Interventions terminées, datées dans la fenêtre. */
  logs: number;
  /** Total affiché par la vignette : un acte noté = un événement. */
  total: number;
  /** Les personnes nommées, sans doublon, la plus active d'abord. */
  people: string[];
};

/** Une ligne d'activité telle que les deux lectures la produisent : un nom, ou rien. */
export type ActivityName = string | null | undefined;

const EMPTY_WEEK: WeekActivity = { completions: 0, logs: 0, total: 0, people: [] };

/**
 * Assemble les deux lectures. Pur, pour que la règle (dédoublonnage, ordre, total) se teste
 * sans base : c'est elle qui décide si la phrase nomme une personne ou deux.
 */
export function summariseWeek(input: {
  completions: number;
  logs: number;
  names: ActivityName[];
}): WeekActivity {
  const counts = new Map<string, number>();
  for (const raw of input.names) {
    const name = (raw ?? "").trim();
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const people = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "fr"))
    .map(([name]) => name);
  return {
    completions: input.completions,
    logs: input.logs,
    total: input.completions + input.logs,
    people,
  };
}

/**
 * Combien de noms la phrase porte, et combien elle laisse de côté. Deux noms tiennent dans
 * l'en-tête ; au-delà la phrase dit « et N autres » plutôt que de dérouler l'équipage.
 */
export function pickNames(people: readonly string[], max = 2): { shown: string[]; extra: number } {
  // Une seule personne n'a pas à être nommée : c'est celle qui lit l'écran, neuf fois sur dix.
  if (people.length < 2) return { shown: [], extra: 0 };
  return { shown: people.slice(0, max), extra: Math.max(people.length - max, 0) };
}

/** Combien de lignes on rapatrie pour en tirer des noms : la phrase n'en cite jamais plus de trois. */
const NAME_SAMPLE = 50;

/**
 * Les deux lectures de la semaine. Les comptes viennent de `count: "exact"` (donc justes même
 * au-delà de l'échantillon), les noms des lignes rapatriées.
 */
export async function loadWeekActivity(
  supabase: Client,
  boatId: string,
  since: string,
): Promise<WeekActivity> {
  const [completions, logs] = await Promise.all([
    supabase
      .from("checklist_completions")
      .select("completed_by_name", { count: "exact" })
      .eq("boat_id", boatId)
      .gte("completed_at", since)
      .order("completed_at", { ascending: false })
      .limit(NAME_SAMPLE),
    supabase
      .from("maintenance_logs_view")
      .select("created_by_name", { count: "exact" })
      .eq("boat_id", boatId)
      .eq("status", "done")
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .limit(NAME_SAMPLE),
  ]);
  if (completions.error && logs.error) return EMPTY_WEEK;
  return summariseWeek({
    completions: completions.count ?? completions.data?.length ?? 0,
    logs: logs.count ?? logs.data?.length ?? 0,
    names: [
      ...(completions.data ?? []).map((row) => row.completed_by_name),
      ...(logs.data ?? []).map((row) => row.created_by_name),
    ],
  });
}
