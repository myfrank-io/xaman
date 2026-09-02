import Link from "next/link";
import type { Route } from "next";
import { EuroIcon, SearchIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ProgressBar } from "@/components/common/ProgressBar";
import { SectionCard } from "@/components/common/SectionCard";
import { StatCard } from "@/components/common/StatCard";
import { Button } from "@/components/ui/button";
import { ExpenseFilters } from "@/components/supplies/ExpenseFilters";
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
import { suppliesPath } from "@/lib/queries/boat-routes";

/** Neutral grey for the « no category » bucket: a category colour never travels alone. */
const NO_CATEGORY_COLOR = "#8A99AC";

export type ExpensesData = {
  rows: ExpenseRow[];
  previousTotal: number;
  cumulativeTotal: number;
  firstDate: string | null;
};

/**
 * Expenses tab (E5-5): a total, the categories in descending order with a proportional bar,
 * one comparison with the previous period and the running total. No pivot table (audit §3.4)
 * — the question is « où est parti l'argent », not « croisez-moi ces axes ».
 */
export async function ExpensesTab({
  boatId,
  period,
  range,
  sources,
  data,
  filtered,
}: {
  boatId: string;
  period: ExpensePeriod;
  range: DateRange;
  sources: ExpenseSource[];
  data: ExpensesData;
  /** true when a filter is narrowing the list: the empty state must not offer creation. */
  filtered: boolean;
}) {
  const [t, tp] = await Promise.all([
    getTranslations("supplies.expenses"),
    getTranslations("supplies.period"),
  ]);
  const total = totalAmount(data.rows);
  const categories = groupByCategory(data.rows, t("uncategorized"), NO_CATEGORY_COLOR);
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
      <div className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5">
        <ExpenseFilters boatId={boatId} period={period} range={range} sources={sources} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          label={t("total")}
          value={formatCurrency(total)}
          hint={tp("range", { from: formatDate(range.from), to: formatDate(range.to) })}
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
        bare={categories.length === 0}
        footer={t("lines", { count: data.rows.length })}
      >
        {categories.length === 0 ? (
          <EmptyState
            variant={filtered ? "filtered" : "initial"}
            icon={filtered ? <SearchIcon aria-hidden /> : <EuroIcon aria-hidden />}
            title={filtered ? t("emptyFiltered") : t("emptyTitle")}
            description={filtered ? undefined : t("emptyDescription")}
            // A filtered empty state offers the way out, never a creation (ux-flows §5.1).
            action={
              filtered ? (
                <Button asChild variant="outline">
                  <Link href={suppliesPath(boatId, "expenses") as Route}>{t("clearFilters")}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <ul>
            {categories.map((category) => (
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
        )}
      </SectionCard>
    </div>
  );
}
