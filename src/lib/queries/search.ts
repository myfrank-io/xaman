import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

/**
 * Les sept familles du carnet (E18-4, D134).
 *
 * L'ordre est celui de la page de résultats, et il n'est pas alphabétique : il descend de ce
 * qu'on a fait vers ce qui le porte. On cherche « courroie » pour savoir *quand* on l'a changée
 * (intervention), *quand il faudra* la changer (point), *combien* elle coûte (achat) — le reste
 * répond ensuite.
 */
export const SEARCH_KINDS = [
  "log",
  "item",
  "purchase",
  "equipment",
  "part",
  "contact",
  "document",
] as const;
export type SearchKind = (typeof SEARCH_KINDS)[number];

/** Une ligne de résultat, telle que l'écran la montre. */
export type SearchHit = {
  kind: SearchKind;
  id: string;
  title: string;
  /** Ce qui distingue deux lignes du même nom : une marque, une référence, un fournisseur. */
  subtitle: string | null;
  /** Le jour, quand la famille en a un. */
  happenedAt: string | null;
  /** Ce que ça a coûté, quand la ligne porte un montant. */
  amount: number | null;
  /** L'écran d'un point de checklist est sa catégorie : sans elle, on ne sait pas où l'ouvrir. */
  parentId: string | null;
};

/** Une famille et ses lignes — ce que la page affiche, dans l'ordre de `SEARCH_KINDS`. */
export type SearchGroup = { kind: SearchKind; hits: SearchHit[] };

type RpcRow = Database["public"]["Functions"]["search_boat"]["Returns"][number];

/**
 * La même ligne, avec ses nullités.
 *
 * `postgres-meta` type chaque colonne `returns table (…)` comme non-nulle — il n'a aucun moyen de
 * savoir qu'un point de checklist n'a ni date ni montant, ni qu'un intervenant n'a pas de
 * catégorie. Rester sur le type généré ferait croire au compilateur que `happened_at` est
 * toujours là et ferait sauter les gardes ci-dessous. On garde donc le lien avec le type généré —
 * renommer une colonne casse toujours la compilation — en lui rendant ses `null`.
 */
type SearchRow = { [K in keyof RpcRow]: RpcRow[K] | null };

/**
 * En deçà de deux caractères la fonction SQL ne répond rien ; l'écran doit le savoir **avant**
 * d'appeler, pour dire « continuez à taper » plutôt que « aucun résultat » — les deux phrases ne
 * veulent pas dire la même chose à quelqu'un qui vient d'appuyer sur une touche.
 */
export const MIN_QUERY_LENGTH = 2;

export function isSearchable(query: string): boolean {
  return query.trim().length >= MIN_QUERY_LENGTH;
}

/**
 * Une ligne de la fonction, rendue sûre pour l'écran.
 *
 * Pure, donc testable sans base. Un genre inconnu (une huitième famille ajoutée en SQL et pas
 * encore ici) est écarté plutôt qu'affiché sans nom ni destination : une ligne qu'on ne sait pas
 * ouvrir est pire qu'une ligne absente.
 */
export function toSearchHit(row: SearchRow): SearchHit | null {
  const kind = (SEARCH_KINDS as readonly string[]).includes(row.kind ?? "")
    ? (row.kind as SearchKind)
    : null;
  const title = (row.title ?? "").trim();
  if (!kind || !row.id || title === "") return null;
  const subtitle = (row.subtitle ?? "").trim();
  return {
    kind,
    id: row.id,
    title,
    subtitle: subtitle === "" ? null : subtitle,
    happenedAt: row.happened_at ?? null,
    amount: row.amount ?? null,
    parentId: row.parent_id ?? null,
  };
}

/**
 * Les lignes rangées par famille, dans l'ordre de `SEARCH_KINDS` et sans famille vide.
 *
 * Le tri **à l'intérieur** d'une famille est celui que SQL a rendu (la similarité du nom, puis la
 * date) : le regroupement ne réordonne rien, il ne fait que rassembler.
 */
export function groupSearchHits(hits: SearchHit[]): SearchGroup[] {
  return SEARCH_KINDS.map((kind) => ({
    kind,
    hits: hits.filter((hit) => hit.kind === kind),
  })).filter((group) => group.hits.length > 0);
}

/**
 * Chercher dans le carnet.
 *
 * Une seule question, sept familles, et la RLS qui décide de chaque ligne : la fonction est
 * `security invoker`, donc ce qui revient est exactement ce que l'appelant pourrait atteindre
 * écran par écran.
 */
export async function loadSearch(
  supabase: SupabaseClient<Database>,
  boatId: string,
  query: string,
  limit: number,
): Promise<SearchGroup[]> {
  if (!isSearchable(query)) return [];
  const { data } = await supabase.rpc("search_boat", {
    p_boat_id: boatId,
    p_query: query.trim(),
    p_limit: limit,
  });
  const hits = (data ?? []).map(toSearchHit).filter((hit): hit is SearchHit => hit !== null);
  return groupSearchHits(hits);
}
