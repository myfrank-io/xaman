"use client";

import type * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";

import type { ChecklistRow } from "@/components/checklist/rows";
import { isDueToday } from "@/components/checklist/rows";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { DueLabel } from "@/components/common/DueLabel";
import { StatusBadge } from "@/components/common/StatusBadge";
import type { UpcomingEntry } from "@/components/dashboard/UpcomingList";
import { LogDueLabel } from "@/components/logs/LogDueLabel";
import { Button } from "@/components/ui/button";
import { categoryPath, logPath } from "@/lib/queries/boat-routes";

/** Le cadre : un intitulé, le titre cliquable, la raison de l'échéance, un seul geste. */
function Shell({
  overline,
  title,
  href,
  reason,
  action,
}: {
  overline: string;
  title: string;
  href: string;
  reason: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border-strong bg-surface p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-overline text-ink-2 uppercase">{overline}</p>
        <Link
          href={href as Route}
          className="mt-1 flex min-h-11 items-center rounded-lg tap-feedback text-h2 [overflow-wrap:anywhere] focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-ink-2">
          {reason}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/**
 * La première ligne de la file, sortie de la liste (D20 revu).
 *
 * Le tableau de bord offrait quatre portes vers la même liste (deux vignettes, la file, deux
 * liens de pied) avant de proposer un seul geste. Ce bloc nomme le geste : le point, *pourquoi*
 * il tombe (« 12 j de retard », « échéance estimée ») et son « Fait ». Ce n'est pas une copie
 * de la première ligne, c'est la première ligne — la liste dessous commence à la deuxième.
 */
export function NextActionCard({
  boatId,
  entry,
  today,
  canContribute,
  onDone,
}: {
  boatId: string;
  entry: UpcomingEntry;
  today: string;
  canContribute: boolean;
  onDone?: (row: ChecklistRow) => void;
}) {
  const t = useTranslations("dashboard");

  if (entry.kind === "item") {
    const row: ChecklistRow = entry.row;
    return (
      <Shell
        overline={t("next.title")}
        title={row.label}
        href={categoryPath(boatId, row.categoryId)}
        reason={
          <>
            <ChecklistStateBadge state={row.status} dueToday={isDueToday(row)} />
            <DueLabel
              status={row.status}
              daysRemaining={row.daysRemaining}
              hoursRemaining={row.hoursRemaining}
              hasCounter={row.engineId === null || row.currentHours !== null}
            />
            <CategoryDot color={row.categoryColor} />
            <span className="truncate">{row.categoryName}</span>
            {/* D1 / D2 : une échéance encore assise sur le calage grossier de la mise en route
                n'a pas la valeur d'une échéance née d'un cochage. Elle le dit, sans crier. */}
            {row.hasCompletion ? null : <span>{t("next.estimated")}</span>}
          </>
        }
        action={
          canContribute && onDone ? (
            <Button
              type="button"
              size="xl"
              className="w-full sm:w-auto"
              onClick={() => onDone(row)}
            >
              {t("markDone")}
            </Button>
          ) : (
            <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
              <Link href={categoryPath(boatId, row.categoryId) as Route}>{t("next.open")}</Link>
            </Button>
          )
        }
      />
    );
  }

  return (
    <Shell
      overline={t("next.title")}
      title={entry.title}
      href={logPath(boatId, entry.id)}
      reason={
        <>
          <StatusBadge status={entry.status} size="sm" />
          <LogDueLabel status={entry.status} performedAt={entry.dueAt} today={today} />
          <CategoryDot color={entry.categoryColor} />
          <span className="truncate">{entry.categoryName}</span>
        </>
      }
      action={
        <Button asChild size="xl" variant="outline" className="w-full sm:w-auto">
          <Link href={logPath(boatId, entry.id) as Route}>{t("next.open")}</Link>
        </Button>
      }
    />
  );
}
