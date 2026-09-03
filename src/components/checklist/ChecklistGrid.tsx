import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon, PackageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Badge } from "@/components/ui/badge";
import { formatPercent } from "@/lib/format";
import { categoryPath, stockPath } from "@/lib/queries/boat-routes";
import type { Database } from "@/types/database";

/** What the stock card says: how many parts are aboard, and how many are under their threshold. */
export type StockSummary = { total: number; low: number };

export type CategoryProgress = {
  id: string;
  name: string;
  color: string;
  icon: string | null;
  total: number;
  overdue: number;
  neverRecorded: number;
  punctual: number;
  progress: number | null;
};

export type CategoryProgressRow = Database["public"]["Views"]["checklist_category_progress"]["Row"];

export function toCategoryProgress(row: CategoryProgressRow): CategoryProgress {
  return {
    id: row.category_id ?? "",
    name: row.name ?? "",
    color: row.color ?? "#63748A",
    icon: row.icon,
    total: row.total ?? 0,
    overdue: row.overdue_count ?? 0,
    neverRecorded: row.never_recorded_count ?? 0,
    punctual: row.punctual_count ?? 0,
    progress: row.progress,
  };
}

/**
 * One tile, two shapes.
 *
 * On a phone this is a 64 px row in a single bordered list; from `sm` it is the card it has
 * always been. The card was the whole screen: `min-h-36` plus its padding measured 175 px with
 * its gap, so nine systems filled 1 600 px and two fit a phone — you scrolled a screen and a
 * half to learn which systems exist. A card per item is right for three items, and there are
 * nine in a fixed order, which is exactly what a list is for.
 *
 * The shell lives here rather than being written twice: the stock tile used to be a copy of
 * the category tile, and a copy is what lets two things that must look identical drift apart.
 */
function Tile({
  href,
  icon,
  title,
  meta,
  badge,
  footer,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  /** The count line — and, on a phone, the progress that the bar cannot show there. */
  meta: string;
  badge?: React.ReactNode;
  /** The caption under the bar: « à jour », « jamais fait »… */
  footer?: React.ReactNode;
  /** The progress bar. Absent on the stock tile: nothing is « due » about a shelf. */
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={href as Route}
      className="flex min-h-16 items-center gap-3 border-b border-border tap-feedback px-4 py-2 last:border-b-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none sm:min-h-36 sm:flex-col sm:items-stretch sm:gap-3 sm:rounded-xl sm:border sm:bg-surface sm:p-4"
    >
      {/* Phone: icon, text, badge and chevron on one line. From `sm` the icon and the badge
          take the top row of the card and the text drops below them, unchanged. */}
      <span className="shrink-0 sm:flex sm:items-start sm:justify-between sm:gap-2">
        {icon}
        {badge ? <span className="hidden sm:block">{badge}</span> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body leading-tight font-medium sm:text-h3 sm:whitespace-normal">
          {title}
        </span>
        <span className="block truncate num text-caption text-ink-2">{meta}</span>
      </span>
      {badge ? <span className="shrink-0 sm:hidden">{badge}</span> : null}
      <ChevronRightIcon className="size-5 shrink-0 text-n-400 sm:hidden" aria-hidden />
      <span className="hidden sm:mt-auto sm:flex sm:flex-col sm:gap-1">
        {children}
        {footer}
      </span>
    </Link>
  );
}

// Fixed-order grid of the boat's systems (E4-3, D21): the position is the memory.
export async function ChecklistGrid({
  boatId,
  categories,
  stock,
}: {
  boatId: string;
  categories: CategoryProgress[];
  /** Shown even at zero: the card is the way into the stock, so it must exist before it does. */
  stock?: StockSummary | null;
}) {
  const t = await getTranslations("checklist.card");
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent lg:grid-cols-4">
      {categories.map((category) => {
        const neverDone = category.total > 0 && category.neverRecorded === category.total;
        const ratio = neverDone || category.total === 0 ? null : category.progress;
        return (
          <Tile
            key={category.id}
            href={categoryPath(boatId, category.id)}
            icon={<CategoryIcon color={category.color} icon={category.icon} />}
            title={category.name}
            // The bar is not drawn on a phone, so its number joins the count line: the
            // progress is the point of the screen and must not be the thing that is dropped.
            meta={[
              t("points", { count: category.total }),
              category.punctual > 0 ? t("punctual", { count: category.punctual }) : null,
              neverDone ? t("neverDone") : ratio !== null ? formatPercent(ratio) : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            badge={
              category.overdue > 0 ? (
                <Badge variant="destructive" size="sm">
                  {t("overdue", { count: category.overdue })}
                </Badge>
              ) : undefined
            }
            footer={
              <span className="text-caption text-ink-2">
                {neverDone
                  ? t("neverDone")
                  : category.overdue === 0 && category.total > 0
                    ? t("upToDate")
                    : ""}
              </span>
            }
          >
            <ProgressBar ratio={ratio} color={category.color} label={category.name} />
          </Tile>
        );
      })}

      {/* The stock closes the list. It is not a system and carries no progress bar — nothing is
          « due » about a shelf — but it is what you look for while planning the work these
          tiles describe, so it sits where the eye already is rather than two taps away. Neutral
          on purpose: a category colour here would read as a ninth system (rule 12). */}
      {stock ? (
        <Tile
          href={stockPath(boatId)}
          icon={
            // `size-8 rounded-md`, exactly CategoryIcon: 4 px of difference shifted the whole
            // stock row out of the column the eight systems line up in.
            <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-2 text-ink-2">
              <PackageIcon className="size-5" aria-hidden />
            </span>
          }
          title={t("stockTitle")}
          meta={t("stockParts", { count: stock.total })}
          badge={
            stock.low > 0 ? (
              <Badge variant="destructive" size="sm">
                {t("stockLow", { count: stock.low })}
              </Badge>
            ) : undefined
          }
          footer={
            <span className="text-caption text-ink-2">
              {stock.total === 0
                ? t("stockEmpty")
                : stock.low > 0
                  ? t("stockToBuy")
                  : t("stockComplete")}
            </span>
          }
        />
      ) : null}
    </div>
  );
}
