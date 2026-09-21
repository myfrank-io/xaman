"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckCheckIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import {
  CompleteItemDialog,
  type CompletableItem,
  type CompletionMember,
  type SavedCompletion,
} from "./CompleteItemDialog";
import { toCompletable, type EngineReadDates } from "./completable";
import { type ChecklistRow, applyCompletion } from "./rows";
import {
  filterChecklist,
  matchesChecklistFilter,
  needsCompletionDetails,
  overlayCompletion,
  type CompletionOverlay,
  type ChecklistFilter,
} from "./board";
import { ChecklistWorkRow } from "./ChecklistWorkRow";
import { clearSteps } from "./StepsChecklist";
import { useTick } from "./use-tick";
import { CategoryIcon } from "@/components/common/CategoryBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { todayString } from "@/lib/format";
import { newChecklistItemPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string; color: string; icon: string | null };
type Receipt = { undo: () => Promise<boolean> };

export function ChecklistBoard({
  boatId,
  categories,
  rows: serverRows,
  members,
  currentUserId,
  currentUserName,
  canContribute,
  canWrite = false,
  engineReadDates = {},
  initialFilter = "todo",
}: {
  boatId: string;
  categories: Category[];
  rows: ChecklistRow[];
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canContribute: boolean;
  canWrite?: boolean;
  engineReadDates?: EngineReadDates;
  initialFilter?: ChecklistFilter;
}) {
  const t = useTranslations("checklist");
  const params = useSearchParams();
  const view = params.get("view");
  const filter: ChecklistFilter =
    view === "all" || view === "todo" || view === "unrecorded" ? view : initialFilter;
  const categoryId = params.get("system") ?? "";
  const search = params.get("q") ?? "";
  const expanded = params.get("open");
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());
  const [completing, setCompleting] = useState<CompletableItem | null>(null);
  const [overlays, setOverlays] = useState<Map<string, CompletionOverlay>>(() => new Map());
  const [receipts, setReceipts] = useState<Map<string, Receipt>>(() => new Map());
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [undoing, setUndoing] = useState<Set<string>>(() => new Set());
  const rows = serverRows.map((row) => overlayCompletion(row, overlays.get(row.id)));

  function select(values: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${next.size ? `?${next}` : ""}`,
    );
    if (!("open" in values)) setPinned(new Set());
  }
  function onCompleted(
    item: Pick<CompletableItem, "id">,
    completion: SavedCompletion,
    undo?: () => Promise<boolean>,
  ) {
    const before = serverRows.find((row) => row.id === item.id);
    if (!before) return;
    if (undo) setReceipts((current) => new Map(current).set(item.id, { undo }));
    const historical = Boolean(
      before.lastCompletedAt && completion.completedAt < before.lastCompletedAt,
    );
    setOverlays((current) =>
      new Map(current).set(item.id, {
        before,
        completed: historical ? before : applyCompletion(before, completion),
        undone: false,
      }),
    );
    setPinned((current) => new Set(current).add(item.id));
    if (undo) clearSteps(item.id);
  }
  function onUndone(item: Pick<CompletableItem, "id">) {
    setOverlays((current) => {
      const entry = current.get(item.id);
      return entry ? new Map(current).set(item.id, { ...entry, undone: true }) : current;
    });
    setReceipts((current) => {
      const next = new Map(current);
      next.delete(item.id);
      return next;
    });
    setPinned((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
  }
  const { tick, busyIds } = useTick(boatId, {
    currentUserName,
    onTicked: onCompleted,
    onUndone,
    onNeedsCounter: (row) => setCompleting(toCompletable(row, engineReadDates)),
    onSaved: (row, saved, undo) => {
      onCompleted(row, saved);
      clearSteps(row.id);
      setReceipts((current) => new Map(current).set(row.id, { undo }));
    },
  });
  function complete(row: ChecklistRow) {
    if (needsCompletionDetails(row, engineReadDates, todayString()))
      setCompleting(toCompletable(row, engineReadDates));
    else tick(row);
  }
  async function undo(row: ChecklistRow) {
    const receipt = receipts.get(row.id);
    if (!receipt) return;
    setUndoing((current) => new Set(current).add(row.id));
    await receipt.undo();
    setUndoing((current) => {
      const next = new Set(current);
      next.delete(row.id);
      return next;
    });
  }

  // Keep just-completed rows under the finger; their original rank survives the refresh.
  const eligible = filterChecklist(
    rows.map((row) => (pinned.has(row.id) ? (overlays.get(row.id)?.before ?? row) : row)),
    { filter, categoryId, search },
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const visible = eligible.map((row) => byId.get(row.id) ?? row);
  const counts = {
    todo: rows.filter((row) => matchesChecklistFilter(row, "todo")).length,
    all: rows.length,
    unrecorded: rows.filter((row) => !row.hasCompletion).length,
  };
  const hasFilters = Boolean(search || categoryId);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3">
        <div
          className="flex min-w-0 flex-wrap gap-x-5 border-b border-border"
          role="group"
          aria-label={t("board.filterLabel")}
        >
          {(["todo", "all", "unrecorded"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => select({ view: value })}
              className={cn(
                "inline-flex min-h-12 items-center gap-2 border-b-2 px-1 text-label",
                filter === value
                  ? "border-primary font-semibold text-foreground"
                  : "border-transparent text-ink-2",
              )}
            >
              {t(`work.filters.${value}`)}
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 num text-caption",
                  filter === value
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface-2 text-ink-2",
                )}
              >
                {counts[value]}
              </span>
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <SearchIcon
              className="pointer-events-none absolute top-3 left-3 size-5 text-ink-3"
              aria-hidden
            />
            <Input
              aria-label={t("board.search")}
              placeholder={t("work.search")}
              value={search}
              onChange={(event) => select({ q: event.target.value || null })}
              className="bg-surface pr-11 pl-10"
            />
            {search ? (
              <button
                type="button"
                onClick={() => select({ q: null })}
                aria-label={t("work.clearSearch")}
                className="absolute top-0 right-0 grid size-11 place-items-center"
              >
                <XIcon className="size-4" />
              </button>
            ) : null}
          </div>
          <select
            aria-label={t("board.category")}
            className="min-h-11 min-w-0 rounded-lg border border-border bg-surface px-3 text-base sm:max-w-60"
            value={categoryId}
            onChange={(event) => select({ system: event.target.value || null })}
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
      {filter === "unrecorded" ? (
        <p className="max-w-prose text-caption text-ink-2">{t("work.unrecordedHelp")}</p>
      ) : null}
      {!canContribute ? <p className="text-caption text-ink-2">{t("work.readOnly")}</p> : null}
      <p className="sr-only" role="status">
        {t("board.results", { count: visible.length })}
      </p>
      {visible.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface px-5 py-8 sm:p-8">
          {!hasFilters && filter === "todo" ? (
            <CheckCheckIcon className="mb-4 size-8 text-state-ok-fg" aria-hidden />
          ) : (
            <SearchIcon className="mb-4 size-7 text-ink-3" aria-hidden />
          )}
          <h2 className="text-h3 font-semibold">
            {t(
              rows.length === 0
                ? "emptyTitle"
                : hasFilters
                  ? "work.noResults"
                  : filter === "todo"
                    ? "work.nothingDue"
                    : "work.historyComplete",
            )}
          </h2>
          <p className="mt-2 max-w-prose text-body text-ink-2">
            {t(
              rows.length === 0
                ? "emptyDescription"
                : hasFilters
                  ? "work.noResultsHelp"
                  : filter === "todo"
                    ? "work.nothingDueHelp"
                    : "work.historyCompleteHelp",
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {hasFilters ? (
              <Button variant="outline" onClick={() => select({ q: null, system: null })}>
                {t("work.clearFilters")}
              </Button>
            ) : null}
            {counts.unrecorded > 0 && !hasFilters && filter === "todo" ? (
              <Button variant="outline" onClick={() => select({ view: "unrecorded" })}>
                {t("work.recordHistory", { count: counts.unrecorded })}
              </Button>
            ) : null}
            {rows.length > 0 ? (
              <Button
                variant="ghost"
                onClick={() => select({ view: "all", q: null, system: null })}
              >
                {t("work.seePlan")}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
      {categories.map((category) => {
        const items = visible.filter((row) => row.categoryId === category.id);
        if (!items.length) return null;
        const closed = collapsed.has(category.id) && !search;
        return (
          <section
            key={category.id}
            aria-label={category.name}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            <h2>
              <button
                type="button"
                className="flex min-h-14 w-full items-center gap-3 border-b border-border bg-surface-2/70 px-4 py-2 text-left"
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
                <span className="flex-1 text-body font-semibold">{category.name}</span>
                <span className="num text-caption text-ink-2">{items.length}</span>
                <ChevronDownIcon
                  className={cn("size-4 text-ink-3", closed && "-rotate-90")}
                  aria-hidden
                />
              </button>
            </h2>
            <ul id={`category-${category.id}`} hidden={closed} className="divide-y divide-border">
              {items.map((row) => (
                <ChecklistWorkRow
                  key={row.id}
                  boatId={boatId}
                  row={row}
                  open={expanded === row.id}
                  busy={busyIds.has(row.id)}
                  recent={pinned.has(row.id) && !overlays.get(row.id)?.undone}
                  undoing={undoing.has(row.id)}
                  canContribute={canContribute}
                  canWrite={canWrite}
                  onOpen={() => select({ open: expanded === row.id ? null : row.id })}
                  onTick={() => complete(row)}
                  onDetails={() => setCompleting(toCompletable(row, engineReadDates))}
                  onUndo={
                    receipts.has(row.id)
                      ? () => {
                          void undo(row);
                        }
                      : undefined
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}
      {canWrite && categoryId ? (
        <div>
          <Button asChild variant="outline">
            <Link href={newChecklistItemPath(boatId, categoryId) as Route}>
              {t("work.addInSystem")}
            </Link>
          </Button>
        </div>
      ) : null}
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
