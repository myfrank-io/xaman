"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { CategoryDot } from "@/components/common/CategoryBadge";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import type { LogFormEngine } from "@/components/logs/log-form-values";
import { suggestLogTitles, type TitleSuggestion } from "@/lib/actions/logs";

const DEBOUNCE_MS = 150;
const MIN_CHARS = 2;

/**
 * Titles already used on this boat (ux-flows §4.6). Never a `<datalist>`: Safari iOS renders it
 * partially and it cannot be styled — and a suggestion here carries three fields, not one.
 * Rows of 56 px: title, category (dot + name), engine, number of occurrences.
 */
export function TitleSuggestions({
  boatId,
  query,
  categories,
  engines,
  onPick,
}: {
  boatId: string;
  query: string;
  categories: CategoryChoice[];
  engines: LogFormEngine[];
  onPick: (suggestion: TitleSuggestion) => void;
}) {
  const t = useTranslations("logs.form");
  // The answer is kept with the query it answers: a stale list is never shown while the next
  // one is in flight, and nothing has to be cleared from inside the effect.
  const [answer, setAnswer] = useState<{ query: string; items: TitleSuggestion[] }>({
    query: "",
    items: [],
  });
  const trimmed = query.trim();

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < MIN_CHARS) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void suggestLogTitles({ boatId, query: needle }).then((result) => {
        if (cancelled) return;
        setAnswer({
          query: needle,
          items: result.ok ? result.data.filter((row) => row.title !== needle) : [],
        });
      });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [boatId, query]);

  const items = answer.query === trimmed && trimmed.length >= MIN_CHARS ? answer.items : [];
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
              // The finger goes to the suggestion before the blur fires: keep the pick.
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
