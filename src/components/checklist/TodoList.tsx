"use client";

import { useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { ChecklistItemRow } from "@/components/checklist/ChecklistItemRow";
import {
  CompleteItemDialog,
  type CompletableItem,
  type CompletionMember,
  type SavedCompletion,
} from "@/components/checklist/CompleteItemDialog";
import { applyCompletion, isTodo, sortRows, type ChecklistRow } from "@/components/checklist/rows";
import { EmptyState } from "@/components/common/EmptyState";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { categoryPath, checklistPath } from "@/lib/queries/boat-routes";

export type TodoFilter = "all" | "overdue" | "soon" | "never";

// « À traiter » (E4-3, D21): the flat, urgency-sorted list across categories.
export function TodoList({
  boatId,
  rows: initialRows,
  filter,
  members,
  currentUserId,
  currentUserName,
  canContribute,
}: {
  boatId: string;
  rows: ChecklistRow[];
  filter: TodoFilter;
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canContribute: boolean;
}) {
  const t = useTranslations("checklist");
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [snapshots] = useState(() => new Map<string, ChecklistRow>());
  const [completing, setCompleting] = useState<CompletableItem | null>(null);

  const todo = rows.filter(isTodo);
  const counts = {
    all: todo.length,
    overdue: todo.filter((row) => row.status === "overdue").length,
    soon: todo.filter((row) => row.status === "soon").length,
    never: todo.filter((row) => row.status === "never").length,
  };
  const visible = sortRows(
    filter === "all" ? todo : todo.filter((row) => row.status === filter),
    true,
  );

  function onCompleted(item: CompletableItem, completion: SavedCompletion) {
    setRows((current) =>
      current.map((row) => {
        if (row.id !== item.id) return row;
        if (!snapshots.has(row.id)) snapshots.set(row.id, row);
        return applyCompletion(row, completion);
      }),
    );
  }

  function onUndone(item: CompletableItem) {
    const snapshot = snapshots.get(item.id);
    if (snapshot) setRows((current) => current.map((row) => (row.id === item.id ? snapshot : row)));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={filter}
          onValueChange={(next) => {
            if (!next) return;
            router.replace(
              checklistPath(boatId, {
                view: "todo",
                filter: next === "all" ? undefined : next,
              }) as Route,
            );
          }}
          className="max-w-full overflow-x-auto"
        >
          {(["all", "overdue", "soon", "never"] as const).map((key) => (
            <ToggleGroupItem key={key} value={key} className="min-h-11 gap-2">
              {t(`filters.${key}`)}
              <span className="num text-caption text-ink-3">{counts[key]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {counts.never > 0 ? (
          // The « Jamais fait » chip already prints this count 8 px above it.
          <p className="hidden text-caption text-ink-3 sm:block">
            {t("neverHint", { count: counts.never })}
          </p>
        ) : null}
      </div>
      {visible.length === 0 ? (
        <EmptyState
          variant="positive"
          title={t("todoEmpty.title")}
          description={t("todoEmpty.description")}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-surface">
          {visible.map((row) => (
            <ChecklistItemRow
              key={row.id}
              row={row}
              withCategory
              href={categoryPath(boatId, row.categoryId)}
              onDone={
                canContribute
                  ? (target) =>
                      setCompleting({
                        id: target.id,
                        label: target.label,
                        categoryName: target.categoryName,
                        intervalMonths: target.intervalMonths,
                        intervalHours: target.intervalHours,
                        engine: target.engineId
                          ? {
                              id: target.engineId,
                              label: target.engineLabel ?? "",
                              lastHours: target.currentHours,
                              lastDate: null,
                            }
                          : null,
                        lastCompletedAt: target.lastCompletedAt,
                        lastCompletedByName: target.lastCompletedByName,
                        lastEngineHours: target.lastEngineHours,
                      })
                  : undefined
              }
            />
          ))}
        </div>
      )}
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
