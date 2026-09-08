import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { AttentionDot } from "@/components/common/AttentionDot";
import { boatPath, logsPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

/** The three views of the Journal (D9, E3-2). */
export type LogsTab = "history" | "planned" | "haulOuts";

/**
 * Tab strip of the Journal, shared by `/logs` and `/haul-outs`.
 *
 * « Sorties de l'eau » keeps a path of its own — the list is a screen, not a query string — but
 * it is the third tab of this section (D9), never a section on its own: it left the menu for
 * that reason. So the strip is the same object on the three screens. Leaving it out of
 * `/haul-outs` is what made that screen read as « I have left Interventions »: no way back to
 * the two other views, and nothing to say which one is open.
 */
export async function LogsTabs({
  boatId,
  active,
  attentionCount = 0,
}: {
  boatId: string;
  active: LogsTab;
  /** Interventions urgentes ou datées d'aujourd'hui ou d'avant : le point rouge de l'onglet (D81). */
  attentionCount?: number;
}) {
  const t = await getTranslations("logs.tabs");
  const tabs: { key: LogsTab; href: string }[] = [
    { key: "history", href: logsPath(boatId) },
    { key: "planned", href: logsPath(boatId, { tab: "planned" }) },
    { key: "haulOuts", href: boatPath(boatId, "haulOuts") },
  ];

  return (
    <div className="flex flex-wrap gap-2 border-b border-border">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          // Built from the boat id at runtime; typed routes only validate literals.
          href={tab.href as Route}
          aria-current={tab.key === active ? "page" : undefined}
          className={cn(
            "inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-label font-medium",
            tab.key === active ? "border-primary text-foreground" : "border-transparent text-ink-2",
          )}
        >
          {t(tab.key)}
          {/* Le point rouge de l'onglet Journal se rejoue sur la vue qui porte les lignes. */}
          {tab.key === "planned" ? <AttentionDot count={attentionCount} size="sm" /> : null}
        </Link>
      ))}
    </div>
  );
}
