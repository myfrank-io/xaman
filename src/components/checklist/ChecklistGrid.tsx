import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";

import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Badge } from "@/components/ui/badge";
import { categoryPath } from "@/lib/queries/boat-routes";

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

// Fixed-order grid of the boat's systems (E4-3, D21): the position is the memory.
export async function ChecklistGrid({
  boatId,
  categories,
}: {
  boatId: string;
  categories: CategoryProgress[];
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
    </div>
  );
}
