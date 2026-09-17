"use client";

import { useTranslations } from "next-intl";

import { ActivityRowMenu } from "@/components/activity/ActivityRowMenu";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import type { ActivityKind, ActivityRow } from "@/lib/queries/activity";

/** Les libellés des cinq faits, dans le vocabulaire du bord. */
const KIND_KEY = {
  completion: "kind.completion",
  log: "kind.log",
  purchase: "kind.purchase",
  reading: "kind.reading",
  haul_out: "kind.haulOut",
} as const satisfies Record<ActivityKind, string>;

/**
 * « Ce qui a bougé » (E18-3, D132) : le fil partagé du carnet.
 *
 * C'est la seule chose que le papier ne sait pas faire — dire ce que l'autre a fait depuis la
 * dernière fois — et c'est ce qui remplace les trois résumés d'autres onglets qu'E18-1 a retirés.
 *
 * Le corps de la ligne ne mène toujours nulle part : un fait n'est pas une porte, et une moitié
 * de lignes cliquables ferait croire que l'autre moitié est cassée. Ce qui change avec D144,
 * c'est qu'on peut **agir dessus** : un menu par ligne ouvre l'écran du fait quand il en a un et
 * le retire du carnet. Corriger une erreur ne demande plus de savoir où la ligne habite.
 */
export function ActivityList({
  boatId,
  rows,
  canWrite,
}: {
  boatId: string;
  rows: ActivityRow[];
  canWrite: boolean;
}) {
  const t = useTranslations("dashboard.activity");

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      {rows.map((row) => (
        <ListRow
          key={`${row.kind}:${row.id}`}
          categoryColor={row.categoryColor ?? undefined}
          lead={
            <span className="w-20 shrink-0 num text-caption text-ink-2">
              {formatDate(row.happenedAt)}
            </span>
          }
          title={row.title}
          meta={
            <>
              {row.categoryColor ? <CategoryDot color={row.categoryColor} /> : null}
              <span className="truncate">
                {[t(KIND_KEY[row.kind]), row.who ? t("by", { name: row.who }) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </>
          }
          trailing={
            row.amount !== null ? (
              <span className="num text-caption text-ink-2">{formatCurrency(row.amount)}</span>
            ) : row.hours !== null ? (
              <span className="num text-caption text-ink-2">{formatHours(row.hours)}</span>
            ) : null
          }
          action={<ActivityRowMenu boatId={boatId} row={row} canWrite={canWrite} />}
        />
      ))}
    </div>
  );
}
