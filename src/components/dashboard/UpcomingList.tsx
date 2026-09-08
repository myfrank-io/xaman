"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { ChecklistItemRow } from "@/components/checklist/ChecklistItemRow";
import {
  CompleteItemDialog,
  type CompletableItem,
  type CompletionMember,
  type SavedCompletion,
} from "@/components/checklist/CompleteItemDialog";
import { toCompletable, type EngineReadDates } from "@/components/checklist/completable";
import { applyCompletion, isTodo, type ChecklistRow } from "@/components/checklist/rows";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { StatusBadge } from "@/components/common/StatusBadge";
import { NextActionCard } from "@/components/dashboard/NextActionCard";
import { LogDueLabel } from "@/components/logs/LogDueLabel";
import { formatDate } from "@/lib/format";
import { categoryPath, checklistPath, logPath, logsPath } from "@/lib/queries/boat-routes";
import type { Database } from "@/types/database";

type LogStatus = Database["public"]["Enums"]["log_status"];

export type UpcomingEntry =
  | { kind: "item"; row: ChecklistRow }
  | {
      kind: "log";
      id: string;
      title: string;
      status: LogStatus;
      dueAt: string | null;
      categoryName: string;
      categoryColor: string;
    };

function entryKey(entry: UpcomingEntry): string {
  return entry.kind === "item" ? `item:${entry.row.id}` : `log:${entry.id}`;
}

/**
 * « À faire prochainement » (ux-flows §2.4): the ranked queue of `boat_todo_queue`, with
 * « Fait » inline. A completed item is re-evaluated through the TS mirror and slides out
 * when it is no longer due; the undo of the toast puts it back.
 *
 * The first entry is promoted into a named block above the list (`NextActionCard`): the
 * screen offered four doors to the same list before offering a single act. It is the same
 * entry, never a copy — the list below starts at the second.
 *
 * `todoCount` counts what the destination shows, and nothing else: « en retard » + « bientôt »,
 * exactly the two states the queue ranks and the « À traiter » tab lists.
 */
export function UpcomingList({
  boatId,
  entries: initialEntries,
  members,
  currentUserId,
  currentUserName,
  canContribute,
  todoCount,
  openLogs,
  today,
  engineReadDates,
}: {
  boatId: string;
  entries: UpcomingEntry[];
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canContribute: boolean;
  todoCount: number;
  openLogs: number;
  /** Le jour tel que le serveur l'a lu, pour la puce « aujourd'hui / N j de retard ». */
  today: string;
  /** When each engine was last read, so a fresh reading fills the hours by itself. */
  engineReadDates?: EngineReadDates;
}) {
  const t = useTranslations("dashboard.upcoming");
  const [entries, setEntries] = useState(initialEntries);
  const [snapshots] = useState(() => new Map<string, UpcomingEntry>());
  const [completing, setCompleting] = useState<CompletableItem | null>(null);

  function onCompleted(item: CompletableItem, completion: SavedCompletion) {
    setEntries((current) =>
      current
        .map((entry) => {
          if (entry.kind !== "item" || entry.row.id !== item.id) return entry;
          if (!snapshots.has(item.id)) snapshots.set(item.id, entry);
          return { kind: "item" as const, row: applyCompletion(entry.row, completion) };
        })
        .filter((entry) => entry.kind !== "item" || isTodo(entry.row)),
    );
  }

  function onUndone(item: CompletableItem) {
    const snapshot = snapshots.get(item.id);
    if (!snapshot) return;
    setEntries((current) => {
      if (current.some((entry) => entry.kind === "item" && entry.row.id === item.id)) {
        return current.map((entry) =>
          entry.kind === "item" && entry.row.id === item.id ? snapshot : entry,
        );
      }
      // Back at its original rank, never at the bottom.
      const position = initialEntries.findIndex((entry) => entryKey(entry) === entryKey(snapshot));
      const next = [...current];
      next.splice(Math.min(Math.max(position, 0), next.length), 0, snapshot);
      return next;
    });
  }

  const [next, ...rest] = entries;

  return (
    <div className="flex flex-col gap-3">
      {next ? (
        <NextActionCard
          boatId={boatId}
          entry={next}
          today={today}
          canContribute={canContribute}
          onDone={
            canContribute ? (row) => setCompleting(toCompletable(row, engineReadDates)) : undefined
          }
        />
      ) : null}
      {rest.length > 0 ? (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {rest.map((entry) =>
            entry.kind === "item" ? (
              <ChecklistItemRow
                key={entryKey(entry)}
                row={entry.row}
                withCategory
                compact
                href={categoryPath(boatId, entry.row.categoryId)}
                onDone={
                  canContribute
                    ? (row) => setCompleting(toCompletable(row, engineReadDates))
                    : undefined
                }
              />
            ) : (
              <ListRow
                key={entryKey(entry)}
                lead={<StatusBadge status={entry.status} className="w-28 justify-center" />}
                title={entry.title}
                meta={
                  <>
                    <CategoryDot color={entry.categoryColor} />
                    <span className="truncate">{entry.categoryName}</span>
                    <LogDueLabel status={entry.status} performedAt={entry.dueAt} today={today} />
                  </>
                }
                trailing={
                  entry.dueAt ? (
                    <span className="num text-caption text-ink-2">{formatDate(entry.dueAt)}</span>
                  ) : null
                }
                categoryColor={entry.categoryColor}
                href={logPath(boatId, entry.id)}
              />
            ),
          )}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link
          href={checklistPath(boatId, { view: "todo" }) as Route}
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
        >
          {t("allChecklistCount", { count: todoCount })}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
        {/* Vers l'onglet « Prévu », pas vers l'historique : le compte du lien est celui des
            interventions ouvertes, et un lien doit mener à ce qu'il compte. */}
        <Link
          href={logsPath(boatId, { tab: "planned" }) as Route}
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
        >
          {t("allLogsCount", { count: openLogs })}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
      </div>
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
    </div>
  );
}
