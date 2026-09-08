"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CheckIcon, ClipboardListIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { checklistPath, hourReadingPath, logsPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

const DISMISS_KEY = (boatId: string) => `xaman.dashboard.start.${boatId}`;

export type StartSteps = { hours: boolean; review: boolean; checklist: boolean };

/**
 * « Carnet neuf » (ux-flows §2.7): the state of day one, designed rather than endured.
 * Three steps, each struck through once done; the block disappears when all three are
 * done or when it is explicitly hidden (per device).
 */
export function BrandNewBlock({
  boatId,
  count,
  reviewCount,
  steps,
  hasCounters,
  canContribute,
}: {
  boatId: string;
  count: number;
  reviewCount: number;
  steps: StartSteps;
  /** false when no engine of the boat has an hour meter (D73): nothing to read. */
  hasCounters: boolean;
  canContribute: boolean;
}) {
  const t = useTranslations("dashboard.upcoming");
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    function read() {
      try {
        setHidden(localStorage.getItem(DISMISS_KEY(boatId)) === "1");
      } catch {
        // storage unavailable (private mode): the block simply stays
      }
    }
    read();
  }, [boatId]);

  if (steps.hours && steps.review && steps.checklist) return null;
  if (hidden) {
    return (
      <p className="text-caption text-ink-2">
        {t("startHidden", { count })}
        {" · "}
        <Link href={checklistPath(boatId) as Route} className="font-medium text-primary">
          {t("startStep3Action")}
        </Link>
      </p>
    );
  }

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY(boatId), "1");
    } catch {
      // ignore
    }
    setHidden(true);
  }

  type Row = { key: keyof StartSteps; label: string; action: string; href: string };
  const allRows: Row[] = [
    {
      key: "hours",
      label: t("startStep1"),
      action: t("startStep1Action"),
      href: hourReadingPath(boatId),
    },
    {
      key: "review",
      label: t("startStep2", { count: reviewCount }),
      action: t("startStep2Action"),
      href: logsPath(boatId, { review: 1 }),
    },
    {
      key: "checklist",
      label: t("startStep3"),
      action: t("startStep3Action"),
      href: checklistPath(boatId),
    },
  ];
  // The review row only exists when there is something to review: on a boat that never imported
  // anything, « Vérifier les 0 lignes importées du carnet papier », struck through, is a step
  // about a paper logbook that never existed. Same for the hours: a boat whose engines have no
  // meter — a dinghy outboard alone, say (D73) — has no counter to read.
  const rows = allRows.filter(
    (row) => (row.key !== "review" || reviewCount > 0) && (row.key !== "hours" || hasCounters),
  );

  return (
    // `EmptyState` draws the frame, the icon disc and the heading: a carnet on its first day is
    // an empty state that offers its three ways out. `h3` — the dashboard's own `h2` is above it.
    // The intro keeps its `max-w-md`: it is longer than the single line an empty state states.
    <EmptyState
      className="py-8"
      icon={<ClipboardListIcon aria-hidden />}
      titleAs="h3"
      title={t("startTitle", { count })}
      action={
        <Button type="button" variant="ghost" size="sm" onClick={dismiss}>
          {t("startDismiss")}
        </Button>
      }
    >
      <p className="mt-2 max-w-md text-body text-ink-2">{t("startIntro")}</p>
      <ol className="mt-5 flex w-full max-w-xl flex-col gap-2 text-left">
        {rows.map((row, index) => {
          const done = steps[row.key];
          return (
            <li
              key={row.key}
              className="flex min-h-12 flex-col items-start gap-2 rounded-lg border border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:gap-3 sm:py-2"
            >
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-label font-semibold",
                  done ? "bg-state-ok-fg text-white" : "bg-n-100 text-ink-2",
                )}
              >
                {done ? <CheckIcon className="size-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 text-body [overflow-wrap:anywhere]",
                  done && "text-ink-3 line-through",
                )}
              >
                {row.label}
              </span>
              {!done && (canContribute || row.key === "checklist") ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={row.href as Route}>{row.action}</Link>
                </Button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </EmptyState>
  );
}
