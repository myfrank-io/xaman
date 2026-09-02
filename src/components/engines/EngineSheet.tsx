"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeftIcon, GaugeIcon, MoreHorizontalIcon, PencilIcon } from "lucide-react";

import { ChecklistStateBadge, type ChecklistState } from "@/components/common/ChecklistStateBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DueLabel } from "@/components/common/DueLabel";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge, type LogStatus } from "@/components/common/StatusBadge";
import { EditReadingDialog, type EditableReading } from "@/components/engines/EditReadingDialog";
import { EngineCounter } from "@/components/engines/EnginesTab";
import { HourReadingDialog } from "@/components/engines/HourReadingDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deleteHourReading, generateEngineChecklist, setEngineActive } from "@/lib/actions/engines";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  boatTabPath,
  categoryPath,
  checklistPath,
  editEnginePath,
  logPath,
  logsPath,
} from "@/lib/queries/boat-routes";
import type { EnginePosition } from "@/lib/schemas/engines";

export type EngineDetail = {
  id: string;
  label: string;
  position: EnginePosition;
  brand: string | null;
  model: string | null;
  serial: string | null;
  installedAt: string | null;
  notes: string | null;
  isActive: boolean;
  counterResetAt: string | null;
};

export type EngineItemRow = {
  id: string;
  label: string;
  categoryId: string;
  intervalMonths: number | null;
  intervalHours: number | null;
  status: ChecklistState;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  hasCounter: boolean;
  lastCompletedAt: string | null;
  lastEngineHours: number | null;
};

export type EngineReadingRow = {
  id: string;
  hours: number;
  readAt: string;
  source: "manual" | "maintenance_log" | "checklist" | "import";
  note: string | null;
  byName: string | null;
  updatedAt: string;
};

export type EngineLogRow = {
  id: string;
  title: string;
  performedAt: string;
  status: LogStatus;
  cost: number | null;
  contactName: string | null;
};

