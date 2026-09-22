"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ChevronLeftIcon, SendIcon, Trash2Icon } from "lucide-react";

import { AttachmentsSection } from "@/components/attachments/AttachmentsSection";
import { HandOverDialog } from "@/components/checklist/HandOverDialog";
import { TodoRow } from "@/components/checklist/TodoRow";
import { useTick } from "@/components/checklist/use-tick";
import {
  CompleteItemDialog,
  type CompletableItem,
  type CompletionMember,
  type SavedCompletion,
} from "@/components/checklist/CompleteItemDialog";
import {
  applyCompletion,
  applyOpenLog,
  countAttention,
  isPunctual,
  isTodo,
  sortRows,
  type ChecklistRow,
  type OpenLog,
} from "@/components/checklist/rows";
import { toCompletable, type EngineReadDates } from "@/components/checklist/completable";
import { StepsChecklist, clearSteps } from "@/components/checklist/StepsChecklist";
import { AttentionDot } from "@/components/common/AttentionDot";
import { CategoryIcon } from "@/components/common/CategoryBadge";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import type { ContactOption } from "@/components/contacts/specialties";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { deleteCompletion, setChecklistItemActive } from "@/lib/actions/checklist";
import { trashLog } from "@/lib/actions/logs";
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
  /**
   * The intervention this completion was derived from (D140) — every tick since then writes
   * one — or the one it was ticked from in the form. Null on a completion imported, or written
   * before D140. The date of the line leads to it, and removing it means trashing it.
   */
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
 *
 * Since D140 the completion the server writes carries a different id from the one drawn here
 * (the database derives it from the intervention), so the two overlays match on the
 * intervention's id as well as on the completion's.
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
  contacts = [],
  yardContactId = null,
  currentUserId,
  currentUserName,
  canWrite,
  canContribute,
  filter,
  initialOpen = null,
  engineReadDates,
}: {
  boatId: string;
  category: { id: string; name: string; color: string; icon: string | null };
  rows: ChecklistRow[];
  completions: CompletionRow[];
  disabledItems: DisabledItem[];
  progress: number | null;
  members: CompletionMember[];
  /** The boat's directory, for « Confier au chantier » (D141). */
  contacts?: ContactOption[];
  /** The yard of the directory, offered first in the sheet. */
  yardContactId?: string | null;
  currentUserId: string;
  currentUserName: string;
  canWrite: boolean;
  canContribute: boolean;
  filter: "all" | "todo";
  /** The point whose detail unfolds on arrival (`?open=`, D140). */
  initialOpen?: string | null;
  /** When each engine was last read, so a fresh reading fills the hours by itself. */
  engineReadDates?: EngineReadDates;
}) {
  const t = useTranslations("checklist");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [added, setAdded] = useState<Map<string, PendingCompletion>>(() => new Map());
  // Completion ids and intervention ids this device has undone or removed, while the props
  // still carry them.
  const [removed, setRemoved] = useState<Set<string>>(() => new Set());
  // Points handed over from here, before the server says so (D141): by item id.
  const [handed, setHanded] = useState<Map<string, OpenLog>>(() => new Map());
  const [expanded, setExpanded] = useState<string | null>(initialOpen);
  const [completing, setCompleting] = useState<CompletableItem | null>(null);
  const [handingOver, setHandingOver] = useState<ChecklistRow | null>(null);
  const [deleting, setDeleting] = useState<CompletionRow | null>(null);
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  // What the server currently says, by completion id and by intervention id: the arbiter of
  // both overlays.
  const serverIds = useMemo(() => {
    const ids = new Set<string>();
    for (const completion of initialCompletions) {
      ids.add(completion.id);
      if (completion.maintenanceLogId) ids.add(completion.maintenanceLogId);
    }
    return ids;
  }, [initialCompletions]);

  const serverHas = (completion: CompletionRow) =>
    serverIds.has(completion.id) ||
    (completion.maintenanceLogId !== null &&
      completion.maintenanceLogId !== undefined &&
      serverIds.has(completion.maintenanceLogId));
  const isRemoved = (completion: CompletionRow) =>
    removed.has(completion.id) ||
    (completion.maintenanceLogId !== null &&
      completion.maintenanceLogId !== undefined &&
      removed.has(completion.maintenanceLogId));

  // No effect prunes the overlays: an entry the props have caught up with is simply filtered
  // out below, and setting state from an effect is exactly the cascade the React compiler
  // refuses. They only ever hold what this device did on this screen.
  const pendingTicks = useMemo(
    () => [...added.values()].filter((entry) => !serverHas(entry.row)),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- serverHas reads serverIds only
    [added, serverIds],
  );

  const completions = useMemo(
    () => [
      ...pendingTicks.map((entry) => entry.row),
      ...initialCompletions.filter((completion) => !isRemoved(completion)),
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isRemoved reads removed only
    [pendingTicks, initialCompletions, removed],
  );

  const rows = useMemo(() => {
    if (pendingTicks.length === 0 && removed.size === 0 && handed.size === 0) return initialRows;
    const byItem = new Map(pendingTicks.map((entry) => [entry.itemId, entry]));
    return initialRows.map((row) => {
      const tick = byItem.get(row.id);
      if (tick) return applyCompletion(row, tick.saved);
      // Undone here, still acknowledged in the props: the refresh has not landed yet, so the
      // row is put back the way it was before the tick rather than showing as done.
      const last = row.lastCompletionId
        ? initialCompletions.find((completion) => completion.id === row.lastCompletionId)
        : undefined;
      if (last && isRemoved(last)) {
        const before = [...added.values()].find((entry) => entry.itemId === row.id)?.before;
        if (before) return before;
      }
      // Handed over here: the line says so until the server's row carries it.
      const openLog = handed.get(row.id);
      if (openLog && !row.openLog) return applyOpenLog(row, openLog);
      return row;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isRemoved reads removed only
  }, [initialRows, initialCompletions, pendingTicks, removed, added, handed]);

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
          maintenanceLogId: completion.logId,
          createdBy: currentUserId,
          createdAt: new Date().toISOString(),
        },
      });
      return next;
    });
    // A tick finishes whatever was planned on the point (D140).
    setHanded((current) => {
      if (!current.has(item.id)) return current;
      const next = new Map(current);
      next.delete(item.id);
      return next;
    });
    clearSteps(item.id);
  }

  /**
   * A completion that is not there any more: « Annuler » on the toast, or « Supprimer » in the
   * history. It leaves the optimistic overlay, and enters `removed` when the props still carry
   * it — the deletion is already done server-side, the refresh that will say so is on its way.
   * Keyed by the completion's id or by its intervention's: the server knows the second, this
   * device drew the first.
   */
  function forget(key: string) {
    const stillInProps = serverIds.has(key);
    setRemoved((current) => {
      if (!stillInProps || current.has(key)) return current;
      const next = new Set(current);
      next.add(key);
      return next;
    });
    setAdded((current) => {
      // Kept while the props still show it: its `before` is what puts the row back meanwhile.
      if (stillInProps) return current;
      const next = new Map(current);
      for (const [id, entry] of current) {
        if (id === key || entry.row.maintenanceLogId === key) next.delete(id);
      }
      return next.size === current.size ? current : next;
    });
  }

  function forgetItem(itemId: string) {
    for (const [completionId, entry] of added) {
      if (entry.itemId !== itemId) continue;
      forget(completionId);
      if (entry.row.maintenanceLogId) forget(entry.row.maintenanceLogId);
    }
  }

  function onUndone(item: CompletableItem, completionId: string) {
    const entry = added.get(completionId);
    forget(completionId);
    if (entry?.row.maintenanceLogId) forget(entry.row.maintenanceLogId);
    else forgetItem(item.id);
  }

  // Cocher en un geste, ici comme sur la porte (E20-2). La superposition optimiste est celle
  // que le dialogue alimentait déjà : une réalisation cochée est une réalisation, d'où qu'elle
  // vienne, et « Annuler » la retire du même endroit.
  const { tick, busy } = useTick(boatId, {
    currentUserName,
    onTicked: (row, ticked) => onCompleted(toCompletable(row, engineReadDates), ticked),
    onUndone: (row) => forgetItem(row.id),
    onNeedsCounter: (row) => setCompleting(toCompletable(row, engineReadDates)),
  });

  function onHandedOver(row: ChecklistRow, openLog: OpenLog) {
    setHanded((current) => new Map(current).set(row.id, openLog));
  }

  function canDelete(completion: CompletionRow): boolean {
    if (canWrite) return true;
    if (!canContribute || completion.createdBy !== currentUserId) return false;
    const age = new Date().getTime() - new Date(completion.createdAt).getTime();
    return age < PRO_UNDO_HOURS * 3_600_000;
  }

  /**
   * « Supprimer » in the history. A completion derived from an intervention (D140) is that
   * intervention: it goes to the trash, with its hours, for thirty days (rule 9). A completion
   * without one — imported, or written before D140 — is deleted as D15 always allowed.
   */
  function confirmDelete() {
    if (!deleting) return;
    const target = deleting;
    setDeleting(null);
    startTransition(async () => {
      const result = target.maintenanceLogId
        ? await trashLog({ boatId, logId: target.maintenanceLogId })
        : await deleteCompletion({ boatId, completionId: target.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(target.maintenanceLogId ? t("complete.trashed") : t("complete.deleted"));
      forget(target.id);
      if (target.maintenanceLogId) forget(target.maintenanceLogId);
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
      <div key={row.id} id={`item-${row.id}`} className={cn(open && "bg-surface-2")}>
        {/* La même ligne que la porte (E20-1) : le titre d'abord, l'échéance en toutes lettres
            dessous, et la case de 44 px qui coche en un geste. La page d'un système écrivait
            « dans 365 j » — une durée que personne ne lit en jours. */}
        <TodoRow
          row={row}
          onOpen={() => setExpanded(open ? null : row.id)}
          open={open}
          onTick={canContribute ? tick : undefined}
          busy={busy === row.id}
          withCategory={false}
        />
        {open ? (
          <div className="flex flex-col gap-5 border-b border-border px-4 pt-2 pb-5 sm:pl-[calc(1rem+6rem+0.75rem)]">
            {row.description ? (
              <p className="text-body whitespace-pre-wrap text-foreground">{row.description}</p>
            ) : null}
            <AttachmentsSection boatId={boatId} owner={{ type: "checklist_item", id: row.id }} />
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
            {/* Ce que le point devient (D140, D141) : confié — l'intervention prévue se lit ; à
                confier — un tap et le chantier a le travail ; et « Modifier » pour le plan. */}
            {canContribute || canWrite ? (
              <div className="flex flex-wrap gap-3">
                {row.openLog ? (
                  <Button asChild variant="outline">
                    <Link href={logPath(boatId, row.openLog.id) as Route}>
                      {t("handoff.viewLog")}
                    </Link>
                  </Button>
                ) : canContribute ? (
                  <Button type="button" variant="outline" onClick={() => setHandingOver(row)}>
                    <SendIcon />
                    {t("handoff.action")}
                  </Button>
                ) : null}
                {canWrite ? (
                  <Button asChild variant="outline">
                    <Link href={editChecklistItemPath(boatId, category.id, row.id) as Route}>
                      {t("item.edit")}
                    </Link>
                  </Button>
                ) : null}
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
      <HandOverDialog
        boatId={boatId}
        row={handingOver}
        contacts={contacts}
        defaultContactId={yardContactId}
        canCreateContact={canWrite}
        onOpenChange={(open) => (open ? undefined : setHandingOver(null))}
        onHandedOver={onHandedOver}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => (open ? undefined : setDeleting(null))}
        title={deleting?.maintenanceLogId ? t("complete.trashTitle") : t("complete.deleteTitle")}
        description={
          deleting
            ? deleting.maintenanceLogId
              ? t("complete.trashDescription", { date: formatDate(deleting.completedAt) })
              : t("complete.deleteDescription", { date: formatDate(deleting.completedAt) })
            : undefined
        }
        confirmLabel={deleting?.maintenanceLogId ? t("complete.trashConfirm") : tc("delete")}
        pending={pending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
