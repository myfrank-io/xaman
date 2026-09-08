"use client";

import { useMemo, useState, useTransition } from "react";
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
  countAttention,
  isPunctual,
  isTodo,
  sortRows,
  type ChecklistRow,
} from "@/components/checklist/rows";
import { toCompletable, type EngineReadDates } from "@/components/checklist/completable";
import { StepsChecklist, clearSteps } from "@/components/checklist/StepsChecklist";
import { AttentionDot } from "@/components/common/AttentionDot";
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

/**
 * A completion this iPad knows about and the server has not sent back yet.
 *
 * The rows and the history come from the props: the Realtime subscription calls
 * `router.refresh()`, and a point ticked on the other iPad has to appear here. Copying the props
 * into `useState` — which is what this screen did — seeds them once and ignores every refresh
 * afterwards, so the list stayed frozen on what the first render happened to carry.
 *
 * So the props are the truth, and what this device did in the last second is laid *over* them:
 * `added` while the acknowledgement is not in the props yet (an optimistic tick, or one queued
 * offline that will not be there for hours), `removed` while an undone one still is. Each entry
 * lifts itself as soon as the props agree — no timers, no reconciliation, and a refresh coming
 * from anywhere lands immediately.
 */
type PendingCompletion = {
  itemId: string;
  row: CompletionRow;
  saved: SavedCompletion;
  /** The props row as it was before the tick: what « Annuler » puts back. */
  before: ChecklistRow | null;
};

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
  engineReadDates,
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
  /** When each engine was last read, so a fresh reading fills the hours by itself. */
  engineReadDates?: EngineReadDates;
}) {
  const t = useTranslations("checklist");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Map<string, PendingCompletion>>(() => new Map());
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [completing, setCompleting] = useState<CompletableItem | null>(null);
  const [deleting, setDeleting] = useState<CompletionRow | null>(null);
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  // What the server currently says, by completion id: the arbiter of both overlays.
  const serverCompletionIds = useMemo(
    () => new Set(initialCompletions.map((completion) => completion.id)),
    [initialCompletions],
  );

  // No effect prunes the two overlays: an entry the props have caught up with is simply
  // filtered out below, and setting state from an effect is exactly the cascade the React
  // compiler refuses. They only ever hold what this device did on this screen.
  const pendingTicks = useMemo(
    () => [...added.values()].filter((entry) => !serverCompletionIds.has(entry.row.id)),
    [added, serverCompletionIds],
  );

  const completions = useMemo(
    () => [
      ...pendingTicks.map((entry) => entry.row),
      ...initialCompletions.filter((completion) => !removed.has(completion.id)),
    ],
    [pendingTicks, initialCompletions, removed],
  );

  const rows = useMemo(() => {
    if (pendingTicks.length === 0 && removed.size === 0) return initialRows;
    const byItem = new Map(pendingTicks.map((entry) => [entry.itemId, entry]));
    return initialRows.map((row) => {
      const tick = byItem.get(row.id);
      if (tick) return applyCompletion(row, tick.saved);
      // Undone here, still acknowledged in the props: the refresh has not landed yet, so the
      // row is put back the way it was before the tick rather than showing as done.
      if (row.lastCompletionId && removed.has(row.lastCompletionId)) {
        const before = added.get(row.lastCompletionId)?.before;
        if (before) return before;
      }
      return row;
    });
  }, [initialRows, pendingTicks, removed, added]);

  const interval = rows.filter((row) => !isPunctual(row));
  const punctual = rows.filter(isPunctual);
  // Un contrôle ponctuel est « à traiter » quand sa date de validité est dépassée ou proche
  // (D11) ; « jamais fait » reste de l'information. Il était exclu du filtre alors qu'il
  // comptait dans les pastilles : le point rouge menait à une liste où il n'était pas.
  const punctualTodo = punctual.filter((row) => isTodo(row) && row.status !== "never");
  const todoCount = interval.filter(isTodo).length + punctualTodo.length;
  const overdueCount = rows.filter((row) => row.status === "overdue").length;
  // Dernière marche du flux : le point rouge de l'onglet, puis de la tuile, arrive ici — sur
  // le filtre, puis sur la ligne elle-même, dont le badge dit « Aujourd'hui » (D88).
  const attentionCount = countAttention(rows);
  const visible = sortRows(filter === "todo" ? interval.filter(isTodo) : interval);
  const visiblePunctual = sortRows(filter === "todo" ? punctualTodo : punctual);

  function onCompleted(item: CompletableItem, completion: SavedCompletion) {
    const before = initialRows.find((row) => row.id === item.id);
    setAdded((current) => {
      const next = new Map(current);
      next.set(completion.id, {
        itemId: item.id,
        saved: completion,
        before: before ?? null,
        row: {
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
      });
      return next;
    });
    clearSteps(item.id);
  }

  /**
   * A completion that is not there any more: « Annuler » on the toast, or « Supprimer » in the
   * history. It leaves the optimistic overlay, and enters `removed` when the props still carry
   * it — the deletion is already done server-side, the refresh that will say so is on its way.
   */
  function forget(completionId: string) {
    const stillInProps = serverCompletionIds.has(completionId);
    setRemoved((current) => {
      if (!stillInProps || current.has(completionId)) return current;
      const next = new Set(current);
      next.add(completionId);
      return next;
    });
    setAdded((current) => {
      // Kept while the props still show it: its `before` is what puts the row back meanwhile.
      if (stillInProps || !current.has(completionId)) return current;
      const next = new Map(current);
      next.delete(completionId);
      return next;
    });
  }

  function onUndone(_item: CompletableItem, completionId: string) {
    forget(completionId);
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
      forget(target.id);
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
          onDone={
            canContribute
              ? (target) => setCompleting(toCompletable(target, engineReadDates))
              : undefined
          }
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
            attentionCount > overdueCount
              ? t("card.dueToday", { count: attentionCount - overdueCount })
              : null,
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
                <AttentionDot count={attentionCount} size="sm" />
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
