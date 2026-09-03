import { getTranslations } from "next-intl/server";

import { CategoryDot } from "@/components/common/CategoryBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import { ExpenseFilters } from "@/components/supplies/ExpenseFilters";
import { ExpenseLines, type ExpenseLine } from "@/components/supplies/ExpenseLines";
import { ExportExpensesButton } from "@/components/supplies/ExportExpensesButton";
import {
  groupByCategory,
  totalAmount,
  variation,
  type DateRange,
  type ExpensePeriod,
  type ExpenseRow,
  type ExpenseSource,
} from "@/lib/expenses";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import { VISIBLE_PURCHASE_KINDS, type VisiblePurchaseKind } from "@/lib/schemas/purchases";
import type { PurchaseKind } from "@/lib/schemas/purchases";

/** Neutral grey for the « no category » bucket: a category colour never travels alone. */
const NO_CATEGORY_COLOR = "#8A99AC";

export type ExpensesData = {
  rows: ExpenseRow[];
  lines: ExpenseLine[];
  previousTotal: number;
  cumulativeTotal: number;
  firstDate: string | null;
  moreHref: string | null;
};

/**
 * Dépenses (E5-5, D33): **one** money list. A total, the categories in descending order with
 * a proportional bar, one comparison with the previous period, then every line — the cost of
 * an intervention, a purchase, a haul-out — each linking back to what it paid for.
 * No pivot table (audit §3.4): the question is « où est parti l'argent ».
 */
export async function ExpensesTab({
  boatId,
  period,
  range,
  sources,
  kind,
  categoryId,
  categories,
  data,
  canWrite,
  filtered,
}: {
  boatId: string;
  period: ExpensePeriod;
  range: DateRange;
  sources: ExpenseSource[];
  kind: PurchaseKind | null;
  categoryId: string | null;
  categories: CategoryChoice[];
  data: ExpensesData;
  canWrite: boolean;
  /** true when a filter is narrowing the list: the empty state must not offer creation. */
  filtered: boolean;
}) {
  const [t, tp] = await Promise.all([
    getTranslations("supplies.expenses"),
    getTranslations("supplies.period"),
  ]);
  const tk = await getTranslations("purchaseKind");
  // What the fold is hiding, in one line: a filter that is on must be readable without opening
  // anything, or folding the panel would quietly change what the totals below mean.
  const filterSummary = [
    tp(period),
    sources.length === 0 || sources.length === 3
      ? null
      : sources.map((source) => t(`sources.${source}`)).join(" · "),
    kind && (VISIBLE_PURCHASE_KINDS as readonly string[]).includes(kind)
      ? tk(kind as VisiblePurchaseKind)
      : null,
    categoryId ? (categories.find((c) => c.id === categoryId)?.name ?? null) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const total = totalAmount(data.rows);
  const categoryTotals = groupByCategory(data.rows, t("uncategorized"), NO_CATEGORY_COLOR);
  const change = variation(total, data.previousTotal);

  // The card carries the previous figure; the variation is the sentence under it.
  const comparison =
    data.previousTotal <= 0
      ? t("comparison.none")
      : change === null || Math.abs(change) < 0.005
        ? t("comparison.flat")
        : t(change > 0 ? "comparison.up" : "comparison.down", {
            percent: formatPercent(Math.abs(change)),
          });

  return (
    <div className="flex flex-col gap-6">
      {/* Folded (D46). Four groups of chips stacked to roughly 600 px on a 360 px phone: opening
          Dépenses showed filters and not one euro. The heading says what is currently kept, so
          the fold never hides an active filter — and the money is the first thing on screen. */}
      <Accordion
        type="single"
        collapsible
        className="rounded-xl border border-border bg-surface px-4 shadow-sm sm:px-5"
      >
        <AccordionItem value="filters" className="border-b-0">
          <AccordionTrigger className="text-body">
            <span className="flex min-w-0 flex-col items-start gap-0.5 text-left">
              <span className="font-medium">{t("filters.title")}</span>
              <span className="text-caption font-normal text-ink-2">{filterSummary}</span>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <ExpenseFilters
              boatId={boatId}
              period={period}
              range={range}
              sources={sources}
              kind={kind}
              categoryId={categoryId}
              categories={categories}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("total")}
          value={formatCurrency(total)}
          hint={
            period === "all"
              ? t("lines", { count: data.rows.length })
              : tp("range", { from: formatDate(range.from), to: formatDate(range.to) })
          }
        />
        <StatCard
          label={t("comparison.label")}
          value={data.previousTotal > 0 ? formatCurrency(data.previousTotal) : "—"}
          hint={comparison}
        />
        <StatCard
          label={t("cumulative.label")}
          value={formatCurrency(data.cumulativeTotal)}
          hint={
            data.firstDate
              ? t("cumulative.since", { date: formatDate(data.firstDate) })
              : t("cumulative.none")
          }
        />
      </div>

      {categoryTotals.length > 0 ? (
        <SectionCard
          title={t("byCategory")}
          action={
            <ExportExpensesButton
              boatId={boatId}
              range={range}
              sources={sources}
              disabled={data.rows.length === 0}
            />
          }
          footer={t("lines", { count: data.rows.length })}
        >
          <ul>
            {categoryTotals.map((category) => (
              <li
                key={category.id || "none"}
                className="flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-body font-medium">
                    <CategoryDot color={category.color} />
                    <span className="truncate">{category.name}</span>
                  </span>
                  <span className="shrink-0 num text-num-sm font-semibold">
                    {formatCurrency(category.amount)}
                  </span>
                </div>
                <ProgressBar
                  ratio={total > 0 ? category.amount / total : 0}
                  color={category.color}
                  label={category.name}
                />
              </li>
            ))}
          </ul>
        </SectionCard>
      ) : null}

      <SectionCard title={t("linesTitle")} bare>
        <ExpenseLines
          boatId={boatId}
          lines={data.lines}
          canWrite={canWrite}
          filtered={filtered}
          moreHref={data.moreHref}
        />
      </SectionCard>
    </div>
  );
}
