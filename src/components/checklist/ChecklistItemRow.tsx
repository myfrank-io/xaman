"use client";

import { useTranslations } from "next-intl";

import type { ChecklistRow } from "@/components/checklist/rows";
import { hasCounter, isDueToday, isPunctual } from "@/components/checklist/rows";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { DueLabel } from "@/components/common/DueLabel";
import { ListRow } from "@/components/common/ListRow";
import { Button } from "@/components/ui/button";
import { formatDate, formatHours } from "@/lib/format";

function useRowMeta() {
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
  compact = false,
  className,
}: {
  row: ChecklistRow;
  withCategory?: boolean;
  href?: string;
  onClick?: () => void;
  onDone?: (row: ChecklistRow) => void;
  /** Short due label for narrow layouts (dashboard queue). */
  compact?: boolean;
  className?: string;
}) {
  const t = useTranslations("checklist");
  const meta = useRowMeta();
  const punctual = isPunctual(row);
  return (
    <ListRow
      lead={
        <ChecklistStateBadge
          state={row.status}
          dueToday={isDueToday(row)}
          // Une largeur unique pour les cinq états, 120 px : les puces forment une colonne nette
          // et les titres ne bougent pas d'un pixel. 112 px ne suffisait pas — « EN RETARD » en
          // mesure 115 et sortait de sa propre puce, pendant que la puce, elle, sortait de sa
          // colonne de 104. `min-w` et non `w` : un libellé plus long pousse, il ne déborde pas.
          className="min-w-30"
        />
      }
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
            hasCounter={hasCounter(row)}
            compact={compact}
          />
        )
      }
      action={
        onDone ? (
          <Button
            type="button"
            variant={row.status === "ok" ? "outline" : "default"}
            // « Fait » is four characters at 14 px: 64 px holds it with room, and the 44 px
            // height is untouched, so the target stays 64 x 44. The 24 px goes to the title,
            // which is what drops most real labels from two lines to one.
            className="w-16 sm:w-22"
            onClick={(event) => {
              event.preventDefault();
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
