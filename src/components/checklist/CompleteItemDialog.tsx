"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { undoToast } from "@/components/common/UndoToast";
import { Field } from "@/components/forms/Field";
import { readLastUsed, writeLastUsed } from "@/components/forms/use-last-used";
import { useFieldError } from "@/components/forms/use-field-error";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { submitOrQueue } from "@/components/forms/submit-or-queue";
import { useOnline } from "@/components/common/use-online";
import { useOutbox } from "@/components/offline/use-outbox";
import { addYearsTo, nextDueSentence } from "@/components/checklist/next-due";
import { completeChecklistItem } from "@/lib/actions/checklist";
import { trashLog } from "@/lib/actions/logs";
import { formatDate, formatHours, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { addDays } from "@/lib/numbers";
import { editLogPath, newLogPath } from "@/lib/queries/boat-routes";
import { completeItemSchema } from "@/lib/schemas/checklist";

export type CompletableItem = {
  id: string;
  label: string;
  categoryName: string;
  intervalMonths: number | null;
  intervalHours: number | null;
  engine: {
    id: string;
    label: string;
    lastHours: number | null;
    lastDate: string | null;
    /** false: no hour meter on this engine (D73) — the hours field does not exist. */
    tracksHours: boolean;
  } | null;
  lastCompletedAt: string | null;
  lastCompletedByName: string | null;
  lastEngineHours: number | null;
  /**
   * `checklist_completions.next_due_at` already carried by this point (D11): the expiry printed
   * on the object. Optional so a screen that does not read it simply gets no « Valide jusqu'au ».
   */
  fixedDueAt?: string | null;
  /**
   * The intervention already planned on this point (« Confié au chantier », D141): the tick
   * finishes it instead of writing a second line for the same job.
   */
  openLogId?: string | null;
  openLogContactName?: string | null;
};

export type CompletionMember = { id: string; name: string };

export type SavedCompletion = {
  queued?: boolean;
  /** The optimistic key of the completion; the database draws the real one from the line. */
  id: string;
  /** The intervention the tick wrote, or finished (D140). */
  logId: string;
  completedAt: string;
  completedByName: string;
  engineHours: number | null;
  nextDueAt: string | null;
};

type FieldErrors = Partial<
  Record<"completedAt" | "completedByName" | "engineHours" | "nextDueAt" | "note", string>
>;

/**
 * « Marquer comme fait » (ux-flows §3b): 2 taps without hours, 3 with. Hours are required
 * when the item counts engine hours (zod + database trigger). The 8 s toast carries the undo.
 *
 * Since E20-2 the dialog is no longer the default path — `use-tick` writes the tick in one
 * gesture — and only opens for what cannot be guessed: an hour-based point whose engine was
 * never read. Since D140 what it saves is an intervention, like the tick; « Annuler » puts that
 * intervention in the trash and the completion goes with it.
 */
export function CompleteItemDialog({
  boatId,
  item,
  members,
  currentUserId,
  currentUserName,
  onOpenChange,
  onCompleted,
  onUndone,
}: {
  boatId: string;
  item: CompletableItem | null;
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  onOpenChange: (open: boolean) => void;
  onCompleted?: (
    item: CompletableItem,
    completion: SavedCompletion,
    undo?: () => Promise<boolean>,
  ) => void;
  onUndone?: (item: CompletableItem, completionId: string) => void;
}) {
  const t = useTranslations("checklist.complete");
  const tu = useTranslations("units");
  return (
    <Dialog open={item !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {item ? (
              <>
                <span className="block text-body font-medium text-foreground">{item.label}</span>
                <span className="block">
                  {[
                    item.categoryName,
                    item.intervalMonths ? tu("everyMonths", { count: item.intervalMonths }) : null,
                    item.intervalHours ? tu("everyHours", { count: item.intervalHours }) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {item ? (
          <CompleteForm
            key={item.id}
            boatId={boatId}
            item={item}
            members={members}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            onClose={() => onOpenChange(false)}
            onCompleted={onCompleted}
            onUndone={onUndone}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CompleteForm({
  boatId,
  item,
  members,
  currentUserId,
  currentUserName,
  onClose,
  onCompleted,
  onUndone,
}: {
  boatId: string;
  item: CompletableItem;
  members: CompletionMember[];
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onCompleted?: (
    item: CompletableItem,
    completion: SavedCompletion,
    undo?: () => Promise<boolean>,
  ) => void;
  onUndone?: (item: CompletableItem, completionId: string) => void;
}) {
  const t = useTranslations("checklist.complete");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const to = useTranslations("offline");
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const outbox = useOutbox(boatId);
  const { online } = useOnline();
  // D73: an engine without a meter has no hours to give — the field disappears and the database
  // no longer demands them either (check_completion_hours).
  const engine = item.engine?.tracksHours === false ? null : item.engine;
  const hoursRequired = item.intervalHours !== null && item.engine?.tracksHours !== false;
  const today = todayString();
  const alreadyToday = item.lastCompletedAt === today;
  /**
   * A reading taken today or yesterday is still what the counter shows: the field opens on it
   * rather than asking someone to walk back to the engine room and type it again. Older than
   * that, it stays empty — a stale number saved as a fresh reading is worse than a blank one —
   * and « = reprendre » is there for whoever knows it has not moved.
   */
  const freshReading =
    engine !== null &&
    engine.lastHours !== null &&
    engine.lastDate !== null &&
    engine.lastDate >= addDays(today, -1);
  const punctual = item.intervalMonths === null && item.intervalHours === null;

  const [completionId] = useState(() => crypto.randomUUID());
  // The intervention the tick writes (D140), drawn at open so a replay writes one line (rule 11).
  const [logId] = useState(() => crypto.randomUUID());
  const [completedAt, setCompletedAt] = useState(today);
  // « Réalisé par » opens on the last answer given on this boat (D95). Read once: the dialog is
  // mounted by the tap that opens it, so storage is already there. A member who has left the
  // boat since — or a « Quelqu'un d'autre » whose name belonged to that one job — falls back
  // to « Moi », never to a stale identity.
  const [by, setBy] = useState<string>(() => {
    const remembered = readLastUsed<string>(boatId, "completion.by");
    if (remembered === null || remembered === currentUserId) return "me";
    return remembered === "me" || members.some((member) => member.id === remembered)
      ? remembered
      : "me";
  });
  const [otherName, setOtherName] = useState("");
  const [hours, setHours] = useState(() =>
    freshReading && engine !== null && engine.lastHours !== null
      ? String(engine.lastHours).replace(".", ",")
      : "",
  );
  const [nextDueAt, setNextDueAt] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  /**
   * « Valide jusqu'au » only means one thing: an expiry printed on an object (D11). It belongs
   * to a point that has no interval — a raft, flares, an extinguisher, an insurance — or to one
   * that already carries such a date. On a point that computes its own deadline from an interval
   * it is noise on the screen everybody uses, so it waits behind one tap.
   */
  const [validUntilOpen, setValidUntilOpen] = useState(punctual || Boolean(item.fixedDueAt));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = completeItemSchema.safeParse({
      logId,
      boatId,
      itemId: item.id,
      completedAt,
      completedBy:
        item.openLogContactName || by === "other" ? null : by === "me" ? currentUserId : by,
      completedByName: item.openLogContactName ?? (by === "other" ? otherName : null),
      engineHours: hoursRequired || hours.trim() !== "" ? hours : null,
      nextDueAt,
      note,
      openLogId: item.openLogId ?? null,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof FieldErrors;
        next[key] ??= fieldError({ type: issue.code, message: issue.message });
      }
      if (hoursRequired && parsed.data === undefined && hours.trim() === "") {
        next.engineHours = t("hoursRequired");
      }
      setErrors(next);
      return;
    }
    if (hoursRequired && parsed.data.engineHours === null) {
      setErrors({ engineHours: t("hoursRequired") });
      return;
    }
    setErrors({});
    const byName =
      item.openLogContactName ??
      (by === "other"
        ? otherName
        : by === "me"
          ? currentUserName
          : (members.find((member) => member.id === by)?.name ?? ""));
    startTransition(async () => {
      // Ticking a point is the one gesture that must survive a dead link (E9-1b): offline it
      // is kept on the iPad, the row shows as done, and « Annuler » drops it from the queue.
      const outcome = await submitOrQueue({
        kind: "completion",
        boatId,
        id: logId,
        label: item.label,
        values: parsed.data,
        action: completeChecklistItem,
        enqueue: outbox.enqueue,
        online,
        allowQueue: true,
      });
      if (outcome.status === "full") {
        toast.error(to("queueFull"));
        return;
      }
      if (outcome.status === "refused") {
        toast.error(errorMessage(outcome.error));
        return;
      }
      // Written on the save and never on a keystroke: an abandoned dialog teaches nothing (D95).
      // « Quelqu'un d'autre » is a name for one job, not a habit: it clears the memory.
      if (!item.openLogContactName)
        writeLastUsed(boatId, "completion.by", by === "other" ? null : by);
      // What the tick has just promised, read back in the toast that confirms it.
      const nextDue = nextDueSentence(
        {
          completedAt: parsed.data.completedAt,
          engineHours: parsed.data.engineHours,
          intervalMonths: item.intervalMonths,
          intervalHours: item.intervalHours,
          fixedDueAt: parsed.data.nextDueAt,
        },
        {
          date: formatDate,
          hours: formatHours,
          both: (values) => t("nextDueBoth", values),
          sentence: (values) => t("nextDue", values),
        },
      );
      const saved: SavedCompletion = {
        queued: outcome.status === "queued",
        id: outcome.status === "sent" ? outcome.data.completionId : completionId,
        logId: outcome.status === "sent" ? outcome.data.logId : logId,
        completedAt: parsed.data.completedAt,
        completedByName: byName,
        engineHours: parsed.data.engineHours,
        nextDueAt: parsed.data.nextDueAt,
      };
      let undoing = false;
      let wasUndone = false;
      const undo = async (): Promise<boolean> => {
        if (undoing || wasUndone) return false;
        undoing = true;
        try {
          if (outcome.status === "queued") outbox.discard(logId);
          else {
            const result = await trashLog({ boatId, logId: saved.logId });
            if (!result.ok) {
              toast.error(errorMessage(result.error));
              return false;
            }
          }
          wasUndone = true;
          onUndone?.(item, saved.id);
          toast.success(outcome.status === "queued" ? t("undone") : t("undoneTrashed"));
          router.refresh();
          return true;
        } catch {
          toast.error(errorMessage("errors.unknown"));
          return false;
        } finally {
          undoing = false;
        }
      };
      onCompleted?.(item, saved, undo);
      onClose();
      undoToast({
        message:
          outcome.status === "queued"
            ? to("savedOnDevice")
            : item.openLogId
              ? t("finishedPlanned", { label: item.label })
              : t("saved", { label: item.label }),
        description: nextDue ?? undefined,
        undoLabel: t(item.openLogId && outcome.status !== "queued" ? "trashConfirm" : "undo"),
        onUndo: () => {
          void undo();
        },
      });
      if (outcome.status === "queued") return;
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field id="complete-date" label={t("date")} required error={errors.completedAt}>
        <DateField
          id="complete-date"
          value={completedAt}
          onValueChange={setCompletedAt}
          max={todayString()}
        />
      </Field>
      {/* A boat has two or three people: the answer is a row of chips, not a wheel to spin
          on the gesture people repeat every week. « Autre » keeps the free-text line. */}
      <Field id="complete-by" label={t("by")} group>
        {item.openLogContactName ? (
          <div>
            <p className="text-body font-medium">{item.openLogContactName}</p>
            <p className="mt-1 text-caption text-ink-2">{t("plannedHelp")}</p>
          </div>
        ) : (
          <ToggleGroup
            type="single"
            value={by}
            aria-labelledby="complete-by-label"
            className="flex-wrap justify-start"
            onValueChange={(next) => next && setBy(next)}
          >
            <ToggleGroupItem value="me">{t("me")}</ToggleGroupItem>
            {members
              .filter((member) => member.id !== currentUserId)
              .map((member) => (
                <ToggleGroupItem key={member.id} value={member.id}>
                  {member.name}
                </ToggleGroupItem>
              ))}
            <ToggleGroupItem value="other">{t("otherChip")}</ToggleGroupItem>
          </ToggleGroup>
        )}
      </Field>
      {by === "other" && !item.openLogContactName ? (
        <Field id="complete-other" label={t("otherName")} required error={errors.completedByName}>
          <Input
            id="complete-other"
            value={otherName}
            onChange={(event) => setOtherName(event.target.value)}
            autoComplete="off"
            autoFocus
          />
        </Field>
      ) : null}
      {engine ? (
        <Field
          id="complete-hours"
          label={t("hours", { engine: engine.label })}
          required={hoursRequired}
          error={errors.engineHours}
          help={
            engine.lastHours !== null && engine.lastDate
              ? `${formatHours(engine.lastHours)} · ${formatDate(engine.lastDate)}`
              : undefined
          }
        >
          <div className="flex items-center gap-2">
            <NumericField
              id="complete-hours"
              value={hours}
              onValueChange={(raw) => setHours(raw)}
              suffix="h"
              autoFocus={hoursRequired && by !== "other"}
              aria-invalid={errors.engineHours ? true : undefined}
              containerClassName="flex-1"
            />
            {engine.lastHours !== null ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setHours(String(engine.lastHours).replace(".", ","))}
              >
                {t("takeLast")}
              </Button>
            ) : null}
          </div>
        </Field>
      ) : null}
      {validUntilOpen ? (
        <Field
          id="complete-valid-until"
          label={t("validUntil")}
          help={t("validUntilHelp")}
          error={errors.nextDueAt}
        >
          <div className="flex flex-col gap-2">
            {/* Rule 13: chips + the native wheel. The field only ever means an expiry, so the
                two shortcuts that matter are the two durations printed on the objects. */}
            <DateField
              id="complete-valid-until"
              value={nextDueAt}
              min={addDays(completedAt, 1)}
              future
              onValueChange={setNextDueAt}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setNextDueAt(addYearsTo(completedAt, 1))}
              >
                {t("plusOneYear")}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setNextDueAt(addYearsTo(completedAt, 2))}
              >
                {t("plusTwoYears")}
              </Button>
            </div>
          </div>
        </Field>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="self-start px-2"
          onClick={() => setValidUntilOpen(true)}
        >
          {t("addValidUntil")}
        </Button>
      )}
      <Field id="complete-note" label={t("note")} error={errors.note}>
        <Input
          id="complete-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
        />
      </Field>
      {alreadyToday ? (
        <Alert variant="warning">
          <AlertDescription>
            {t("alreadyToday", { name: item.lastCompletedByName ?? tc("unknown") })}
          </AlertDescription>
        </Alert>
      ) : null}
      {/* « + Ajouter les détails » (E4-5 / D3): the same acknowledgement, told in full — the
          intervention form opens with the point ticked, the date and the hours already typed. */}
      <Link
        href={
          (item.openLogId
            ? editLogPath(boatId, item.openLogId)
            : newLogPath(boatId, {
                item: item.id,
                date: completedAt,
                // a comma separates the pairs in `?hours=`: the decimal one travels as a dot
                hours:
                  engine && hours.trim() !== ""
                    ? `${engine.id}:${hours.trim().replace(",", ".")}`
                    : undefined,
              })) as Route
        }
        className="inline-flex min-h-11 items-center self-start text-label font-medium text-primary underline-offset-4 hover:underline"
      >
        {t(item.openLogId ? "editPlanned" : "addDetails")}
      </Link>
      <p className="text-caption text-ink-3">
        {item.lastCompletedAt
          ? item.lastEngineHours !== null
            ? t("lastDoneHours", {
                date: formatDate(item.lastCompletedAt),
                name: item.lastCompletedByName ?? tc("unknown"),
                hours: formatHours(item.lastEngineHours),
              })
            : t("lastDone", {
                date: formatDate(item.lastCompletedAt),
                name: item.lastCompletedByName ?? tc("unknown"),
              })
          : t("firstTime")}
      </p>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          {pending ? tc("saving") : alreadyToday ? t("saveAnyway") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
