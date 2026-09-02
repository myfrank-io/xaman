"use client";

import { useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { DateField } from "@/components/ui/date-field";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { DateRange } from "@/lib/expenses";
import { PURCHASE_PERIODS, type PurchasePeriod } from "@/lib/purchases";
import { suppliesPath } from "@/lib/queries/boat-routes";
import { VISIBLE_PURCHASE_KINDS, type PurchaseKind } from "@/lib/schemas/purchases";

const ALL = "";
/** Neutral grey for « toutes les catégories »: never a category colour standing alone. */
const ALL_COLOR = "#8A99AC";

/**
 * Type, category and period of the purchases list (E5-2), all three in the URL. The gas
 * entry of the app is exactly `kind=gas` here — one screen, one filter, no fourth tab (E5-1).
 */
export function PurchaseFilters({
  boatId,
  categories,
  kind,
  categoryId,
  period,
  range,
}: {
  boatId: string;
  categories: CategoryChoice[];
  kind: PurchaseKind | null;
  categoryId: string | null;
  period: PurchasePeriod;
  range: DateRange;
}) {
  const t = useTranslations("supplies.purchases.filters");
  const tk = useTranslations("purchaseKind");
  const tp = useTranslations("supplies.period");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function push(next: {
    kind?: PurchaseKind | null;
    categoryId?: string | null;
    period?: PurchasePeriod;
    range?: DateRange;
  }) {
    const nextKind = next.kind === undefined ? kind : next.kind;
    const nextCategory = next.categoryId === undefined ? categoryId : next.categoryId;
    const nextPeriod = next.period ?? period;
    const nextRange = next.range ?? range;
    startTransition(() => {
      router.replace(
        suppliesPath(boatId, "purchases", {
          kind: nextKind ?? undefined,
          category: nextCategory ?? undefined,
          period: nextPeriod === "all" ? undefined : nextPeriod,
          from: nextPeriod === "custom" ? nextRange.from : undefined,
          to: nextPeriod === "custom" ? nextRange.to : undefined,
        }) as Route,
      );
    });
  }

  const choices: CategoryChoice[] = [
    { id: ALL, name: t("allCategories"), color: ALL_COLOR },
    ...categories,
  ];

  return (
    <div className="flex flex-col gap-4" data-pending={pending ? "" : undefined}>
      <div className="grid gap-2">
        <Label>{t("kind")}</Label>
        <ToggleGroup
          type="single"
          value={kind ?? ALL}
          aria-label={t("kind")}
          className="flex-wrap justify-start"
          onValueChange={(value) =>
            push({ kind: value === ALL || value === "" ? null : (value as PurchaseKind) })
          }
        >
          <ToggleGroupItem value={ALL} className="min-h-11">
            {t("allKinds")}
          </ToggleGroupItem>
          {VISIBLE_PURCHASE_KINDS.map((option) => (
            <ToggleGroupItem key={option} value={option} className="min-h-11">
              {tk(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2">
        <Label>{t("category")}</Label>
        <CategoryChips
          categories={choices}
          value={categoryId ?? ALL}
          label={t("category")}
          onValueChange={(id) => push({ categoryId: id === ALL ? null : id })}
        />
      </div>

      <div className="grid gap-2">
        <Label>{tp("label")}</Label>
        <ToggleGroup
          type="single"
          value={period}
          aria-label={tp("label")}
          className="flex-wrap justify-start"
          onValueChange={(value) => value && push({ period: value as PurchasePeriod })}
        >
          {PURCHASE_PERIODS.map((option) => (
            <ToggleGroupItem key={option} value={option} className="min-h-11">
              {tp(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {period === "custom" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="purchases-from">{tp("from")}</Label>
            <DateField
              id="purchases-from"
              value={range.from}
              max={range.to}
              onValueChange={(value) => push({ range: { ...range, from: value } })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="purchases-to">{tp("to")}</Label>
            <DateField
              id="purchases-to"
              value={range.to}
              min={range.from}
              onValueChange={(value) => push({ range: { ...range, to: value } })}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
