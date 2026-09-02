"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CircleCheckIcon } from "lucide-react";

import { CategoryDot } from "@/components/common/CategoryBadge";
import { EmptyState } from "@/components/common/EmptyState";
import { ReviewHoursCell } from "@/components/review/ReviewHoursCell";
import type { ReviewLog, ReviewPurchase } from "@/components/review/review-rows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { submitReview, type ReviewSummary } from "@/lib/actions/review";
import { numberToInput } from "@/components/forms/form-values";
import { todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { logsPath, logsReviewPath } from "@/lib/queries/boat-routes";

type LogState = {
  performedAt: string;
  hours: Record<string, string>;
  ignored: Record<string, boolean>;
};

type PurchaseState = {
  purchasedAt: string;
  designation: string;
  amount: string;
  keep: boolean;
};

/**
 * « Reprise du carnet » (E3-7, D24): the imported lines in chronological order — each validation
 * creates a reading that lights the next line — corrected and validated in ONE submission.
 * Ordering matters more than anything here: it is what makes the context lines true.
 */
export function ReviewTable({
  boatId,
  logs,
  purchases,
  singleLog = false,
}: {
  boatId: string;
  logs: ReviewLog[];
  purchases: ReviewPurchase[];
  /** Reached from a detail page (`?log=`): only that line is on screen. */
  singleLog?: boolean;
}) {
  const t = useTranslations("review");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const [logState, setLogState] = useState<Record<string, LogState>>(() =>
    Object.fromEntries(
      logs.map((log) => [
        log.id,
        {
          performedAt: log.performedAt,
          hours: Object.fromEntries(
            log.hours.map((entry) => [entry.engineId, numberToInput(entry.bookHours)]),
          ),
          ignored: {},
        },
      ]),
    ),
  );
  const [purchaseState, setPurchaseState] = useState<Record<string, PurchaseState>>(() =>
    Object.fromEntries(
      purchases.map((purchase) => [
        purchase.id,
        {
          purchasedAt: purchase.purchasedAt,
          designation: purchase.designation,
          amount: numberToInput(purchase.amount),
          keep: true,
        },
      ]),
    ),
  );

  function patchLog(id: string, patch: Partial<LogState>) {
    setLogState((state) => ({ ...state, [id]: { ...state[id]!, ...patch } }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await submitReview({
        boatId,
        logs: logs.map((log) => {
          const state = logState[log.id]!;
          return {
            logId: log.id,
            performedAt: state.performedAt,
            hours: log.hours
              .filter((entry) => !state.ignored[entry.engineId])
              .map((entry) => ({
                engineId: entry.engineId,
                hours: state.hours[entry.engineId] ?? "",
              })),
          };
        }),
        purchases: purchases
          .filter((purchase) => purchaseState[purchase.id]?.keep)
          .map((purchase) => {
            const state = purchaseState[purchase.id]!;
            return {
              purchaseId: purchase.id,
              purchasedAt: state.purchasedAt,
              designation: state.designation,
              amount: state.amount,
            };
          }),
      });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      setSummary(result.data);
      router.refresh();
    });
  }

  if (summary) {
    return (
      <EmptyState
        variant="positive"
        icon={<CircleCheckIcon />}
        title={t("submitted", { logs: summary.logs, readings: summary.readings })}
        action={
          <Button asChild>
            <Link href={logsPath(boatId) as Route}>{t("backToLogs")}</Link>
          </Button>
        }
      />
    );
  }

  if (logs.length === 0 && purchases.length === 0) {
    return (
      <EmptyState
        variant="positive"
        icon={<CircleCheckIcon />}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
        action={
          <Button asChild variant="outline">
            <Link href={logsPath(boatId) as Route}>{t("backToLogs")}</Link>
          </Button>
        }
      />
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" noValidate>
      {singleLog ? (
        <Alert>
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("onlyOne")}</span>
            <Button asChild size="sm" variant="outline">
              <Link href={logsReviewPath(boatId) as Route}>{t("allRows")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {logs.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-overline text-ink-2 uppercase">{t("logsTitle")}</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full min-w-[46rem] border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {t("columns.date")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {t("columns.log")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {t("columns.hours")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const state = logState[log.id]!;
                  return (
                    <tr key={log.id} className="border-b border-border align-top last:border-b-0">
                      <td className="px-4 py-4">
                        <Input
                          type="date"
                          aria-label={t("columns.date")}
                          value={state.performedAt}
                          max={todayString()}
                          className="w-40 num"
                          onChange={(event) =>
                            patchLog(log.id, { performedAt: event.target.value })
                          }
                        />
                      </td>
                      <td className="px-4 py-4">
                        <span className="block text-body font-medium text-foreground">
                          {log.title}
                        </span>
                        <span className="mt-1 flex items-center gap-1.5 text-caption text-ink-2">
                          {log.categoryColor ? <CategoryDot color={log.categoryColor} /> : null}
                          <span>{log.categoryName ?? ""}</span>
                        </span>
                        {log.notes ? (
                          <span className="mt-1 block max-w-md text-caption whitespace-pre-wrap text-ink-3">
                            {log.notes}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-4">
                        <ReviewHoursCell
                          hours={log.hours}
                          values={state.hours}
                          ignored={state.ignored}
                          onValueChange={(engineId, raw) =>
                            patchLog(log.id, { hours: { ...state.hours, [engineId]: raw } })
                          }
                          onIgnoredChange={(engineId, next) =>
                            patchLog(log.id, { ignored: { ...state.ignored, [engineId]: next } })
                          }
                          onSwap={() => {
                            const [a, b] = log.hours;
                            if (!a || !b) return;
                            patchLog(log.id, {
                              hours: {
                                ...state.hours,
                                [a.engineId]: state.hours[b.engineId] ?? "",
                                [b.engineId]: state.hours[a.engineId] ?? "",
                              },
                            });
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {purchases.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-overline text-ink-2 uppercase">{t("purchasesTitle")}</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-surface shadow-sm">
            <table className="w-full min-w-[40rem] border-collapse">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {t("columns.date")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {t("columns.designation")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {t("columns.amount")}
                  </th>
                  <th scope="col" className="px-4 py-3 text-caption font-semibold text-ink-2">
                    {tc("confirm")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => {
                  const state = purchaseState[purchase.id]!;
                  const patch = (next: Partial<PurchaseState>) =>
                    setPurchaseState((current) => ({
                      ...current,
                      [purchase.id]: { ...current[purchase.id]!, ...next },
                    }));
                  return (
                    <tr key={purchase.id} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <Input
                          type="date"
                          aria-label={t("columns.date")}
                          value={state.purchasedAt}
                          max={todayString()}
                          className="w-40 num"
                          onChange={(event) => patch({ purchasedAt: event.target.value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          aria-label={t("columns.designation")}
                          value={state.designation}
                          autoComplete="off"
                          onChange={(event) => patch({ designation: event.target.value })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <NumericField
                          aria-label={t("columns.amount")}
                          value={state.amount}
                          suffix="€"
                          containerClassName="w-36"
                          onValueChange={(raw) => patch({ amount: raw })}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <Checkbox
                            id={`keep-${purchase.id}`}
                            checked={state.keep}
                            onCheckedChange={(next) => patch({ keep: next === true })}
                          />
                          <Label htmlFor={`keep-${purchase.id}`} className="sr-only">
                            {tc("confirm")}
                          </Label>
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="sticky bottom-0 z-20 -mx-4 flex justify-end border-t border-border bg-surface px-4 py-3 sm:-mx-6 sm:px-6">
        <Button type="submit" size="xl" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          {pending
            ? tc("saving")
            : t("submit", {
                count: logs.length + purchases.filter((row) => purchaseState[row.id]?.keep).length,
              })}
        </Button>
      </div>
    </form>
  );
}
