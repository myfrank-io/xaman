import { cache } from "react";

import type { BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export type BoatRow = Database["public"]["Tables"]["boats"]["Row"];

/**
 * Le bateau et le rôle, une seule fois par requête.
 *
 * Le layout de `[boatId]` lisait déjà les deux ; trente-neuf pages sur quarante et une
 * relançaient `boat_role` juste après, sept relisaient la ligne `boats`. Sur un chargement
 * complet — démarrage de la PWA, rechargement, lien partagé — c'étaient deux allers-retours
 * pour la même réponse, en tête de la première vague, donc devant tout le reste.
 *
 * `cache()` de React déduplique par requête serveur : le premier appelant lit, les suivants
 * attendent la même promesse. Le layout et la page peuvent donc demander chacun ce dont ils
 * ont besoin sans se concerter, et une navigation ne pose la question qu'une fois.
 *
 * Les deux fonctions gardent la **forme d'un résultat supabase** (`{ data }`) : les pages les
 * lisent depuis le `Promise.all` de leur première vague, en déstructurant `{ data: role }`.
 * La bascule est ainsi un remplacement d'appel, pas une réécriture de chaque page — et une
 * relecture voit tout de suite que rien d'autre n'a bougé.
 */
export const readBoatRole = cache(async (boatId: string): Promise<{ data: BoatRole | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  return { data: (data as BoatRole | null) ?? null };
});

/**
 * La ligne complète du bateau. `select("*")` est voulu : `BoatProvider` et le formulaire
 * d'identité sont typés sur `boats.Row`, et c'est **la même** lecture que le layout fait de
 * toute façon — nommer moins de colonnes ici ajouterait une seconde lecture au lieu d'en
 * économiser une. Les écrans qui n'avaient besoin que du nom ou d'une colonne y puisent
 * maintenant sans lire quoi que ce soit de plus.
 */
export const readBoatRow = cache(async (boatId: string): Promise<{ data: BoatRow | null }> => {
  const supabase = await createClient();
  const { data } = await supabase.from("boats").select("*").eq("id", boatId).maybeSingle();
  return { data };
});
