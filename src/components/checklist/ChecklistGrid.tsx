import Link from "next/link";
import type { Route } from "next";
import { PackageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Badge } from "@/components/ui/badge";
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

// Fixed-order grid of the boat's systems (E4-3, D21): the position is the memory.
export async function ChecklistGrid({
  boatId,
  categories,
  stock,
}: {
  boatId: string;
  categories: CategoryProgress[];
  /** Absent when the boat holds no parts: an empty card would only take a place. */
  stock?: StockSummary | null;
}) {
  const t = await getTranslations("checklist.card");
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => {
        const neverDone = category.total > 0 && category.neverRecorded === category.total;
        return (
          <Link
            key={category.id}
            href={categoryPath(boatId, category.id) as Route}
            className="flex min-h-36 flex-col gap-3 rounded-xl border border-border tap-feedback bg-surface p-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-2">
              <CategoryIcon color={category.color} icon={category.icon} />
              {category.overdue > 0 ? (
                <Badge variant="destructive" size="sm">
                  {t("overdue", { count: category.overdue })}
                </Badge>
              ) : null}
            </div>
            <div className="min-w-0">
              <h2 className="text-h3 leading-tight">{category.name}</h2>
              <p className="num text-caption text-ink-2">
                {t("points", { count: category.total })}
                {category.punctual > 0 ? ` · ${t("punctual", { count: category.punctual })}` : ""}
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-1">
              <ProgressBar
                ratio={neverDone || category.total === 0 ? null : category.progress}
                color={category.color}
                label={category.name}
              />
              <p className="text-caption text-ink-2">
                {neverDone
                  ? t("neverDone")
                  : category.overdue === 0 && category.total > 0
                    ? t("upToDate")
                    : ""}
              </p>
            </div>
          </Link>
        );
      })}

      {/* The stock closes the grid. It is not a system and carries no progress bar — nothing is
          « due » about a shelf — but it is what you look for while planning the work these
          cards describe, so it sits where the eye already is rather than two taps away. Neutral
          on purpose: a category colour here would read as a ninth system (rule 12). */}
      {stock ? (
        <Link
          href={stockPath(boatId) as Route}
          className="flex min-h-36 flex-col gap-3 rounded-xl border border-border tap-feedback bg-surface p-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="flex size-9 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
              <PackageIcon className="size-5" aria-hidden />
            </span>
            {stock.low > 0 ? (
              <Badge variant="destructive" size="sm">
                {t("stockLow", { count: stock.low })}
              </Badge>
            ) : null}
          </div>
          <div className="min-w-0">
            <h2 className="text-h3 leading-tight">{t("stockTitle")}</h2>
            <p className="num text-caption text-ink-2">{t("stockParts", { count: stock.total })}</p>
          </div>
          <p className="mt-auto text-caption text-ink-2">
            {stock.low > 0 ? t("stockToBuy") : t("stockComplete")}
          </p>
        </Link>
      ) : null}
    </div>
  );
}
