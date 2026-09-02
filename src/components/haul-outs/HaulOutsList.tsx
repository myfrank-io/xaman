import Link from "next/link";
import type { Route } from "next";
import { AnchorIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { haulOutPath, newHaulOutPath } from "@/lib/queries/boat-routes";

/** Same fill as « En cours » (art-direction §3.6): solid marks a live state. */
const ASHORE_BADGE = "border-transparent bg-status-in-progress-fg text-white dark:text-navy";

export type HaulOutListItem = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  yard: string | null;
  cost: number | null;
  logsCount: number;
  daysAshore: number;
};

/**
 * Haul-outs list (E6-1), most recent first. « À terre » is the state that matters at a
 * glance: it is the only reason to open the screen while the boat is on the hard.
 */
export async function HaulOutsList({
  boatId,
  haulOuts,
  canWrite,
}: {
  boatId: string;
  haulOuts: HaulOutListItem[];
  canWrite: boolean;
}) {
  const t = await getTranslations("haulOuts");

  if (haulOuts.length === 0) {
    return (
      <EmptyState
        icon={<AnchorIcon aria-hidden />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          canWrite ? (
            <Button asChild>
              <Link href={newHaulOutPath(boatId) as Route}>{t("new")}</Link>
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {haulOuts.map((haulOut) => (
        <ListRow
          key={haulOut.id}
          size="lg"
          lead={
            haulOut.endedAt === null ? (
              // Solid = an ongoing state, like « En cours » — never the red of an alarm.
              <Badge size="md" variant="outline" className={ASHORE_BADGE}>
                {t("ashore")}
              </Badge>
            ) : (
              <span className="num text-caption text-ink-2">
                {t("duration", { days: haulOut.daysAshore })}
              </span>
            )
          }
          title={haulOut.yard ?? t("noYard")}
          meta={
            <>
              <span className="truncate num">
                {t("dates", {
                  start: formatDate(haulOut.startedAt),
                  end: haulOut.endedAt ? formatDate(haulOut.endedAt) : "—",
                })}
              </span>
              <span aria-hidden>·</span>
              <span className="shrink-0">{t("logs.count", { count: haulOut.logsCount })}</span>
            </>
          }
          trailing={
            <span className="num text-num-sm font-medium">{formatCurrency(haulOut.cost)}</span>
          }
          href={haulOutPath(boatId, haulOut.id)}
        />
      ))}
    </div>
  );
}
