"use client";

import Link from "next/link";
import type { Route } from "next";
import { ChevronLeftIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { AttachmentsSection } from "@/components/attachments/AttachmentsSection";
import { CategoryBadge } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge, type LogStatus } from "@/components/common/StatusBadge";
import type { LogEngineHours } from "@/components/logs/rows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import type { AttachmentItem } from "@/lib/queries/attachments";
import { boatPath, categoryPath, logsReviewPath } from "@/lib/queries/boat-routes";

export type LogDetailData = {
  id: string;
  title: string;
  performedAt: string;
  status: LogStatus;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
  categoryArchived: boolean;
  cost: number | null;
  notes: string | null;
  equipmentName: string | null;
  needsReview: boolean;
  createdByName: string | null;
  createdAt: string;
  updatedByName: string | null;
  updatedAt: string;
};

export type LogDetailCompletion = {
  id: string;
  label: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  engineHours: number | null;
};

/** One labelled fact of the intervention. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-overline text-ink-2 uppercase">{label}</span>
      <span className="text-body text-foreground">{children}</span>
    </div>
  );
}

/**
 * Detail of an intervention (E3-4): every field, the readings it carries, the checklist points
 * it ticked, the purchases attached to it, and the footer « créé par … » (E10-4).
 * Presentational: the page reads the data, this renders it (and the dev gallery reuses it).
 */
export function LogDetail({
  boatId,
  log,
  contact,
  haulOut,
  engineHours,
  completions,
  purchases,
  attachments = [],
  canWrite,
  actions,
}: {
  boatId: string;
  log: LogDetailData;
  contact: { name: string; phone: string | null } | null;
  haulOut: { id: string; label: string } | null;
  engineHours: LogEngineHours[];
  completions: LogDetailCompletion[];
  purchases: { id: string; designation: string; amount: number | null }[];
  /** Documents already stored, with their signed URLs (E10-1). */
  attachments?: AttachmentItem[];
  canWrite: boolean;
  actions?: React.ReactNode;
}) {
  const t = useTranslations("logs.detail");
  const tl = useTranslations("logs");
  const tc = useTranslations("common");

  const purchaseTotal = purchases.reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const phone = contact?.phone?.replace(/\s/g, "") ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={boatPath(boatId, "logs") as Route}>
            <ChevronLeftIcon />
            {tl("title")}
          </Link>
        </Button>
        <PageHeader
          className="mt-2"
          title={log.title}
          subtitle={formatDate(log.performedAt)}
          actions={actions}
        />
      </div>

      {log.needsReview ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("reviewBanner")}</span>
            {canWrite ? (
              <Button asChild size="sm" variant="outline">
                <Link href={logsReviewPath(boatId, { log: log.id }) as Route}>
                  {t("reviewAction")}
                </Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 rounded-xl border border-border bg-surface p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <Fact label={t("fields.status")}>
          <StatusBadge status={log.status} />
        </Fact>
        <Fact label={t("fields.category")}>
          {log.categoryName && log.categoryColor ? (
            <CategoryBadge
              name={log.categoryName}
              color={log.categoryColor}
              icon={log.categoryIcon}
              withIcon
              archived={log.categoryArchived}
            />
          ) : (
            tc("none")
          )}
        </Fact>
        <Fact label={t("fields.cost")}>
          <span className="num">{log.cost === null ? tc("none") : formatCurrency(log.cost)}</span>
        </Fact>
        <Fact label={t("fields.by")}>
          {contact ? (
            <span className="flex flex-wrap items-center gap-2">
              {contact.name}
              {phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${phone}`}>
                    <PhoneIcon />
                    {contact.phone}
                  </a>
                </Button>
              ) : null}
            </span>
          ) : (
            tl("byCrew")
          )}
        </Fact>
        {log.equipmentName ? <Fact label={t("fields.equipment")}>{log.equipmentName}</Fact> : null}
        {haulOut ? (
          <Fact label={t("fields.haulOut")}>
            <Link
              href={boatPath(boatId, "haulOuts") as Route}
              className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
            >
              {haulOut.label}
            </Link>
          </Fact>
        ) : null}
      </div>

      {log.notes ? (
        <SectionCard title={t("fields.notes")} bare>
          <p className="text-body whitespace-pre-wrap text-foreground">{log.notes}</p>
        </SectionCard>
      ) : null}

      {engineHours.length > 0 ? (
        <SectionCard title={t("sections.hours")}>
          {engineHours.map((entry) => (
            <ListRow
              key={entry.engineId}
              title={entry.label}
              trailing={
                <span className="num text-body font-medium">{formatHours(entry.hours)}</span>
              }
            />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title={t("sections.completions")} bare={completions.length === 0}>
        {completions.length === 0 ? (
          <p className="text-body text-ink-2">{t("noCompletions")}</p>
        ) : (
          completions.map((completion) => (
            <ListRow
              key={completion.id}
              categoryColor={completion.categoryColor ?? undefined}
              title={completion.label}
              meta={
                completion.categoryName ? (
                  <span className="truncate">{completion.categoryName}</span>
                ) : null
              }
              trailing={
                completion.engineHours !== null ? (
                  <span className="num text-caption text-ink-2">
                    {formatHours(completion.engineHours)}
                  </span>
                ) : null
              }
              href={completion.categoryId ? categoryPath(boatId, completion.categoryId) : undefined}
            />
          ))
        )}
      </SectionCard>

      {purchases.length > 0 ? (
        <SectionCard
          title={t("sections.purchases")}
          footer={t("purchasesNote", {
            count: purchases.length,
            amount: formatCurrency(purchaseTotal),
          })}
        >
          {purchases.map((purchase) => (
            <ListRow
              key={purchase.id}
              title={purchase.designation}
              trailing={
                <span className="num text-caption text-ink-2">
                  {formatCurrency(purchase.amount)}
                </span>
              }
            />
          ))}
        </SectionCard>
      ) : null}

      <AttachmentsSection
        boatId={boatId}
        owner={{ type: "maintenance_log", id: log.id }}
        initial={attachments}
      />

      <p className="text-caption text-ink-3">
        {log.updatedByName && log.updatedAt !== log.createdAt
          ? t("footer", {
              createdBy: log.createdByName ?? t("unknownAuthor"),
              createdAt: formatDate(log.createdAt),
              updatedBy: log.updatedByName,
              updatedAt: formatDate(log.updatedAt),
            })
          : t("footerCreated", {
              createdBy: log.createdByName ?? t("unknownAuthor"),
              createdAt: formatDate(log.createdAt),
            })}
      </p>
    </div>
  );
}
