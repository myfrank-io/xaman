"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeftIcon, Trash2Icon } from "lucide-react";

import { ChecklistItemRow } from "@/components/checklist/ChecklistItemRow";
import {
  CompleteItemDialog,
  type CompletableItem,
  type CompletionMember,
  type SavedCompletion,
} from "@/components/checklist/CompleteItemDialog";
import {
  applyCompletion,
  isPunctual,
  isTodo,
  sortRows,
  type ChecklistRow,
} from "@/components/checklist/rows";
import { StepsChecklist, clearSteps } from "@/components/checklist/StepsChecklist";
import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deleteCompletion, setChecklistItemActive } from "@/lib/actions/checklist";
import { formatDate, formatHours, formatPercent } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  checklistPath,
  editChecklistItemPath,
  logPath,
  newChecklistItemPath,
} from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

export type CompletionRow = {
  id: string;
  itemId: string;
  completedAt: string;
  completedByName: string | null;
  engineHours: number | null;
  nextDueAt: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
  /** The intervention this completion wrote, when it wrote one: the way back to the history. */
  maintenanceLogId?: string | null;
};

export type DisabledItem = { id: string; label: string };

const HISTORY_PREVIEW = 3;
const PRO_UNDO_HOURS = 24;

// Points of one category (E4-4): sorted rows, one row expanded at a time, in place.
export function CategoryItems({
  boatId,
  category,
  rows: initialRows,
  completions: initialCompletions,
  disabledItems,
  progress,
  members,
  currentUserId,
  currentUserName,
  canWrite,
  canContribute,
  filter,
}: {
  boatId: string;
  category: { id: string; name: string; color: string; icon: string | null };
  rows: ChecklistRow[];
  completions: CompletionRow[];
  disabledItems: DisabledItem[];
  progress: number | null;
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canWrite: boolean;
  canContribute: boolean;
  filter: "all" | "todo";
}) {
  const t = useTranslations("checklist");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState(initialRows);
  const [completions, setCompletions] = useState(initialCompletions);
  const [snapshots] = useState(() => new Map<string, ChecklistRow>());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [completing, setCompleting] = useState<CompletableItem | null>(null);
  const [deleting, setDeleting] = useState<CompletionRow | null>(null);
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  const interval = rows.filter((row) => !isPunctual(row));
  const punctual = rows.filter(isPunctual);
  const todoCount = interval.filter(isTodo).length;
  const overdueCount = rows.filter((row) => row.status === "overdue").length;
  const visible = sortRows(filter === "todo" ? interval.filter(isTodo) : interval);
  const visiblePunctual = filter === "todo" ? [] : sortRows(punctual);

  function toCompletable(row: ChecklistRow): CompletableItem {
    return {
      id: row.id,
      label: row.label,
      categoryName: row.categoryName,
      intervalMonths: row.intervalMonths,
      intervalHours: row.intervalHours,
      engine: row.engineId
        ? {
            id: row.engineId,
            label: row.engineLabel ?? "",
            lastHours: row.currentHours,
            lastDate: null,
          }
        : null,
      lastCompletedAt: row.lastCompletedAt,
      lastCompletedByName: row.lastCompletedByName,
      lastEngineHours: row.lastEngineHours,
    };
  }

  function onCompleted(item: CompletableItem, completion: SavedCompletion) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== item.id) return row;
        if (!snapshots.has(row.id)) snapshots.set(row.id, row);
        return applyCompletion(row, completion);
      }),
    );
    setCompletions((current) => [
      {
        id: completion.id,
        itemId: item.id,
        completedAt: completion.completedAt,
        completedByName: completion.completedByName,
        engineHours: completion.engineHours,
        nextDueAt: completion.nextDueAt,
        note: null,
        maintenanceLogId: null,
        createdBy: currentUserId,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ]);
    clearSteps(item.id);
  }

  function onUndone(item: CompletableItem, completionId: string) {
    const snapshot = snapshots.get(item.id);
    if (snapshot) setRows((current) => current.map((row) => (row.id === item.id ? snapshot : row)));
    setCompletions((current) => current.filter((completion) => completion.id !== completionId));
  }

  function canDelete(completion: CompletionRow): boolean {
    if (canWrite) return true;
    if (!canContribute || completion.createdBy !== currentUserId) return false;
    const age = new Date().getTime() - new Date(completion.createdAt).getTime();
    return age < PRO_UNDO_HOURS * 3_600_000;
  }

  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = await deleteCompletion({ boatId, completionId: target.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("complete.deleted"));
      router.refresh();
    });
  }

  function reactivate(itemId: string) {
    startTransition(async () => {
      const result = await setChecklistItemActive({ boatId, itemId, isActive: true });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("form.enabled"));
      router.refresh();
    });
  }

  function renderRow(row: ChecklistRow) {
    const open = expanded === row.id;
    const history = completions.filter((completion) => completion.itemId === row.id);
    const shown = showAll.has(row.id) ? history : history.slice(0, HISTORY_PREVIEW);
    return (
      <div key={row.id} className={cn(open && "bg-surface-2")}>
        <ChecklistItemRow
          row={row}
          onClick={() => setExpanded(open ? null : row.id)}
          onDone={canContribute ? (target) => setCompleting(toCompletable(target)) : undefined}
        />
        {open ? (
          <div className="flex flex-col gap-5 border-b border-border px-4 pt-2 pb-5 sm:pl-[calc(1rem+6rem+0.75rem)]">
            {row.description ? (
              <p className="text-body whitespace-pre-wrap text-foreground">{row.description}</p>
            ) : null}
            {row.actions.length > 0 ? (
              <StepsChecklist itemId={row.id} steps={row.actions} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-body text-ink-2">{t("item.noSteps")}</span>
                {canWrite ? (
                  <Button asChild variant="link">
                    <Link href={editChecklistItemPath(boatId, category.id, row.id) as Route}>
                      {t("item.addSteps")}
                    </Link>
                  </Button>
                ) : null}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <h4 className="text-overline text-ink-2 uppercase">{t("item.history")}</h4>
              {history.length === 0 ? (
                <p className="text-body text-ink-2">{t("item.noHistory")}</p>
              ) : (
                <ul className="flex flex-col">
                  {shown.map((completion) => (
                    <li key={completion.id} className="flex min-h-11 items-center gap-3 text-body">
                      {/* The date leads back to the intervention this completion wrote, so the
                          plan and the history are one tap apart in both directions. */}
                      {completion.maintenanceLogId ? (
                        <Link
                          href={logPath(boatId, completion.maintenanceLogId) as Route}
                          className="shrink-0 num underline underline-offset-4"
                        >
                          {formatDate(completion.completedAt)}
                        </Link>
                      ) : (
                        <span className="shrink-0 num">{formatDate(completion.completedAt)}</span>
                      )}
                      <span className="min-w-0 flex-1 truncate text-ink-2">
                        {[
                          completion.completedByName,
                          completion.engineHours !== null
                            ? formatHours(completion.engineHours)
                            : null,
                          completion.nextDueAt
                            ? t("item.validUntil", { date: formatDate(completion.nextDueAt) })
                            : null,
                          completion.note,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      {canDelete(completion) ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={tc("delete")}
                          onClick={() => setDeleting(completion)}
                        >
                          <Trash2Icon />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {history.length > HISTORY_PREVIEW && !showAll.has(row.id) ? (
                <div>
                  <Button
                    type="button"
                    variant="link"
                    onClick={() => setShowAll((current) => new Set(current).add(row.id))}
                  >
                    {t("item.showAll", { count: history.length })}
                  </Button>
                </div>
              ) : null}
            </div>
            {canWrite ? (
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href={editChecklistItemPath(boatId, category.id, row.id) as Route}>
                    {t("item.edit")}
                  </Link>
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {/* A third way back on a phone: the TopBar shows « ‹ Retour » and the trail shows
            « Checklist › ». 52 px on the screen every checklist tap lands on. */}
        <Button asChild variant="ghost" size="sm" className="-ml-2 hidden sm:inline-flex">
          <Link href={checklistPath(boatId) as Route}>
            <ChevronLeftIcon />
            {t("title")}
          </Link>
        </Button>
        <PageHeader
          className="sm:mt-2"
          title={
            <span className="flex items-center gap-3">
              <CategoryIcon color={category.color} icon={category.icon} />
              {category.name}
            </span>
          }
          subtitle={[
            t("card.points", { count: interval.length }),
            formatPercent(progress),
            overdueCount > 0 ? t("card.overdue", { count: overdueCount }) : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          actions={
            <ToggleGroup
              type="single"
              value={filter}
              onValueChange={(next) => {
                if (!next) return;
                router.replace(
                  `${location.pathname}${next === "todo" ? "?filter=todo" : ""}` as Route,
                );
              }}
            >
              <ToggleGroupItem value="all" className="min-h-11">
                {t("filters.all")}
              </ToggleGroupItem>
              <ToggleGroupItem value="todo" className="min-h-11 gap-2">
                {t("filters.todo")}
                <span className="num text-caption text-ink-3">{todoCount}</span>
              </ToggleGroupItem>
            </ToggleGroup>
          }
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          action={
            canWrite ? (
              <Button asChild>
                <Link href={newChecklistItemPath(boatId, category.id) as Route}>
                  {t("addItem")}
                </Link>
              </Button>
            ) : undefined
          }
        />
      ) : visible.length === 0 && visiblePunctual.length === 0 ? (
        <EmptyState
          variant="positive"
          title={t("todoEmpty.title")}
          description={t("todoEmpty.description")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {visible.map(renderRow)}
        </div>
      )}

      {visiblePunctual.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-overline text-ink-2 uppercase">{t("item.punctualGroup")}</h2>
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            {visiblePunctual.map(renderRow)}
          </div>
        </section>
      ) : null}

      {disabledItems.length > 0 ? (
        <Accordion
          type="single"
          collapsible
          className="rounded-xl border border-border bg-surface-2 px-4"
        >
          <AccordionItem value="disabled">
            <AccordionTrigger className="text-body text-ink-2">
              {t("item.disabledCount", { count: disabledItems.length })}
            </AccordionTrigger>
            <AccordionContent>
              <ul className="flex flex-col">
                {disabledItems.map((item) => (
                  <li key={item.id} className="flex min-h-12 items-center gap-3 text-body">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{item.label}</span>
                    {canWrite ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => reactivate(item.id)}
                      >
                        {t("item.enable")}
                      </Button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      ) : null}

      <CompleteItemDialog
        boatId={boatId}
        item={completing}
        members={members}
        currentUserId={currentUserId}
        currentUserName={currentUserName}
        onOpenChange={(open) => (open ? undefined : setCompleting(null))}
        onCompleted={onCompleted}
        onUndone={onUndone}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={t("complete.deleteTitle")}
        description={
          deleting
            ? t("complete.deleteDescription", { date: formatDate(deleting.completedAt) })
            : undefined
        }
        confirmLabel={tc("delete")}
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
