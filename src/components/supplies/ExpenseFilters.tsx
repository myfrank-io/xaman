"use client";

import { useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

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

/**
 * Period and source of the expenses tab (E5-5). Everything is written to the URL: the state
 * survives a reload and can be shared, and the server reads it once (ux-flows §1.2).
 */
export function ExpenseFilters({
  boatId,
  period,
  range,
  sources,
}: {
  boatId: string;
  period: ExpensePeriod;
  range: DateRange;
  sources: ExpenseSource[];
}) {
  const t = useTranslations("supplies.expenses");
  const tp = useTranslations("supplies.period");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function push(next: { period?: ExpensePeriod; range?: DateRange; sources?: ExpenseSource[] }) {
    const nextPeriod = next.period ?? period;
    const nextRange = next.range ?? range;
    const nextSources = next.sources ?? sources;
    startTransition(() => {
      router.replace(
        suppliesPath(boatId, "expenses", {
          period: nextPeriod === "rolling12" ? undefined : nextPeriod,
          from: nextPeriod === "custom" ? nextRange.from : undefined,
          to: nextPeriod === "custom" ? nextRange.to : undefined,
          source: nextSources.length === EXPENSE_SOURCES.length ? undefined : nextSources.join(","),
        }) as Route,
      );
    });
  }

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
        <Label>{t("sources.label")}</Label>
        <ToggleGroup
          type="multiple"
          value={sources}
          aria-label={t("sources.label")}
          className="flex-wrap justify-start"
          onValueChange={(values) => {
            // Deselecting the last chip would show nothing at all: fall back to « all ».
            const next = values.filter((value): value is ExpenseSource =>
              EXPENSE_SOURCES.includes(value as ExpenseSource),
            );
            push({ sources: next.length > 0 ? next : [...EXPENSE_SOURCES] });
          }}
        >
          {EXPENSE_SOURCES.map((source) => (
            <ToggleGroupItem key={source} value={source} className="min-h-11">
              {t(`sources.${source}`)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </div>
  );
}
