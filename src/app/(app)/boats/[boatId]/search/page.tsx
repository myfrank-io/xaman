import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { SearchScreen } from "@/components/search/SearchScreen";
import { readBoatRole } from "@/lib/queries/boat-context";
import { loadSearch, type SearchGroup } from "@/lib/queries/search";
import { createClient } from "@/lib/supabase/server";

/**
 * Huit lignes par famille : de quoi reconnaître la bonne sans faire défiler, et de quoi dire
 * « c'est là » plutôt que « voilà tout ce qui contient ce mot ». Sept familles pleines tiennent
 * alors en une page qu'on parcourt d'un coup d'œil.
 */
const PER_FAMILY = 8;

/**
 * Chercher dans le carnet (E18-4, D134, E18-14).
 *
 * « C'était quand, la dernière courroie ? Combien ? Quelle référence ? » est la première raison
 * d'ouvrir un carnet d'entretien, et jusqu'ici la seule recherche vivait **dans** le Journal, sur
 * le titre et les notes d'une intervention. Poser la question supposait donc de savoir déjà dans
 * quel écran dormait la réponse — un achat, un équipement, une pièce, un intervenant.
 *
 * Une question, sept familles, et la RLS qui décide de chaque ligne.
 *
 * Le serveur ne rend plus que la **première** réponse, celle d'un lien partagé ou d'un favori ;
 * la frappe est ensuite affaire du client (`SearchScreen`), qui interroge la base directement au
 * lieu de redemander la page à chaque lettre.
 */
export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ boatId }, { q }] = await Promise.all([params, searchParams]);
  const query = (q ?? "").trim();

  const supabase = await createClient();
  const [{ data: role }, t] = await Promise.all([readBoatRole(boatId), getTranslations("search")]);
  if (!role) notFound();

  /**
   * `null` et non `[]` quand la base n'a pas pu répondre.
   *
   * Les deux se ressemblent et ne disent pas la même chose : `[]` est une réponse (« rien dans ce
   * carnet »), `null` est une absence de réponse. Semer le cache du client avec `[]` lui ferait
   * afficher « aucun résultat » pour une panne, ce qui est très exactement le défaut que ce
   * ticket répare ailleurs. `null` le laisse redemander, et dire ce qui ne va pas s'il échoue
   * aussi.
   */
  let initialGroups: SearchGroup[] | null = null;
  try {
    initialGroups = await loadSearch(supabase, boatId, query, PER_FAMILY);
  } catch {
    initialGroups = null;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SearchScreen
        boatId={boatId}
        initialQuery={query}
        initialGroups={initialGroups}
        perFamily={PER_FAMILY}
      />
    </div>
  );
}
