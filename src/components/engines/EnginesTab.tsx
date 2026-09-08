"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { differenceInCalendarDays } from "date-fns";
import { ChevronRightIcon, GaugeIcon, TriangleAlertIcon } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { HourReadingDialog, type ReadingEngine } from "@/components/engines/HourReadingDialog";
import { engineKind } from "@/components/engines/engine-kind";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDate, formatHours, toDate } from "@/lib/format";
import { boatTabPath, enginePath, importPath, newEnginePath } from "@/lib/queries/boat-routes";
import type { EnginePosition, EnginePropulsion } from "@/lib/schemas/engines";
import { cn } from "@/lib/utils";

export type EngineSummary = {
  id: string;
  label: string;
  position: EnginePosition;
  propulsion: EnginePropulsion;
  brand: string | null;
  model: string | null;
  installedAt: string | null;
  isActive: boolean;
  tracksHours: boolean;
  hours: number | null;
  readAt: string | null;
  linkedItems: number;
};

// A counter older than this is flagged « à mettre à jour » (ux-flows §2.2).
const STALE_DAYS = 60;

/** Figure sizes, and the size of the phrase that stands in when there is no figure to show. */
const FIGURE_SIZE = {
  sm: "text-num-sm",
  md: "text-num-md sm:text-num-lg",
  lg: "text-display",
} as const;
const PHRASE_SIZE = { sm: "text-caption", md: "text-body-lg", lg: "text-body-lg" } as const;

type CounterSize = keyof typeof FIGURE_SIZE;

/**
 * The counter's figure — or the phrase that stands in for it. « Sans compteur d'heures » and
 * « compteur inconnu » are not figures and never take a figure's size: one says the meter does
 * not exist (D73), the other that nobody has read it yet.
 */
function EngineHours({
  hours,
  tracksHours = true,
  size = "md",
  className,
}: {
  hours: number | null;
  /** false: the engine has no hour meter (D73) — nothing to read, nothing to update. */
  tracksHours?: boolean;
  size?: CounterSize;
  className?: string;
}) {
  const t = useTranslations("engines");
  if (!tracksHours || hours === null) {
    return (
      <div className={cn("font-medium text-ink-3", PHRASE_SIZE[size], className)}>
        {tracksHours ? t("unknownCounter") : t("noCounter")}
      </div>
    );
  }
  return (
    <div className={cn("num font-semibold text-foreground", FIGURE_SIZE[size], className)}>
      {formatHours(hours)}
    </div>
  );
}

/** When the counter was read, and whether that reading has gone stale. */
function EngineReadDate({
  readAt,
  tracksHours = true,
  className,
}: {
  readAt: string | null;
  tracksHours?: boolean;
  className?: string;
}) {
  const t = useTranslations("engines");
  const date = toDate(readAt);
  const stale = date ? differenceInCalendarDays(new Date(), date) > STALE_DAYS : false;
  // An engine without a meter never turns amber for a reading that will never come (D73).
  if (!readAt || !tracksHours) return null;
  return (
    // « à mettre à jour » is a state, not the tail of a date: it gets the triangle and the amber,
    // the date keeps the neutral grey of a fact. Colour alone does not survive the sun, and
    // gluing the two behind a « · » made one long amber line nobody could scan.
    <div className={cn("flex flex-wrap items-center gap-x-1.5 text-caption text-ink-3", className)}>
      <span>{t("readOn", { date: formatDate(readAt) })}</span>
      {stale ? (
        <span className="inline-flex items-center gap-1 text-state-soon-fg">
          <TriangleAlertIcon className="size-3.5 shrink-0" aria-hidden />
          {t("stale")}
        </span>
      ) : null}
    </div>
  );
}

/** The figure and its date, stacked: the counter block of the engine sheet. */
export function EngineCounter({
  hours,
  readAt,
  tracksHours = true,
  size = "md",
}: {
  hours: number | null;
  readAt: string | null;
  tracksHours?: boolean;
  size?: "md" | "lg";
}) {
  return (
    <div>
      <EngineHours hours={hours} tracksHours={tracksHours} size={size} />
      <EngineReadDate readAt={readAt} tracksHours={tracksHours} />
    </div>
  );
}

