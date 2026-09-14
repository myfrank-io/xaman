import { notFound } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchField } from "@/components/search/SearchField";
import { SearchResults } from "@/components/search/SearchResults";
import { readBoatRole } from "@/lib/queries/boat-context";
import { isSearchable, loadSearch } from "@/lib/queries/search";
import { createClient } from "@/lib/supabase/server";

/**
 * Huit lignes par famille : de quoi reconnaître la bonne sans faire défiler, et de quoi dire
 * « c'est là » plutôt que « voilà tout ce qui contient ce mot ». Sept familles pleines tiennent
 * alors en une page qu'on parcourt d'un coup d'œil.
 */
const PER_FAMILY = 8;

/**
 * Chercher dans le carnet (E18-4, D134).
 *
 * « C'était quand, la dernière courroie ? Combien ? Quelle référence ? » est la première raison
 * d'ouvrir un carnet d'entretien, et jusqu'ici la seule recherche vivait **dans** le Journal, sur
 * le titre et les notes d'une intervention. Poser la question supposait donc de savoir déjà dans
 * quel écran dormait la réponse — un achat, un équipement, une pièce, un intervenant.
 *
 * Une question, sept familles, et la RLS qui décide de chaque ligne.
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

  const groups = await loadSearch(supabase, boatId, query, PER_FAMILY);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <SearchField boatId={boatId} initialQuery={query} />
      {!isSearchable(query) ? (
        // « Continuez à taper » et « aucun résultat » ne disent pas la même chose à quelqu'un qui
        // vient d'appuyer sur une touche : sous deux caractères, la question n'a pas été posée.
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("prompt")}
          description={t("promptDescription")}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("empty", { query })}
          description={t("emptyDescription")}
          variant="filtered"
        />
      ) : (
        <SearchResults boatId={boatId} groups={groups} />
      )}
    </div>
  );
}
