import { getTranslations } from "next-intl/server";

import { PageHeader } from "@/components/common/PageHeader";
import { HaulOutDetail, type HaulOutLog } from "@/components/haul-outs/HaulOutDetail";
import { HaulOutForm } from "@/components/haul-outs/HaulOutForm";
import { HaulOutsList, type HaulOutListItem } from "@/components/haul-outs/HaulOutsList";
import { daysAshore } from "@/lib/haul-outs";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import { SAMPLE_CONTACTS } from "../supplies/sample";
import { SAMPLE_CATEGORIES } from "../sample-data";

const [ENGINES, , SAILS, HULL] = SAMPLE_CATEGORIES;

const HAUL_OUTS: HaulOutListItem[] = [
  {
    id: "h1",
    startedAt: "2026-08-24",
    endedAt: null,
    yard: "Chantier Naval de Hyères",
    cost: 1850,
    logsCount: 3,
    daysAshore: daysAshore("2026-08-24", null),
  },
  {
    id: "h2",
    startedAt: "2024-12-02",
    endedAt: "2024-12-20",
    yard: "Chantier Naval de Hyères",
    cost: 2140,
    logsCount: 5,
    daysAshore: daysAshore("2024-12-02", "2024-12-20"),
  },
  {
    id: "h3",
    startedAt: "2023-06-14",
    endedAt: "2023-06-28",
    yard: null,
    cost: null,
    logsCount: 0,
    daysAshore: daysAshore("2023-06-14", "2023-06-28"),
  },
];

const LOGS: HaulOutLog[] = [
  {
    id: "l1",
    title: "Changement des anodes",
    performedAt: "2026-08-26",
    cost: 120,
    categoryName: HULL.name,
    categoryColor: HULL.color,
  },
  {
    id: "l2",
    title: "Contrôle et graissage des vannes",
    performedAt: "2026-08-27",
    cost: null,
    categoryName: ENGINES.name,
    categoryColor: ENGINES.color,
  },
  {
    id: "l3",
    title: "Polissage Copper Coat",
    performedAt: "2026-08-30",
    cost: 450,
    categoryName: SAILS.name,
    categoryColor: SAILS.color,
  },
];

/** Visual acceptance of the haul-outs module (E6-1): list, sheet and form on one page. */
export default async function DevHaulOutsPage() {
  const t = await getTranslations("haulOuts");
  return (
    <DevShell>
      <div className="flex flex-col gap-10">
        <div className="flex flex-col gap-6">
          <PageHeader title={t("title")} subtitle={t("count", { count: HAUL_OUTS.length })} />
          <HaulOutsList boatId={DEV_BOAT_ID} haulOuts={HAUL_OUTS} canWrite />
        </div>

        <div className="border-t border-border pt-8">
          <HaulOutDetail
            boatId={DEV_BOAT_ID}
            haulOut={{
              id: "h1",
              startedAt: "2026-08-24",
              endedAt: null,
              yard: "Chantier Naval de Hyères",
              works:
                "Polissage Copper Coat, retouches Nautix A88M, contrôle des passe-coques, changement des anodes, contrôle des safrans.",
              cost: 1850,
              daysAshore: daysAshore("2026-08-24", null),
            }}
            logs={LOGS}
            canWrite
          />
        </div>

        <div className="border-t border-border pt-8">
          <HaulOutForm boatId={DEV_BOAT_ID} haulOut={null} contacts={SAMPLE_CONTACTS} />
        </div>
      </div>
    </DevShell>
  );
}
