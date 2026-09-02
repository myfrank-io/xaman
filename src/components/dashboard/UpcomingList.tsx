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
import { applyCompletion, isTodo, type ChecklistRow } from "@/components/checklist/rows";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { StatusBadge } from "@/components/common/StatusBadge";
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
}: {
  boatId: string;
  entries: UpcomingEntry[];
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canContribute: boolean;
  todoCount: number;
  openLogs: number;
}) {
  const t = useTranslations("dashboard.upcoming");
  const [entries, setEntries] = useState(initialEntries);
  const [snapshots] = useState(() => new Map<string, UpcomingEntry>());
  const [completing, setCompleting] = useState<CompletableItem | null>(null);

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

  return (
    <div className="flex flex-col">
      {entries.map((entry) =>
        entry.kind === "item" ? (
          <ChecklistItemRow
            key={entryKey(entry)}
            row={entry.row}
            withCategory
            compact
            href={categoryPath(boatId, entry.row.categoryId)}
            onDone={canContribute ? (row) => setCompleting(toCompletable(row)) : undefined}
          />
        ) : (
          <ListRow
            key={entryKey(entry)}
            lead={<StatusBadge status={entry.status} className="w-24 justify-center" />}
            title={entry.title}
            meta={
              <>
                <CategoryDot color={entry.categoryColor} />
                <span className="truncate">{entry.categoryName}</span>
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
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-2">
        <Link
          href={checklistPath(boatId, { view: "todo" }) as Route}
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
        >
          {t("allChecklistCount", { count: todoCount })}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
        <Link
          href={logsPath(boatId) as Route}
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
