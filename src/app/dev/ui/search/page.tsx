import { notFound } from "next/navigation";
import { SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { SearchField } from "@/components/search/SearchField";
import { SearchResults } from "@/components/search/SearchResults";
import { groupSearchHits, type SearchHit } from "@/lib/queries/search";

import { DevShell, DEV_BOAT_ID } from "../DevShell";
import { devUiEnabled } from "@/lib/dev-ui";

const DEV_CATEGORY_ID = "00000000-0000-4000-8000-0000000000ca";

/**
 * Une réponse à « courroie », sur les sept familles (E18-4, D134).
 *
 * Les sept sont remplies exprès : c'est la page la plus haute de l'app, et l'audit tactile doit
 * la mesurer pleine — sur un iPhone SE, sept sections et leurs lignes sont ce qui dira si les
 * cibles tiennent encore 44 px et si un montant et une date se partagent la colonne de droite
 * sans écraser le titre.
 */
const HITS: SearchHit[] = [
  {
    kind: "log",
    id: "l1",
    title: "Changement de la courroie d'alternateur",
    subtitle: null,
    happenedAt: "2025-06-12",
    amount: 148.5,
    parentId: DEV_CATEGORY_ID,
  },
  {
    kind: "log",
    id: "l2",
    title: "Contrôle de la tension de courroie",
    subtitle: null,
    happenedAt: "2024-09-02",
    amount: null,
    parentId: DEV_CATEGORY_ID,
  },
  {
    kind: "item",
    id: "i1",
    title: "Courroie d'alternateur — contrôle visuel",
    subtitle: null,
    happenedAt: null,
    amount: null,
    parentId: DEV_CATEGORY_ID,
  },
  {
    kind: "purchase",
    id: "p1",
    title: "Courroie Yanmar 129470-42280",
    subtitle: "Chantier Naval de Hyères",
    happenedAt: "2025-06-10",
    amount: 62.9,
    parentId: DEV_CATEGORY_ID,
  },
  {
    kind: "equipment",
    id: "e1",
    title: "Moteur bâbord",
    subtitle: "Yanmar 4JH57",
    happenedAt: null,
    amount: null,
    parentId: DEV_CATEGORY_ID,
  },
  {
    kind: "part",
    id: "pa1",
    title: "Courroie d'alternateur",
    subtitle: "129470-42280",
    happenedAt: null,
    amount: null,
    parentId: null,
  },
  {
    kind: "contact",
    id: "c1",
    title: "Paul Martin",
    subtitle: "Yanmar Service Motoriste",
    happenedAt: null,
    amount: null,
    parentId: null,
  },
  {
    kind: "document",
    id: "d1",
    title: "Facture 2025-118 — courroies et filtres",
    subtitle: "Chantier Naval de Hyères",
    happenedAt: "2025-06-11",
    amount: null,
    parentId: null,
  },
];

export default async function DevSearchPage() {
  if (!devUiEnabled()) notFound();
  const t = await getTranslations("search");

  return (
    <DevShell>
      <div className="flex flex-col gap-6">
        <PageHeader title={t("title")} subtitle={t("subtitle")} />
        <SearchField boatId={DEV_BOAT_ID} initialQuery="courroie" />
        <SearchResults boatId={DEV_BOAT_ID} groups={groupSearchHits(HITS)} />

        {/* Les deux silences de l'écran, côte à côte : ils ne disent pas la même chose. */}
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("prompt")}
          description={t("promptDescription")}
        />
        <EmptyState
          icon={<SearchIcon aria-hidden />}
          title={t("empty", { query: "courroies en titane" })}
          description={t("emptyDescription")}
          variant="filtered"
        />
      </div>
    </DevShell>
  );
}
