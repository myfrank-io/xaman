"use client";

import { useTranslations } from "next-intl";

import { CategoryDot } from "@/components/common/CategoryBadge";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { LogFormEngine } from "@/components/logs/log-form-values";
import type { TitleSuggestion } from "@/lib/actions/logs";

/**
 * The list under the title field (ux-flows §4.6). Never a `<datalist>`: Safari iOS renders it
 * partially and it cannot be styled — and a suggestion here fills three fields, not one.
 * Rows of 56 px: title, category (dot + name), engine, number of occurrences.
 * Purely presentational: `useTitleSuggestions()` does the lookup.
 */
export function TitleSuggestions({
  items,
  categories,
  engines,
  onPick,
}: {
  items: TitleSuggestion[];
  categories: CategoryChoice[];
  engines: LogFormEngine[];
  onPick: (suggestion: TitleSuggestion) => void;
}) {
  const t = useTranslations("logs.form");

  if (items.length === 0) return null;

  return (
    <ul
      aria-label={t("suggestions.label")}
      className="overflow-hidden rounded-lg border border-border bg-surface shadow-sm"
    >
      {items.map((item) => {
        const category = categories.find((row) => row.id === item.categoryId);
        const engine = engines.find((row) => row.id === item.engineId);
        return (
          <li key={item.title}>
            <button
              type="button"
              // The finger reaches the suggestion before the blur fires: keep the pick.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(item)}
              className="flex min-h-14 w-full items-center gap-3 border-b border-border tap-feedback px-3 text-left last:border-b-0 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-body font-medium">{item.title}</span>
                <span className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-ink-2">
                  {category ? <CategoryDot color={category.color} /> : null}
                  <span className="truncate">
                    {[category?.name, engine?.label].filter(Boolean).join(" · ")}
                  </span>
                </span>
              </span>
              <span className="shrink-0 num text-caption text-ink-3">
                {t("suggestions.occurrences", { count: item.occurrences })}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
