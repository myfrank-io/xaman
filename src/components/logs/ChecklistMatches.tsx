"use client";

import { useTranslations } from "next-intl";

import { DueLabel } from "@/components/common/DueLabel";
import { Checkbox } from "@/components/ui/checkbox";
import type { ItemSuggestion } from "@/lib/actions/logs";
import { cn } from "@/lib/utils";

/**
 * « Points de checklist concernés » (E3-3b, D3): the points of the chosen category whose label
 * matches the title, pre-ticked. A point counted in engine hours cannot be ticked without the
 * hours of its engine (the database refuses it): the line stays visible, greyed, and says why —
 * greying is never `opacity-50`, which vanishes in full sun.
 */
export function ChecklistMatches({
  items,
  checked,
  hoursByEngine,
  onToggle,
}: {
  items: ItemSuggestion[];
  checked: string[];
  /** Raw hours typed per engine id; an empty string means « not typed ». */
  hoursByEngine: Record<string, string>;
  onToggle: (itemId: string, next: boolean) => void;
}) {
  const t = useTranslations("logs.form.items");
  const tu = useTranslations("units");

  if (items.length === 0) return null;

  return (
    <fieldset className="flex min-w-0 flex-col gap-2">
      <legend className="text-label font-semibold text-ink-2">{t("title")}</legend>
      <p className="mb-1 text-caption text-ink-3">{t("help")}</p>
      <ul className="overflow-hidden rounded-lg border border-border bg-surface">
        {items.map((item) => {
          const missingHours =
            item.intervalHours !== null &&
            (!item.engineId || (hoursByEngine[item.engineId] ?? "").trim() === "");
          const isChecked = checked.includes(item.id) && !missingHours;
          return (
            <li
              key={item.id}
              className={cn(
                "flex min-h-16 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0",
                missingHours && "bg-n-50",
              )}
            >
              <Checkbox
                id={`match-${item.id}`}
                checked={isChecked}
                disabled={missingHours}
                onCheckedChange={(next) => onToggle(item.id, next === true)}
              />
              <label
                htmlFor={`match-${item.id}`}
                className="min-w-0 flex-1 cursor-pointer select-none"
              >
                <span className="block text-body font-medium text-foreground">{item.label}</span>
                <span className="mt-0.5 block truncate text-caption text-ink-2">
                  {missingHours
                    ? t("needHours", { engine: item.engineLabel ?? "" })
                    : [
                        item.intervalMonths
                          ? tu("everyMonths", { count: item.intervalMonths })
                          : null,
                        item.intervalHours ? tu("everyHours", { count: item.intervalHours }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
              </label>
              <DueLabel
                status={item.status}
                daysRemaining={item.daysRemaining}
                hoursRemaining={item.hoursRemaining}
                hasCounter={item.currentHours !== null}
                className="shrink-0"
              />
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}
