"use client";

import { useTranslations } from "next-intl";
import { ArrowLeftRightIcon } from "lucide-react";

import type { ReviewHourContext } from "@/components/review/review-rows";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { formatDayMonth, formatHours } from "@/lib/format";
import { parseDecimal } from "@/lib/numbers";

/**
 * The hours of one imported line, engine by engine (ux-flows §3i). The decisive part is the
 * « contexte » line: the previous validated reading and the next pending one, so the value is
 * read inside its series instead of on its own. A value going backwards is stated in red — it
 * is not blocked: a replaced counter is a legitimate reason.
 */
export function ReviewHoursCell({
  hours,
  values,
  ignored,
  onValueChange,
  onIgnoredChange,
  onSwap,
}: {
  hours: ReviewHourContext[];
  values: Record<string, string>;
  ignored: Record<string, boolean>;
  onValueChange: (engineId: string, raw: string) => void;
  onIgnoredChange: (engineId: string, next: boolean) => void;
  onSwap: () => void;
}) {
  const t = useTranslations("review");

  return (
    <div className="flex flex-col gap-3">
      {hours.length >= 2 ? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onSwap}>
            <ArrowLeftRightIcon />
            {t("swap", { a: hours[0]?.engineLabel ?? "", b: hours[1]?.engineLabel ?? "" })}
          </Button>
        </div>
      ) : null}
      {hours.map((entry) => {
        const raw = values[entry.engineId] ?? "";
        const typed = parseDecimal(raw);
        const isIgnored = ignored[entry.engineId] === true;
        const backwards =
          !isIgnored &&
          typeof typed === "number" &&
          entry.previous !== null &&
          typed < entry.previous.hours;
        return (
          <div key={entry.engineId} className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-24 text-label font-medium text-foreground">
                {entry.engineLabel}
              </span>
              <span className="min-w-24 num text-caption text-ink-3">
                {entry.bookHours === null
                  ? "—"
                  : t("bookValue", { hours: formatHours(entry.bookHours) })}
              </span>
              <NumericField
                aria-label={entry.engineLabel}
                value={raw}
                disabled={isIgnored}
                suffix="h"
                containerClassName="w-36"
                onValueChange={(next) => onValueChange(entry.engineId, next)}
              />
              <span className="flex items-center gap-2">
                <Checkbox
                  id={`ignore-${entry.engineId}`}
                  checked={isIgnored}
                  onCheckedChange={(next) => onIgnoredChange(entry.engineId, next === true)}
                />
                <Label htmlFor={`ignore-${entry.engineId}`} className="text-caption text-ink-2">
                  {t("ignore")}
                </Label>
              </span>
            </div>
            <p className="num text-caption text-ink-3">
              {[
                entry.previous
                  ? t("contextPrevious", {
                      hours: formatHours(entry.previous.hours),
                      date: formatDayMonth(entry.previous.date),
                    })
                  : t("contextNone"),
                entry.next
                  ? t("contextNext", {
                      hours: formatHours(entry.next.hours),
                      date: formatDayMonth(entry.next.date),
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {backwards && entry.previous ? (
              <p className="text-caption font-medium text-state-overdue-fg">
                {t("backwards", {
                  hours: formatHours(entry.previous.hours - (typed as number)),
                })}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
