"use client";

import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import {
  CheckIcon,
  ChevronDownIcon,
  Clock3Icon,
  HistoryIcon,
  PencilIcon,
  Trash2Icon,
  Undo2Icon,
} from "lucide-react";
import { StepsChecklist } from "./StepsChecklist";
import { dueSentence, handedSentence } from "./due-sentence";
import { hasCounter, isPunctual, type ChecklistRow } from "./rows";
import { isChecklistChecked } from "./board";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDate, formatHours, todayString } from "@/lib/format";
import { categoryPath, editChecklistItemPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

export function ChecklistWorkRow({
  boatId,
  row,
  open,
  busy,
  recent,
  undoing,
  canContribute,
  canWrite,
  onOpen,
  onTick,
  onDetails,
  onUndo,
  undoTrashesPlanned = false,
}: {
  boatId: string;
  row: ChecklistRow;
  open: boolean;
  busy: boolean;
  recent: boolean;
  undoing: boolean;
  canContribute: boolean;
  canWrite: boolean;
  onOpen: () => void;
  onTick: () => void;
  onDetails: () => void;
  onUndo?: () => void;
  undoTrashesPlanned?: boolean;
}) {
  const t = useTranslations("checklist");
  const tu = useTranslations("units");
  const checked = isChecklistChecked(row) || (recent && row.lastCompletedAt === todayString());
  const due = dueSentence({
    status: row.status,
    daysRemaining: row.daysRemaining,
    hoursRemaining: row.hoursRemaining,
    hasCounter: hasCounter(row),
    punctual: isPunctual(row) && row.dueAt === null,
    hasCompletion: row.hasCompletion,
  });
  const handed = row.openLog
    ? handedSentence({
        status: row.openLog.status,
        date: formatDate(row.openLog.at),
        contactName: row.openLog.contactName,
      })
    : null;
  const sentence = handed
    ? t(`handed.${handed.key}`, handed.values)
    : !row.hasCompletion && due.tone === "calm"
      ? t("work.noRecord")
      : t(`due.${due.key}`, due.values ?? {});
  const tone = recent
    ? "text-state-ok-fg"
    : due.tone === "overdue" || due.tone === "today"
      ? "text-danger-fg"
      : due.tone === "soon"
        ? "text-warning-fg"
        : "text-ink-2";
  const interval = [
    row.intervalMonths ? tu("everyMonths", { count: row.intervalMonths }) : null,
    row.intervalHours ? tu("everyHours", { count: row.intervalHours }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <li
      className={cn(
        "transition-colors motion-reduce:transition-none",
        open && "bg-surface-2/50",
        recent && "bg-state-ok-tint/40",
      )}
      data-item-id={row.id}
    >
      <div className="flex items-start gap-2 px-3 sm:px-4">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-label={t(checked || recent ? "work.reviewDone" : "work.tick", { label: row.label })}
          disabled={!canContribute || busy || undoing}
          onClick={checked || recent ? onOpen : onTick}
          className="mt-3 grid size-12 shrink-0 place-items-center rounded-lg outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-default"
        >
          {busy || undoing ? (
            <Spinner className="size-5" />
          ) : (
            <span
              className={cn(
                "grid size-7 place-items-center rounded-md border-2",
                checked
                  ? "border-state-ok-fg bg-state-ok-fg text-white"
                  : "border-border-strong bg-surface",
              )}
            >
              {checked ? <CheckIcon className="size-5" aria-hidden /> : null}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={onOpen}
            aria-expanded={open}
            aria-controls={`details-${row.id}`}
            className="flex min-h-20 w-full items-center gap-3 py-3 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-body leading-snug font-medium text-foreground">
                {row.label}
              </span>
              <span className={cn("mt-1 block text-caption", tone)}>
                {busy ? t("work.saving") : recent ? t("work.justDone") : sentence}
              </span>
            </span>
            <ChevronDownIcon
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-ink-3 transition-transform motion-reduce:transition-none",
                open && "rotate-180",
              )}
            />
          </button>
          {onUndo && recent ? (
            <button
              type="button"
              onClick={onUndo}
              disabled={undoing}
              className="mb-2 inline-flex min-h-11 items-center gap-2 text-label font-medium text-ink-2 underline underline-offset-4"
            >
              {undoTrashesPlanned ? (
                <Trash2Icon className="size-4" aria-hidden />
              ) : (
                <Undo2Icon className="size-4" aria-hidden />
              )}
              {t(undoTrashesPlanned ? "complete.trashConfirm" : "work.undo")}
            </button>
          ) : null}
        </div>
      </div>
      {open ? (
        <div
          id={`details-${row.id}`}
          className="flex flex-col gap-5 border-t border-border px-4 py-5 sm:pl-[4.75rem]"
        >
          {row.description ? (
            <p className="max-w-prose text-body whitespace-pre-wrap text-ink-2">
              {row.description}
            </p>
          ) : null}
          {row.actions.length ? (
            <StepsChecklist
              key={`${row.id}-${row.lastCompletionId}`}
              itemId={row.id}
              steps={row.actions}
            />
          ) : null}
          <dl className="grid gap-4 text-caption sm:grid-cols-2">
            <div>
              <dt className="mb-1 text-ink-3">{t("work.lastDone")}</dt>
              <dd className="text-body text-foreground">
                {row.lastCompletedAt ? formatDate(row.lastCompletedAt) : t("work.noRecord")}
              </dd>
              {row.lastCompletedByName ? (
                <dd className="mt-1 text-ink-2">{row.lastCompletedByName}</dd>
              ) : null}
              {row.lastEngineHours !== null ? (
                <dd className="mt-1 text-ink-2">{formatHours(row.lastEngineHours)}</dd>
              ) : null}
            </div>
            <div>
              <dt className="mb-1 text-ink-3">{t("work.schedule")}</dt>
              <dd className="text-body text-foreground">{interval || t("work.punctual")}</dd>
              {row.dueAt ? (
                <dd className="mt-1 text-ink-2">
                  {t("board.due", { date: formatDate(row.dueAt) })}
                </dd>
              ) : null}
              {row.dueHours !== null ? (
                <dd className="mt-1 text-ink-2">
                  {t("board.dueHours", { hours: formatHours(row.dueHours) })}
                </dd>
              ) : null}
            </div>
          </dl>
          {handed ? (
            <p className="text-body text-ink-2">{t(`handed.${handed.key}`, handed.values)}</p>
          ) : null}
          {canContribute ? (
            <div className="flex flex-wrap gap-2">
              {!checked && !recent ? (
                <Button onClick={onTick} disabled={busy || undoing}>
                  <CheckIcon />
                  {t("work.doneToday")}
                </Button>
              ) : null}
              <Button variant="outline" onClick={onDetails} disabled={busy || undoing}>
                <Clock3Icon />
                {t(checked || recent ? "work.recordAgain" : "work.otherDate")}
              </Button>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-t border-border pt-2">
            <Link
              href={categoryPath(boatId, row.categoryId, { open: row.id }) as Route}
              className="inline-flex min-h-11 items-center gap-2 text-label text-ink-2 underline underline-offset-4"
            >
              <HistoryIcon className="size-4" aria-hidden />
              {t("work.history")}
            </Link>
            {canWrite ? (
              <Link
                href={editChecklistItemPath(boatId, row.categoryId, row.id) as Route}
                className="inline-flex min-h-11 items-center gap-2 text-label text-ink-2 underline underline-offset-4"
              >
                <PencilIcon className="size-4" aria-hidden />
                {t("work.edit")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}
