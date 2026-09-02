"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { SearchIcon, XIcon } from "lucide-react";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { LOG_STATUSES } from "@/lib/schemas/logs";
import { logsPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

export type LogsFilters = {
  tab: "history" | "planned";
  q: string;
  category: string;
  status: string;
  review: boolean;
  contact: string;
};

/** Every filter travels in the URL, so a filtered journal can be shared and reloaded. */
function hrefFor(boatId: string, filters: LogsFilters, next: Partial<LogsFilters>): string {
  const merged = { ...filters, ...next };
  return logsPath(boatId, {
    tab: merged.tab === "history" ? undefined : merged.tab,
    q: merged.q || undefined,
    category: merged.category || undefined,
    status: merged.status || undefined,
    // `review` is reserved for the guided review screen: the filter travels as `check`
    check: merged.review ? 1 : undefined,
    contact: merged.contact || undefined,
  });
}

/**
 * Search and filters of the journal (E3-2), all persisted in the URL so a filtered list can be
 * shared, reloaded and reached from the contact sheet (`?contact=`). The « À vérifier N » chip
 * only exists while rows remain to be checked.
 */
export function LogsToolbar({
  boatId,
  filters,
  categories,
  reviewCount,
  contactName,
}: {
  boatId: string;
  filters: LogsFilters;
  categories: CategoryChoice[];
  reviewCount: number;
  contactName: string | null;
}) {
  const t = useTranslations("logs");
  const ts = useTranslations("logStatus");
  const router = useRouter();
  const [query, setQuery] = useState(filters.q);
  const typed = useRef(false);

  function go(next: Partial<LogsFilters>) {
    router.replace(hrefFor(boatId, filters, next) as Parameters<typeof router.replace>[0]);
  }

  // The search box does not submit: it rewrites the URL 300 ms after the last key.
  useEffect(() => {
    if (!typed.current || query === filters.q) return;
    const timer = setTimeout(
      () =>
        router.replace(
          hrefFor(boatId, filters, { q: query }) as Parameters<typeof router.replace>[0],
        ),
      SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [query, filters, boatId, router]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <SearchIcon
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-3"
          aria-hidden
        />
        <Input
          type="search"
          value={query}
          aria-label={t("searchLabel")}
          placeholder={t("search")}
          autoComplete="off"
          enterKeyHint="search"
          className="pl-10"
          onChange={(event) => {
            typed.current = true;
            setQuery(event.target.value);
          }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label={t("filters.category")}
          value={filters.category}
          className="w-auto min-w-44"
          onChange={(event) => go({ category: event.target.value })}
        >
          <option value="">{t("filters.allCategories")}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          aria-label={t("filters.status")}
          value={filters.status}
          className="w-auto min-w-36"
          onChange={(event) => go({ status: event.target.value })}
        >
          <option value="">{t("filters.allStatuses")}</option>
          {LOG_STATUSES.map((status) => (
            <option key={status} value={status}>
              {ts(status)}
            </option>
          ))}
        </NativeSelect>
        {reviewCount > 0 ? (
          <Button
            type="button"
            variant="outline"
            aria-pressed={filters.review}
            onClick={() => go({ review: !filters.review })}
            className={cn(
              "border-state-soon-border text-state-soon-fg",
              filters.review && "bg-state-soon-tint font-semibold",
            )}
          >
            {t("filters.review", { count: reviewCount })}
          </Button>
        ) : null}
        {filters.contact && contactName ? (
          <Button type="button" variant="outline" onClick={() => go({ contact: "" })}>
            {t("filters.contact", { name: contactName })}
            <XIcon />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
