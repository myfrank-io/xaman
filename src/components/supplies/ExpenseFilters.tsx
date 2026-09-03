"use client";

import { useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { Label } from "@/components/ui/label";
import { DateField } from "@/components/ui/date-field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  EXPENSE_PERIODS,
  EXPENSE_SOURCES,
  type DateRange,
  type ExpensePeriod,
  type ExpenseSource,
} from "@/lib/expenses";
import { suppliesPath } from "@/lib/queries/boat-routes";
import { VISIBLE_PURCHASE_KINDS, type PurchaseKind } from "@/lib/schemas/purchases";

const ALL = "";
/** Neutral grey for « toutes les catégories »: never a category colour standing alone. */
const ALL_COLOR = "#8A99AC";

/**
 * The filters of the single money list (D33): period, what the line paid for, the kind of a
 * purchase and the system. Everything is written to the URL — the state survives a reload,
 * can be shared, and the server reads it once (ux-flows §1.2).
 */
export function ExpenseFilters({
  boatId,
  period,
  range,
  sources,
  kind,
  categoryId,
  categories,
}: {
  boatId: string;
  period: ExpensePeriod;
  range: DateRange;
  sources: ExpenseSource[];
  kind: PurchaseKind | null;
  categoryId: string | null;
  categories: CategoryChoice[];
}) {
  const t = useTranslations("supplies.expenses");
  const tf = useTranslations("supplies.purchases.filters");
  const tk = useTranslations("purchaseKind");
  const tp = useTranslations("supplies.period");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function push(next: {
    period?: ExpensePeriod;
    range?: DateRange;
    sources?: ExpenseSource[];
    kind?: PurchaseKind | null;
    categoryId?: string | null;
  }) {
    const nextPeriod = next.period ?? period;
    const nextRange = next.range ?? range;
    const nextKind = next.kind === undefined ? kind : next.kind;
    const nextCategory = next.categoryId === undefined ? categoryId : next.categoryId;
    // A kind only exists on a purchase: picking one narrows the sources rather than
    // returning an empty list that nobody can explain.
    const nextSources = nextKind ? (["purchase"] as ExpenseSource[]) : (next.sources ?? sources);
    startTransition(() => {
      router.replace(
        suppliesPath(boatId, undefined, {
          period: nextPeriod === "all" ? undefined : nextPeriod,
          from: nextPeriod === "custom" ? nextRange.from : undefined,
          to: nextPeriod === "custom" ? nextRange.to : undefined,
          source:
            nextKind || nextSources.length === EXPENSE_SOURCES.length
              ? undefined
              : nextSources.join(","),
          kind: nextKind ?? undefined,
          category: nextCategory ?? undefined,
        }) as Route,
      );
    });
  }

  const choices: CategoryChoice[] = [
    { id: ALL, name: tf("allCategories"), color: ALL_COLOR },
    ...categories,
  ];

  return (
    <div className="flex flex-col gap-4" data-pending={pending ? "" : undefined}>
      <div className="grid gap-2">
        <Label>{tp("label")}</Label>
        <ToggleGroup
          type="single"
          value={period}
          aria-label={tp("label")}
          className="flex-wrap justify-start"
          onValueChange={(value) => value && push({ period: value as ExpensePeriod })}
        >
          {EXPENSE_PERIODS.map((option) => (
            <ToggleGroupItem key={option} value={option} className="min-h-11">
              {tp(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {period === "custom" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="expenses-from">{tp("from")}</Label>
            <DateField
              id="expenses-from"
              value={range.from}
              max={range.to}
              onValueChange={(value) => push({ range: { ...range, from: value } })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="expenses-to">{tp("to")}</Label>
            <DateField
              id="expenses-to"
              value={range.to}
              min={range.from}
              onValueChange={(value) => push({ range: { ...range, to: value } })}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label>{t("paidFor")}</Label>
        <ToggleGroup
          type="multiple"
          value={kind ? ["purchase"] : sources}
          aria-label={t("paidFor")}
          className="flex-wrap justify-start"
          onValueChange={(values) => {
            // Deselecting the last chip would show nothing at all: fall back to « all ».
            const next = values.filter((value): value is ExpenseSource =>
              EXPENSE_SOURCES.includes(value as ExpenseSource),
            );
            push({ sources: next.length > 0 ? next : [...EXPENSE_SOURCES], kind: null });
          }}
        >
          {EXPENSE_SOURCES.map((source) => (
            <ToggleGroupItem key={source} value={source} className="min-h-11">
              {t(`sources.${source}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2">
        <Label>{tf("kind")}</Label>
        <ToggleGroup
          type="single"
          value={kind ?? ALL}
          aria-label={tf("kind")}
          className="flex-wrap justify-start"
          onValueChange={(value) => push({ kind: value === ALL ? null : (value as PurchaseKind) })}
        >
          <ToggleGroupItem value={ALL} className="min-h-11">
            {tf("allKinds")}
          </ToggleGroupItem>
          {VISIBLE_PURCHASE_KINDS.map((option) => (
            <ToggleGroupItem key={option} value={option} className="min-h-11">
              {tk(option)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid gap-2">
        <Label>{tf("category")}</Label>
        <CategoryChips
          categories={choices}
          value={categoryId ?? ALL}
          label={tf("category")}
          onValueChange={(id) => push({ categoryId: id === ALL ? null : id })}
        />
      </div>
    </div>
  );
}
