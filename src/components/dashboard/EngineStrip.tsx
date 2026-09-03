"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { GaugeIcon, PlusIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { HourReadingDialog, type ReadingEngine } from "@/components/engines/HourReadingDialog";
import { Button } from "@/components/ui/button";
import { formatDayMonth, formatHours, toDate } from "@/lib/format";
import { cn } from "@/lib/utils";

// Without a recent reading every hour-based deadline is wrong: past this age the date turns amber.
const STALE_DAYS = 60;

function EngineChip({
  engine,
  onOpen,
}: {
  engine: ReadingEngine;
  onOpen?: (engineId: string) => void;
}) {
  const t = useTranslations("dashboard.engines");
  const lastDate = toDate(engine.lastDate);
  const stale = lastDate ? differenceInCalendarDays(new Date(), lastDate) > STALE_DAYS : false;
  const content = (
    <>
      <GaugeIcon className="size-4 shrink-0 text-on-navy-3" aria-hidden />
      <span className="font-medium">{engine.label}</span>
      {engine.lastHours === null ? (
        <span className="text-on-navy-3">{t("noReading")}</span>
      ) : (
        <span className="num">
          {formatHours(engine.lastHours)}
          {engine.lastDate ? (
            <>
              {" · "}
              <span className={cn(stale && "text-state-soon-on-dark")}>
                {formatDayMonth(engine.lastDate)}
              </span>
            </>
          ) : null}
        </span>
      )}
      {stale ? (
        // The triangle says « à mettre à jour » on its own; the words cost 102 px, which a
        // 320 px screen does not have to give. They come back from `sm`.
        <span className="inline-flex shrink-0 items-center gap-1 text-caption text-state-soon-on-dark">
          <TriangleAlertIcon className="size-3.5" aria-hidden />
          <span className="sr-only sm:not-sr-only">{t("stale")}</span>
        </span>
      ) : null}
    </>
  );
  const className =
    "inline-flex min-h-11 max-w-full min-w-0 items-center gap-2 rounded-lg border border-on-navy-border bg-on-navy-surface px-3 text-label text-on-navy";
  if (!onOpen) return <div className={className}>{content}</div>;
  return (
    <button
      type="button"
      onClick={() => onOpen(engine.id)}
      className={cn(className, "pressable focus-visible:ring-[3px] focus-visible:ring-ring/50")}
    >
      {content}
    </button>
  );
}

/**
 * Engine band of the dashboard header (ux-flows §2.2): one tappable chip per active engine,
 * the date of the last reading always shown, « compteur inconnu » when there is none.
 * A tap opens the hour reading dialog on that engine (flow e).
 */
export function EngineStrip({
  boatId,
  engines,
  canContribute,
  canWrite,
}: {
  boatId: string;
  engines: ReadingEngine[];
  canContribute: boolean;
  canWrite: boolean;
}) {
  const t = useTranslations("dashboard.engines");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [engineId, setEngineId] = useState<string | undefined>(undefined);

  if (engines.length === 0) return null;

  function openFor(id?: string) {
    setEngineId(id);
    setOpen(true);
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <span className="mr-1 shrink-0 text-overline text-on-navy-3 uppercase">{t("title")}</span>
      {engines.map((engine) => (
        <EngineChip
          key={engine.id}
          engine={engine}
          onOpen={canContribute ? (id) => openFor(id) : undefined}
        />
      ))}
      {canContribute ? (
        <>
          <Button
            variant="inverse"
            size="icon"
            aria-label={t("addReading")}
            className="shrink-0"
            onClick={() => openFor(undefined)}
          >
            <PlusIcon />
          </Button>
          <HourReadingDialog
            boatId={boatId}
            engines={engines}
            defaultEngineId={engineId}
            open={open}
            onOpenChange={setOpen}
            canResetCounter={canWrite}
            onSaved={() => router.refresh()}
          />
        </>
      ) : null}
    </div>
  );
}
