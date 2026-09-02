"use client";

import { useTranslations } from "next-intl";

import type { ChecklistRow } from "@/components/checklist/rows";
import { isPunctual } from "@/components/checklist/rows";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { DueLabel } from "@/components/common/DueLabel";
import { ListRow } from "@/components/common/ListRow";
import { Button } from "@/components/ui/button";
import { formatDate, formatHours } from "@/lib/format";

export function useRowMeta() {
  const t = useTranslations("checklist.item");
  const tu = useTranslations("units");
  return (row: ChecklistRow, withCategory: boolean): string => {
    const parts: string[] = [];
    if (withCategory) parts.push(row.categoryName);
    if (row.intervalMonths) parts.push(tu("everyMonths", { count: row.intervalMonths }));
    if (row.intervalHours) parts.push(tu("everyHours", { count: row.intervalHours }));
    if (row.engineLabel && !withCategory) parts.push(row.engineLabel);
    if (row.hasCompletion && row.lastCompletedAt) {
      parts.push(
        row.lastCompletedByName
          ? t("doneBy", { date: formatDate(row.lastCompletedAt), name: row.lastCompletedByName })
          : t("done", { date: formatDate(row.lastCompletedAt) }),
      );
      if (row.lastEngineHours !== null)
        parts.push(t("atHours", { hours: formatHours(row.lastEngineHours) }));
      if (row.fixedDueAt) parts.push(t("validUntil", { date: formatDate(row.fixedDueAt) }));
    } else {
      parts.push(t("never"));
    }
    return parts.join(" · ");
  };
}

/**
 * One checklist line (ux-flows §3, reference screen): state badge, label, one meta line,
 * the driving deadline on the right and a 88 × 44 px « Fait » at a fixed abscissa.
 */
export function ChecklistItemRow({
  row,
  withCategory = false,
  href,
  onClick,
  onDone,
  className,
}: {
  row: ChecklistRow;
  withCategory?: boolean;
  href?: string;
  onClick?: () => void;
  onDone?: (row: ChecklistRow) => void;
  className?: string;
}) {
  const t = useTranslations("checklist");
  const meta = useRowMeta();
  const punctual = isPunctual(row);
  return (
    <ListRow
      lead={<ChecklistStateBadge state={row.status} className="w-24 justify-center" />}
      title={row.label}
      meta={
        <>
          {withCategory ? <CategoryDot color={row.categoryColor} /> : null}
          <span className="truncate">{meta(row, withCategory)}</span>
        </>
      }
      trailing={
        punctual ? null : (
          <DueLabel
            status={row.status}
            daysRemaining={row.daysRemaining}
            hoursRemaining={row.hoursRemaining}
            hasCounter={row.engineId === null || row.currentHours !== null}
          />
        )
      }
      action={
        onDone ? (
          <Button
            type="button"
            variant={row.status === "ok" ? "outline" : "default"}
            className="w-22"
            onClick={(event) => {
              event.stopPropagation();
              onDone(row);
            }}
          >
            {punctual && row.hasCompletion ? t("item.redo") : t("markDone")}
          </Button>
        ) : undefined
      }
      categoryColor={withCategory ? row.categoryColor : undefined}
      href={href}
      onClick={onClick}
      className={className}
    />
  );
}