export function EngineSheet({
  boatId,
  engine,
  currentHours,
  currentReadAt,
  currentByName,
  items,
  readings,
  logs,
  linkedCount,
  hasTemplate,
  canWrite,
  canContribute,
}: {
  boatId: string;
  engine: EngineDetail;
  currentHours: number | null;
  currentReadAt: string | null;
  currentByName: string | null;
  items: EngineItemRow[];
  readings: EngineReadingRow[];
  logs: EngineLogRow[];
  linkedCount: number;
  hasTemplate: boolean;
  canWrite: boolean;
  canContribute: boolean;
}) {
  const t = useTranslations("engines");
  const tu = useTranslations("units");
  const tp = useTranslations("enginePosition");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [readingOpen, setReadingOpen] = useState(false);
  const [editing, setEditing] = useState<EditableReading | null>(null);
  const [deleting, setDeleting] = useState<EngineReadingRow | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  const subtitle = [
    tp(engine.position),
    [engine.brand, engine.model].filter(Boolean).join(" "),
    engine.installedAt ? t("installedIn", { year: engine.installedAt.slice(0, 4) }) : null,
    engine.serial ? t("serialShort", { serial: engine.serial }) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        toast.error(errorMessage(result.error ?? "errors.unknown"));
        return;
      }
      toast.success(success);
      router.refresh();
    });
  }

  function intervalLabel(item: EngineItemRow): string {
    const parts: string[] = [];
    if (item.intervalMonths) parts.push(tu("everyMonths", { count: item.intervalMonths }));
    if (item.intervalHours) parts.push(tu("everyHours", { count: item.intervalHours }));
    if (item.lastCompletedAt) {
      parts.push(
        item.lastEngineHours !== null
          ? `${formatDate(item.lastCompletedAt)} · ${formatHours(item.lastEngineHours)}`
          : formatDate(item.lastCompletedAt),
      );
    } else {
      parts.push(tc("never"));
    }
    return parts.join(" · ");
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={boatTabPath(boatId, "engines") as Route}>
            <ChevronLeftIcon />
            {t("title")}
          </Link>
        </Button>
        <PageHeader
          className="mt-2"
          title={
            <span className="flex items-center gap-3">
              {engine.label}
              {engine.isActive ? null : (
                <Badge variant="outline" size="md">
                  {t("inactive")}
                </Badge>
              )}
            </span>
          }
          subtitle={subtitle}
          actions={
            <>
              {canContribute && engine.isActive ? (
                <Button type="button" onClick={() => setReadingOpen(true)}>
                  <GaugeIcon />
                  {t("addReading")}
                </Button>
              ) : null}
              {canWrite ? (
                <Button asChild variant="outline">
                  <Link href={editEnginePath(boatId, engine.id) as Route}>
                    <PencilIcon />
                    {tc("edit")}
                  </Link>
                </Button>
              ) : null}
            </>
          }
        />
      </div>

      <SectionCard title={t("counter")}>
        <div className="px-5 py-4">
          <EngineCounter hours={currentHours} readAt={currentReadAt} size="lg" />
          {currentByName ? (
            <p className="mt-1 text-caption text-ink-3">{t("readBy", { name: currentByName })}</p>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={t("linkedItems")}
        actionHref={items.length > 0 ? checklistPath(boatId) : undefined}
        actionLabel={items.length > 0 ? tc("viewAll") : undefined}
      >
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 px-5 py-4">
            <p className="text-body text-ink-2">{t("noLinkedItems")}</p>
            {canWrite && engine.isActive && hasTemplate && linkedCount === 0 ? (
              <Button
                type="button"
                variant="outline"
                disabled={pending}
                onClick={() =>
                  run(
                    () => generateEngineChecklist({ boatId, engineId: engine.id }),
                    t("generated"),
                  )
                }
              >
                {t("generateItems")}
              </Button>
            ) : null}
          </div>
        ) : (
          items.map((item) => (
            <ListRow
              key={item.id}
              lead={<ChecklistStateBadge state={item.status} />}
              title={item.label}
              meta={intervalLabel(item)}
              trailing={
                <DueLabel
                  status={item.status}
                  daysRemaining={item.daysRemaining}
                  hoursRemaining={item.hoursRemaining}
                  hasCounter={item.hasCounter}
                />
              }
              href={categoryPath(boatId, item.categoryId)}
            />
          ))
        )}
      </SectionCard>

      <SectionCard title={t("readings")}>
        {readings.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-2">{t("noReadings")}</p>
        ) : (
          readings.map((reading) => (
            <ListRow
              key={reading.id}
              title={
                <span className="flex items-center gap-3">
                  <span className="num">{formatHours(reading.hours)}</span>
                  <Badge variant="outline" size="sm">
                    {t(`source.${reading.source}`)}
                  </Badge>
                </span>
              }
              meta={[
                formatDate(reading.readAt),
                reading.byName,
                reading.note,
                reading.source === "import" ? t("importedHint") : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              action={
                canWrite ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button type="button" variant="ghost" size="icon" aria-label={tc("actions")}>
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() =>
                          setEditing({
                            id: reading.id,
                            hours: reading.hours,
                            readAt: reading.readAt,
                            note: reading.note,
                            updatedAt: reading.updatedAt,
                          })
                        }
                      >
                        {t("reading.edit")}
                      </DropdownMenuItem>
                      {reading.source === "manual" || reading.source === "import" ? (
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => setDeleting(reading)}
                        >
                          {t("reading.delete")}
                        </DropdownMenuItem>
                      ) : null}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : undefined
              }
            />
          ))
        )}
      </SectionCard>

      <SectionCard
        title={t("logs")}
        actionHref={logs.length > 0 ? logsPath(boatId) : undefined}
        actionLabel={logs.length > 0 ? tc("viewAll") : undefined}
      >
        {logs.length === 0 ? (
          <p className="px-5 py-4 text-body text-ink-2">{t("noLogs")}</p>
        ) : (
          logs.map((log) => (
            <ListRow
              key={log.id}
              lead={<StatusBadge status={log.status} />}
              title={log.title}
              meta={[formatDate(log.performedAt), log.contactName].filter(Boolean).join(" · ")}
              trailing={
                log.cost !== null ? (
                  <span className="num text-body font-medium">{formatCurrency(log.cost)}</span>
                ) : null
              }
              href={logPath(boatId, log.id)}
            />
          ))
        )}
      </SectionCard>

      {canWrite ? (
        <div className="flex flex-wrap gap-3 border-t border-border pt-6">
          {engine.isActive ? (
            <Button type="button" variant="outline" onClick={() => setDeactivating(true)}>
              {t("deactivate")}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () => setEngineActive({ boatId, engineId: engine.id, isActive: true }),
                  t("reactivated"),
                )
              }
            >
              {t("reactivate")}
            </Button>
          )}
        </div>
      ) : null}

      <HourReadingDialog
        boatId={boatId}
        engines={[
          { id: engine.id, label: engine.label, lastHours: currentHours, lastDate: currentReadAt },
        ]}
        defaultEngineId={engine.id}
        open={readingOpen}
        onOpenChange={setReadingOpen}
        canResetCounter={canWrite}
      />
      <EditReadingDialog
        boatId={boatId}
        reading={editing}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t("reading.deleteTitle")}
        description={
          deleting
            ? t("reading.deleteDescription", {
                hours: formatHours(deleting.hours),
                date: formatDate(deleting.readAt),
              })
            : undefined
        }
        confirmLabel={tc("delete")}
        pending={pending}
        onConfirm={() => {
          if (!deleting) return;
          const readingId = deleting.id;
          setDeleting(null);
          run(() => deleteHourReading({ boatId, readingId }), t("reading.deleted"));
        }}
      />
      <ConfirmDialog
        open={deactivating}
        onOpenChange={setDeactivating}
        title={t("deactivateTitle", { label: engine.label })}
        description={t("deactivateDescription", { count: linkedCount })}
        confirmLabel={t("deactivate")}
        pending={pending}
        onConfirm={() => {
          setDeactivating(false);
          run(
            () => setEngineActive({ boatId, engineId: engine.id, isActive: false }),
            t("deactivated"),
          );
        }}
      />
    </div>
  );
}
