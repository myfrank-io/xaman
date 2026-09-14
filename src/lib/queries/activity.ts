import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/** Les cinq faits que le carnet garde (D126) ; l'ordre est celui de la vue, jamais du client. */
export const ACTIVITY_KINDS = ["completion", "log", "purchase", "reading", "haul_out"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

/** Une ligne du fil, telle que l'écran la montre. */
export type ActivityRow = {
  kind: ActivityKind;
  id: string;
  /** Le jour où c'est arrivé — pas celui où c'est entré dans le carnet. */
  happenedAt: string;
  title: string;
  /** Qui l'a fait : l'intervenant s'il y en a un, sinon la personne qui l'a noté. */
  who: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  /** Ce que ça a coûté, quand la ligne porte un montant. */
  amount: number | null;
  /** Les heures moteur, quand la ligne en porte. */
  hours: number | null;
};

type ViewRow = Pick<
  Database["public"]["Views"]["boat_activity"]["Row"],
  | "kind"
  | "id"
  | "happened_at"
  | "title"
  | "who"
  | "category_name"
  | "category_color"
  | "amount"
  | "hours"
>;

/**
 * Une ligne de la vue, rendue sûre pour l'écran.
 *
 * Pure, donc testable sans base : c'est la seule couche entre une union SQL de cinq tables et une
 * liste, et c'est elle qui décide qu'une ligne sans titre n'est pas affichable plutôt que de
 * laisser passer une ligne vide.
 */
export function toActivityRow(row: ViewRow): ActivityRow | null {
  const kind = (ACTIVITY_KINDS as readonly string[]).includes(row.kind ?? "")
    ? (row.kind as ActivityKind)
    : null;
  const title = (row.title ?? "").trim();
  if (!kind || !row.id || !row.happened_at || title === "") return null;
  const who = (row.who ?? "").trim();
  return {
    kind,
    id: row.id,
    happenedAt: row.happened_at,
    title,
    who: who === "" ? null : who,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    amount: row.amount,
    hours: row.hours,
  };
}

/**
 * Ce qui a bougé sur le carnet, le plus récent d'abord.
 *
 * `recorded_at` départage deux faits du même jour : une vidange notée après le cochage qu'elle a
 * produit se lit dans cet ordre-là, et non dans l'ordre où la base a bien voulu les rendre.
 */
export async function loadActivity(
  supabase: SupabaseClient<Database>,
  boatId: string,
  limit: number,
): Promise<ActivityRow[]> {
  const { data } = await supabase
    .from("boat_activity")
    .select("kind, id, happened_at, title, who, category_name, category_color, amount, hours")
    .eq("boat_id", boatId)
    .order("happened_at", { ascending: false })
    .order("recorded_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(toActivityRow).filter((row): row is ActivityRow => row !== null);
}
