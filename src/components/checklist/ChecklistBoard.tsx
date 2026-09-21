"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckIcon, ChevronDownIcon, ChevronRightIcon, SearchIcon } from "lucide-react";

import {
  CompleteItemDialog,
  type CompletableItem,
  type CompletionMember,
  type SavedCompletion,
} from "./CompleteItemDialog";
import { toCompletable, type EngineReadDates } from "./completable";
import { type ChecklistRow, isDueToday, applyCompletion } from "./rows";
import {
  filterChecklist,
  isChecklistChecked,
  overlayCompletion,
  type CompletionOverlay,
  type ChecklistFilter,
} from "./board";
import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ChecklistStateBadge } from "@/components/common/ChecklistStateBadge";
import { ProgressBar } from "@/components/common/ProgressBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatDate, formatHours } from "@/lib/format";
import { handedSentence } from "./due-sentence";
import { categoryPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; color: string; icon: string | null };

/** D148: the checklist itself is the landing page. Completion stays a dated, auditable act. */
export function ChecklistBoard({
  boatId,
  categories,
  rows: serverRows,
  members,
  currentUserId,
  currentUserName,
  canContribute,
  engineReadDates,
  initialFilter = "all",
}: {
  boatId: string;
  categories: Category[];
  rows: ChecklistRow[];
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canContribute: boolean;
  engineReadDates?: EngineReadDates;
  initialFilter?: ChecklistFilter;
}) {
  const t = useTranslations("checklist");
  const tu = useTranslations("units");
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [filter, setFilter] = useState<ChecklistFilter>(initialFilter);
  const [categoryId, setCategoryId] = useState("");
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [completing, setCompleting] = useState<CompletableItem | null>(null);
  const [overlays, setOverlays] = useState<Map<string, CompletionOverlay>>(() => new Map());
  const rows = serverRows.map((row) => overlayCompletion(row, overlays.get(row.id)));
  function onCompleted(item: CompletableItem, completion: SavedCompletion) {
    const before = serverRows.find((row) => row.id === item.id);
    if (before)
      setOverlays((current) =>
        new Map(current).set(item.id, {
          before,
          completed: applyCompletion(before, completion),
          undone: false,
        }),
      );
    refresh();
  }
  function onUndone(item: CompletableItem) {
    setOverlays((current) => {
      const entry = current.get(item.id);
      return entry ? new Map(current).set(item.id, { ...entry, undone: true }) : current;
    });
    refresh();
  }
  const checked = rows.filter(isChecklistChecked).length;
  const visible = filterChecklist(rows, { filter, categoryId, search });
  const filters = ["all", "todo", "checked"] as const;

  function refresh() {
    startRefresh(() => router.refresh());
  }

  return (
    <div className="flex flex-col gap-3" aria-busy={refreshing}>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-h3 font-semibold">
            {t("board.progress", { count: checked, total: rows.length })}
          </p>
          <p className="text-caption text-ink-2">
            {t("board.remaining", { count: rows.length - checked })}
          </p>
        </div>
        <ProgressBar
          className="mt-3"
          ratio={rows.length ? checked / rows.length : null}
          label={t("board.progressLabel")}
        />
        <p className="mt-2 text-caption text-ink-2">{t("board.hint")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("board.filterLabel")}>
          {filters.map((value) => (
            <Button
              key={value}
              variant={filter === value ? "default" : "outline"}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {t(`board.filters.${value}`)}
              <span className="num">
                {value === "all"
                  ? rows.length
                  : value === "checked"
                    ? checked
                    : rows.length - checked}
              </span>
            </Button>
          ))}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-3 left-3 size-5 text-ink-3"
              aria-hidden
            />
            <Input
              aria-label={t("board.search")}
              placeholder={t("board.search")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pl-10"
            />
          </div>
          <select
            aria-label={t("board.category")}
            className="min-h-11 min-w-0 rounded-lg border border-border bg-surface px-3 text-base sm:max-w-64"
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t("board.allCategories")}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="text-caption text-ink-2" role="status">
        {t("board.results", { count: visible.length })}
      </p>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <p className="font-medium">{t(rows.length === 0 ? "emptyTitle" : "board.empty")}</p>
          {rows.length > 0 ? (
            <Button
              variant="link"
              onClick={() => {
                setFilter("all");
                setCategoryId("");
                setSearch("");
              }}
            >
              {t("board.reset")}
            </Button>
          ) : (
            <p className="mt-2 text-ink-2">{t("emptyDescription")}</p>
          )}
        </div>
      ) : null}
      {categories.map((category) => {
        const items = visible.filter((row) => row.categoryId === category.id);
        if (!items.length) return null;
        const groupRows = rows.filter((row) => row.categoryId === category.id);
        const done = groupRows.filter(isChecklistChecked).length;
        const closed = collapsed.has(category.id) && search.trim() === "";
        return (
          <section
            key={category.id}
            className="overflow-hidden rounded-xl border border-border bg-surface"
            aria-label={category.name}
          >
            <div className="flex items-center gap-2 border-b border-border bg-surface-2 px-3 sm:px-4">
              <button
                type="button"
                className="flex min-h-16 min-w-0 flex-1 items-center gap-3 py-3 text-left"
                aria-expanded={!closed}
                aria-controls={`category-${category.id}`}
                onClick={() =>
                  setCollapsed((current) => {
                    const next = new Set(current);
                    if (next.has(category.id)) next.delete(category.id);
                    else next.add(category.id);
                    return next;
                  })
                }
              >
                <CategoryIcon color={category.color} icon={category.icon} />
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-semibold">{category.name}</span>
                  <span className="block text-caption text-ink-2">
                    {t("board.progress", { count: done, total: groupRows.length })}
                  </span>
                </span>
                <ChevronDownIcon
                  className={cn("size-5 shrink-0", closed && "-rotate-90")}
                  aria-hidden
                />
              </button>
              <Link
                href={categoryPath(boatId, category.id) as Route}
                aria-label={t("board.manage", { category: category.name })}
                className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-accent"
              >
                <ChevronRightIcon className="size-5" aria-hidden />
              </Link>
            </div>
            <ul id={`category-${category.id}`} hidden={closed} className="divide-y divide-border">
              {items.map((row) => {
                const done = isChecklistChecked(row);
                const handed = row.openLog
                  ? handedSentence({
                      status: row.openLog.status,
                      date: formatDate(row.openLog.at),
                      contactName: row.openLog.contactName,
                    })
                  : null;
                const interval = [
                  row.intervalMonths ? tu("everyMonths", { count: row.intervalMonths }) : null,
                  row.intervalHours ? tu("everyHours", { count: row.intervalHours }) : null,
                ]
                  .filter(Boolean)
                  .join(" · ");
                return (
                  <li key={row.id} className="flex items-start gap-3 px-3 py-3 sm:px-4">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      disabled={!canContribute || refreshing || done}
                      aria-label={t(done ? "board.checkedLabel" : "tick.label", {
                        label: row.label,
                      })}
                      onClick={() => setCompleting(toCompletable(row, engineReadDates))}
                      className="grid size-11 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
                    >
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-md border-2",
                          done
                            ? "border-state-ok-border bg-state-ok-tint text-state-ok-fg"
                            : "border-ink-3 bg-surface",
                        )}
                      >
                        {done ? <CheckIcon className="size-5" aria-hidden /> : null}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={categoryPath(boatId, category.id, { open: row.id }) as Route}
                        className="block min-h-11 py-2 text-body font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.label}
                      </Link>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                        <ChecklistStateBadge
                          state={!row.hasCompletion && row.status === "ok" ? "never" : row.status}
                          dueToday={isDueToday(row)}
                          size="sm"
                        />
                        {interval ? (
                          <span className="text-caption text-ink-2">{interval}</span>
                        ) : null}
                        {row.dueAt ? (
                          <span className="text-caption text-ink-2">
                            {t("board.due", { date: formatDate(row.dueAt) })}
                          </span>
                        ) : null}
                      </div>
                      {row.dueHours !== null ? (
                        <p className="mt-2 text-caption text-ink-2">
                          {t("board.dueHours", { hours: formatHours(row.dueHours) })}
                        </p>
                      ) : null}
                      {handed ? (
                        <p className="mt-2 text-caption font-medium text-ink-2">
                          {t(`handed.${handed.key}`, handed.values)}
                        </p>
                      ) : null}
                      <p className="mt-2 text-caption text-ink-2">
                        {row.lastCompletedAt
                          ? row.lastCompletedByName
                            ? t("item.doneBy", {
                                date: formatDate(row.lastCompletedAt),
                                name: row.lastCompletedByName,
                              })
                            : t("item.done", { date: formatDate(row.lastCompletedAt) })
                          : t("item.never")}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <CompleteItemDialog
        boatId={boatId}
        item={completing}
        members={members}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onOpenChange={(open) => {
          if (!open) setCompleting(null);
        }}
        onCompleted={onCompleted}
        onUndone={onUndone}
      />
    </div>
  );
}