function EngineCard({
  engine,
  href,
  onReading,
}: {
  engine: EngineSummary;
  href: string;
  onReading?: () => void;
}) {
  const t = useTranslations("engines");
  const tp = useTranslations("enginePosition");
  const tpr = useTranslations("enginePropulsion");
  const details = [engine.brand, engine.model].filter(Boolean).join(" ");
  // Only a figure rides the title line on a phone. « Sans compteur d'heures » is a sentence: put
  // it up there and it eats the engine's model rather than the empty half of a line.
  const figure = engine.tracksHours && engine.hours !== null;
  // 231 px measured on a phone — 27% of the viewport per engine, so one of three fitted. Tighter
  // padding and a 24 px counter on a phone bring it to ~183 px, two engines visible. Buttons keep
  // their 44 px floor; iPad keeps the fuller card from `sm`.
  return (
    <Card className={cn("gap-0 overflow-hidden p-0", !engine.isActive && "bg-surface-2")}>
      {/* The tile is tappable (D19), and what it opens is the engine's own sheet: the history of
          its readings and the button that edits it, together. The link covers the whole readable
          body — the name, the counter, the date — and the chevron beside the name says so; the
          reading button sits under it, beside the link and never inside it (`ListRow`'s rule: a
          button is never nested in an anchor). */}
      <Link
        href={href as Route}
        className={cn(
          "flex flex-col gap-2 tap-feedback px-4 py-4 sm:gap-3 sm:px-5 sm:py-5",
          "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:-outline-offset-2 focus-visible:outline-none",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-h3">{engine.label}</h3>
            <p className="truncate text-caption text-ink-2">
              {engineKind(engine, tp, tpr)}
              {details ? ` · ${details}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {/* On a phone the figure joins the title line rather than costing one of its own
                (D54, and the rule the touch audit measures): three engines stacked are a list,
                and a list is scanned. From `sm` it drops back under the name at full size. */}
            {figure ? (
              <EngineHours
                hours={engine.hours}
                tracksHours={engine.tracksHours}
                size="sm"
                className="sm:hidden"
              />
            ) : null}
            {engine.isActive ? null : (
              <Badge variant="outline" size="md">
                {t("inactive")}
              </Badge>
            )}
            <ChevronRightIcon className="size-5 text-n-400" aria-hidden />
          </div>
        </div>
        <EngineHours
          hours={engine.hours}
          tracksHours={engine.tracksHours}
          className={cn(figure && "hidden sm:block")}
        />
        <EngineReadDate readAt={engine.readAt} tracksHours={engine.tracksHours} />
      </Link>
      {/* One line, one meaning: the act on the left, the count on the right — and the count is
          text now. It used to be a ghost button carrying a chevron, so the only way into the
          engine was labelled after something else (« 11 points liés »), and reading it as
          « opens the checklist » was the honest reading. */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
        {onReading ? (
          <Button type="button" variant="outline" onClick={onReading}>
            <GaugeIcon />
            {t("addReading")}
          </Button>
        ) : null}
        <span className="truncate text-caption text-ink-2">
          {t("linkedCount", { count: engine.linkedItems })}
        </span>
      </div>
    </Card>
  );
}

// Engines tab (E2-2): counters at a glance, one dialog for every reading entry.
export function EnginesTab({
  boatId,
  engines,
  canWrite,
  canContribute,
  openReading = false,
}: {
  boatId: string;
  engines: EngineSummary[];
  canWrite: boolean;
  canContribute: boolean;
  openReading?: boolean;
}) {
  const t = useTranslations("engines");
  const ti = useTranslations("import");
  const router = useRouter();
  const active = engines.filter((engine) => engine.isActive);
  const inactive = engines.filter((engine) => !engine.isActive);
  const [dialogEngine, setDialogEngine] = useState<string | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(
    openReading && canContribute && active.some((engine) => engine.tracksHours),
  );

  // Only engines that have a meter can be read (D73).
  const readingEngines: ReadingEngine[] = active
    .filter((engine) => engine.tracksHours)
    .map((engine) => ({
      id: engine.id,
      label: engine.label,
      lastHours: engine.hours,
      lastDate: engine.readAt,
    }));

  function openDialog(engineId?: string) {
    setDialogEngine(engineId);
    setDialogOpen(true);
  }

  function onDialogChange(open: boolean) {
    setDialogOpen(open);
    if (!open && openReading) router.replace(boatTabPath(boatId, "engines") as Route);
  }

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {canWrite ? (
        // A bare button row was the first thing under the tabs, before a single engine: 68 px
        // measured, and only one of three engines fitted the fold. It follows the list on a
        // phone and leads it again from `sm`.
        <div className="order-last flex flex-wrap items-center justify-end gap-2 sm:order-none">
          {/* Reprendre un carnet d'heures commence ici, à côté de l'acte du quotidien (E12-4). */}
          <Button asChild variant="outline">
            <Link href={importPath(boatId, "readings") as Route}>{ti("action")}</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={newEnginePath(boatId) as Route}>{t("add")}</Link>
          </Button>
        </div>
      ) : null}
      {active.length === 0 && inactive.length === 0 ? (
        <EmptyState
          icon={<GaugeIcon />}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            canWrite ? (
              <Button asChild>
                <Link href={newEnginePath(boatId) as Route}>{t("add")}</Link>
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((engine) => (
            <EngineCard
              key={engine.id}
              engine={engine}
              href={enginePath(boatId, engine.id)}
              onReading={
                canContribute && engine.tracksHours ? () => openDialog(engine.id) : undefined
              }
            />
          ))}
        </div>
      )}
      {inactive.length > 0 ? (
        <Accordion type="single" collapsible>
          <AccordionItem value="inactive">
            <AccordionTrigger>{t("inactiveList", { count: inactive.length })}</AccordionTrigger>
            <AccordionContent>
              <div className="grid gap-4 md:grid-cols-2">
                {inactive.map((engine) => (
                  <EngineCard
                    key={engine.id}
                    engine={engine}
                    href={enginePath(boatId, engine.id)}
                  />
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}
      <HourReadingDialog
        boatId={boatId}
        engines={readingEngines}
        defaultEngineId={dialogEngine}
        open={dialogOpen}
        onOpenChange={onDialogChange}
        canResetCounter={canWrite}
      />
    </div>
  );
}
