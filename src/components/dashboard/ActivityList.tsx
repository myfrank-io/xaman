import { getTranslations } from "next-intl/server";

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
 * Les lignes ne mènent nulle part, volontairement : un fait n'est pas une porte. Un relevé
 * d'heures n'a pas d'écran à lui, et une moitié de lignes cliquables aurait fait croire que
 * l'autre moitié est cassée. Les écrans sont à un tap, dans la barre.
 */
export async function ActivityList({ rows }: { rows: ActivityRow[] }) {
  const t = await getTranslations("dashboard.activity");

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
        />
      ))}
    </div>
  );
}
