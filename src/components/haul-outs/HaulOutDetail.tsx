import Link from "next/link";
import type { Route } from "next";
import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { TrashHaulOutButton } from "@/components/haul-outs/TrashHaulOutButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { editHaulOutPath, logPath, newLogPath } from "@/lib/queries/boat-routes";

export type HaulOutLog = {
  id: string;
  title: string;
  performedAt: string;
  cost: number | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export type HaulOutDetailValues = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  yard: string | null;
  works: string | null;
  cost: number | null;
  daysAshore: number;
};

/**
 * Haul-out sheet (E6-1, flow g): the dashboard of a refit. A haul-out is a time container —
 * interventions are attached from here, never the other way round in daily use — and the
 * total cost (yard + interventions) is the figure wanted at resale.
 */
export async function HaulOutDetail({
  boatId,
  haulOut,
  logs,
  canWrite,
}: {
  boatId: string;
  haulOut: HaulOutDetailValues;
  logs: HaulOutLog[];
  canWrite: boolean;
}) {
  const [t, tc] = await Promise.all([getTranslations("haulOuts"), getTranslations("common")]);
  const logsTotal = logs.reduce((sum, log) => sum + (log.cost ?? 0), 0);
  const total = (haulOut.cost ?? 0) + logsTotal;
  const ashore = haulOut.endedAt === null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={haulOut.yard ?? t("noYard")}
        subtitle={t("dates", {
          start: formatDate(haulOut.startedAt),
          end: haulOut.endedAt ? formatDate(haulOut.endedAt) : "—",
        })}
        actions={
          canWrite ? (
            <Button asChild variant="outline">
              <Link href={editHaulOutPath(boatId, haulOut.id) as Route}>{tc("edit")}</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        {ashore ? (
          // Solid = an ongoing state, like « En cours » — never the red of an alarm.
          <Badge
            size="md"
            variant="outline"
            className="border-transparent bg-status-in-progress-fg text-white dark:text-navy"
          >
            {t("ashoreSince", { days: haulOut.daysAshore })}
          </Badge>
        ) : (
          <Badge size="md" variant="outline">
            {t("duration", { days: haulOut.daysAshore })}
          </Badge>
        )}
        <span className="num text-body text-ink-2">
          {t("fields.cost")} : {formatCurrency(haulOut.cost)}
        </span>
      </div>

      <SectionCard title={t("fields.works")} bare={!haulOut.works}>
        {haulOut.works ? (
          <p className="px-4 py-3 text-body whitespace-pre-line">{haulOut.works}</p>
        ) : (
          <p className="text-body text-ink-2">{t("noWorks")}</p>
        )}
      </SectionCard>

      <SectionCard
        title={`${t("logs.title")} · ${t("logs.count", { count: logs.length })}`}
        action={
          canWrite ? (
            <Button asChild variant="outline">
              <Link href={newLogPath(boatId, { haulOut: haulOut.id }) as Route}>
                <PlusIcon />
                {t("logs.add")}
              </Link>
            </Button>
          ) : undefined
        }
        bare={logs.length === 0}
      >
        {logs.length === 0 ? (
          <p className="text-body text-ink-2">{t("logs.empty")}</p>
        ) : (
          logs.map((log) => (
            <ListRow
              key={log.id}
              categoryColor={log.categoryColor ?? undefined}
              lead={
                <span className="w-20 shrink-0 num text-caption text-ink-2">
                  {formatDate(log.performedAt)}
                </span>
              }
              title={log.title}
              meta={
                log.categoryName ? (
                  <>
                    <CategoryDot color={log.categoryColor ?? "#8A99AC"} />
                    <span className="truncate">{log.categoryName}</span>
                  </>
                ) : undefined
              }
              trailing={
                <span className="num text-caption text-ink-2">{formatCurrency(log.cost)}</span>
              }
              href={logPath(boatId, log.id)}
            />
          ))
        )}
      </SectionCard>

      <SectionCard title={t("totals.title")} bare>
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body text-ink-2">{t("totals.yard")}</span>
            <span className="num text-num-sm">{formatCurrency(haulOut.cost)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-body text-ink-2">{t("totals.logs")}</span>
            <span className="num text-num-sm">{formatCurrency(logsTotal)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
            <span className="text-body font-semibold">{t("totals.total")}</span>
            <span className="num text-num-md font-semibold">{formatCurrency(total)}</span>
          </div>
        </div>
      </SectionCard>

      {canWrite ? (
        <div className="flex justify-end">
          <TrashHaulOutButton boatId={boatId} haulOutId={haulOut.id} />
        </div>
      ) : null}
    </div>
  );
}
