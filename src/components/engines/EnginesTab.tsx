"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { differenceInCalendarDays } from "date-fns";
import { ChevronRightIcon, GaugeIcon } from "lucide-react";

import { EmptyState } from "@/components/common/EmptyState";
import { HourReadingDialog, type ReadingEngine } from "@/components/engines/HourReadingDialog";
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
import { boatTabPath, enginePath, newEnginePath } from "@/lib/queries/boat-routes";
import type { EnginePosition } from "@/lib/schemas/engines";
import { cn } from "@/lib/utils";

export type EngineSummary = {
  id: string;
  label: string;
  position: EnginePosition;
  brand: string | null;
  model: string | null;
  installedAt: string | null;
  isActive: boolean;
  hours: number | null;
  readAt: string | null;
  linkedItems: number;
};

// A counter older than this is flagged « à mettre à jour » (ux-flows §2.2).
const STALE_DAYS = 60;

export function EngineCounter({
  hours,
  readAt,
  size = "md",
}: {
  hours: number | null;
  readAt: string | null;
  size?: "md" | "lg";
}) {
  const t = useTranslations("engines");
  const date = toDate(readAt);
  const stale = date ? differenceInCalendarDays(new Date(), date) > STALE_DAYS : false;
  return (
    <div>
      <div
        className={cn(
          "num font-semibold text-foreground",
          hours === null
            ? "text-body-lg font-medium text-ink-3"
            : size === "lg"
              ? "text-display"
              : "text-num-lg",
        )}
      >
        {hours === null ? t("unknownCounter") : formatHours(hours)}
      </div>
      {readAt ? (
        <div className={cn("text-caption", stale ? "text-state-soon-fg" : "text-ink-3")}>
          {t("readOn", { date: formatDate(readAt) })}
          {stale ? ` · ${t("stale")}` : ""}
        </div>
      ) : null}
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
  const details = [engine.brand, engine.model].filter(Boolean).join(" ");
  return (
    <Card className={cn("gap-3 px-5", !engine.isActive && "bg-surface-2")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-h3">{engine.label}</h3>
          <p className="truncate text-caption text-ink-2">
            {tp(engine.position)}
            {details ? ` · ${details}` : ""}
          </p>
        </div>
        {engine.isActive ? null : (
          <Badge variant="outline" size="md">
            {t("inactive")}
          </Badge>
        )}
      </div>
      <EngineCounter hours={engine.hours} readAt={engine.readAt} />
      <div className="flex items-center justify-between gap-2 border-t border-border pt-3">
        {onReading ? (
          <Button type="button" variant="outline" onClick={onReading}>
            <GaugeIcon />
            {t("addReading")}
          </Button>
        ) : (
          <span />
        )}
        <Button asChild variant="ghost">
          <Link href={href as Route}>
            {t("linkedCount", { count: engine.linkedItems })}
            <ChevronRightIcon />
          </Link>
        </Button>
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
  const router = useRouter();
  const active = engines.filter((engine) => engine.isActive);
  const inactive = engines.filter((engine) => !engine.isActive);
  const [dialogEngine, setDialogEngine] = useState<string | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(openReading && canContribute && active.length > 0);

  const readingEngines: ReadingEngine[] = active.map((engine) => ({
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
    <div className="flex flex-col gap-6">
      {canWrite ? (
        <div className="flex justify-end">
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
              onReading={canContribute ? () => openDialog(engine.id) : undefined}
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
