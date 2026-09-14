"use client";

import { useMemo, useState } from "react";
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
import { applyCompletion, isTodo } from "@/components/checklist/rows";
import { CategoryDot } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { StatusBadge } from "@/components/common/StatusBadge";
import { NextActionCard } from "@/components/dashboard/NextActionCard";
import { entryKey, groupQueue, type UpcomingEntry } from "@/components/dashboard/queue";
import { LogDueLabel } from "@/components/logs/LogDueLabel";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import {
  categoryPath,
  checklistPath,
  inboxPath,
  logPath,
  logsPath,
  stockPath,
} from "@/lib/queries/boat-routes";

/**
 * Le plan de travail (D121, E18-1) : toute la file de `boat_todo_queue`, rangée par palier.
 *
 * Ce bloc était un aperçu de six lignes sous un titre, au-dessus de trois résumés d'autres
 * onglets. Il est maintenant l'écran : la première ligne est promue en carte nommée
 * (`NextActionCard` — c'est la même ligne, jamais une copie, la liste commence à la deuxième),
 * et le reste se range sous « Aujourd'hui · Cette semaine · Ce mois-ci · Aux heures moteur »
 * (`queue.ts`). Un palier vide n'a pas de titre.
 *
 * Le « Fait » reste en ligne : un point coché est réévalué par le miroir TS et sort de la liste
 * quand il n'est plus dû ; l'annulation du toast le remet à son rang, donc dans son palier.
 */
export function UpcomingList({
  boatId,
  entries: initialEntries,
  members,
  currentUserId,
  currentUserName,
  canContribute,
  today,
  engineReadDates,
}: {
  boatId: string;
  entries: UpcomingEntry[];
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  canContribute: boolean;
  /** Le jour tel que le serveur l'a lu : les paliers et la puce « aujourd'hui » le partagent. */
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
  const groups = useMemo(() => groupQueue(rest, today), [rest, today]);

  function renderEntry(entry: UpcomingEntry) {
    // Un document attend une décision, pas une date : sa ligne dit depuis quand il est là, et
    // mène à l'écran qui sait le classer (D127).
    if (entry.kind === "inbox") {
      return (
        <ListRow
          key={entryKey(entry)}
          lead={
            <Badge size="sm" variant="secondary" className="w-26 justify-center">
              {t("inbox.badge")}
            </Badge>
          }
          title={entry.title}
          meta={
            entry.receivedAt ? t("inbox.received", { date: formatDate(entry.receivedAt) }) : null
          }
          href={inboxPath(boatId)}
        />
      );
    }
    // Une pièce sous son seuil tombe quand on ira l'acheter : ce qui manque, et rien de daté.
    if (entry.kind === "part") {
      return (
        <ListRow
          key={entryKey(entry)}
          lead={
            <Badge size="sm" variant="secondary" className="w-26 justify-center">
              {t("part.badge")}
            </Badge>
          }
          title={entry.title}
          meta={
            <>
              {entry.categoryColor ? <CategoryDot color={entry.categoryColor} /> : null}
              {entry.categoryName ? <span className="truncate">{entry.categoryName}</span> : null}
              <span className="num">{t("part.missing", { count: entry.missing })}</span>
            </>
          }
          categoryColor={entry.categoryColor ?? undefined}
          href={stockPath(boatId, { filter: "low" })}
        />
      );
    }
    return entry.kind === "item" ? (
      <ChecklistItemRow
        key={entryKey(entry)}
        row={entry.row}
        withCategory
        compact
        href={categoryPath(boatId, entry.row.categoryId)}
        onDone={
          canContribute ? (row) => setCompleting(toCompletable(row, engineReadDates)) : undefined
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
    );
  }

  return (
    <div className="flex flex-col gap-5">
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
      {groups.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          {/* Le compte est celui des lignes juste dessous : il se résout en lignes, il n'est
              pas un cadran (D121). */}
          <h3 className="flex items-baseline gap-2 text-overline text-ink-2 uppercase">
            {t(`groups.${group.key}`)}
            <span className="num text-ink-3">{group.entries.length}</span>
          </h3>
          <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
            {group.entries.map(renderEntry)}
          </div>
        </section>
      ))}
      {/* Les deux portes de ce que la file ne porte pas : les points jamais renseignés et les
          interventions prévues au-delà de trente jours. Sans compte — la liste au-dessus est
          déjà le compte, et un nombre qui redit ce qu'on vient de lire est du décor. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <Link
          href={checklistPath(boatId, { view: "todo" }) as Route}
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
        >
          {t("allChecklist")}
          <ChevronRightIcon className="size-4" aria-hidden />
        </Link>
        <Link
          href={logsPath(boatId, { tab: "planned" }) as Route}
          className="inline-flex min-h-11 items-center gap-1 text-label font-medium text-primary"
        >
          {t("allLogs")}
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
