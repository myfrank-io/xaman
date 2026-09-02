"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { undoToast } from "@/components/common/UndoToast";
import { Field } from "@/components/forms/Field";
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
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { completeChecklistItem, deleteCompletion } from "@/lib/actions/checklist";
import { formatDate, formatHours, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { addDays } from "@/lib/numbers";
import { completeItemSchema } from "@/lib/schemas/checklist";

export type CompletableItem = {
  id: string;
  label: string;
  categoryName: string;
  intervalMonths: number | null;
  intervalHours: number | null;
  engine: { id: string; label: string; lastHours: number | null; lastDate: string | null } | null;
  lastCompletedAt: string | null;
  lastCompletedByName: string | null;
  lastEngineHours: number | null;
};

export type CompletionMember = { id: string; name: string };

export type SavedCompletion = {
  id: string;
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
  onCompleted?: (item: CompletableItem, completion: SavedCompletion) => void;
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
  onCompleted?: (item: CompletableItem, completion: SavedCompletion) => void;
  onUndone?: (item: CompletableItem, completionId: string) => void;
}) {
  const t = useTranslations("checklist.complete");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [completionId] = useState(() => crypto.randomUUID());
  const [completedAt, setCompletedAt] = useState(() => todayString());
  const [by, setBy] = useState<string>("me");
  const [otherName, setOtherName] = useState("");
  const [hours, setHours] = useState("");
  const [nextDueAt, setNextDueAt] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});

  const hoursRequired = item.intervalHours !== null;
  const engine = item.engine;
  const alreadyToday = item.lastCompletedAt === todayString();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = completeItemSchema.safeParse({
      id: completionId,
      boatId,
      itemId: item.id,
      completedAt,
      completedBy: by === "other" ? null : by === "me" ? currentUserId : by,
      completedByName: by === "other" ? otherName : null,
      engineHours: hoursRequired || hours.trim() !== "" ? hours : null,
      nextDueAt,
      note,
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
      by === "other"
        ? otherName
        : by === "me"
          ? currentUserName
          : (members.find((member) => member.id === by)?.name ?? "");
    startTransition(async () => {
      const result = await completeChecklistItem(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      const saved: SavedCompletion = {
        id: completionId,
        completedAt: parsed.data.completedAt,
        completedByName: byName,
        engineHours: parsed.data.engineHours,
        nextDueAt: parsed.data.nextDueAt,
      };
      onCompleted?.(item, saved);
      onClose();
      undoToast({
        message: t("saved", { label: item.label }),
        undoLabel: t("undo"),
        onUndo: () => {
          void deleteCompletion({ boatId, completionId }).then((undo) => {
            if (!undo.ok) {
              toast.error(errorMessage(undo.error));
              return;
            }
            onUndone?.(item, completionId);
            toast.success(t("undone"));
            router.refresh();
          });
        },
      });
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
      <Field id="complete-by" label={t("by")}>
        <NativeSelect id="complete-by" value={by} onChange={(event) => setBy(event.target.value)}>
          <option value="me">
            {t("me")} ({currentUserName})
          </option>
          {members
            .filter((member) => member.id !== currentUserId)
            .map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          <option value="other">{t("someoneElse")}</option>
        </NativeSelect>
      </Field>
      {by === "other" ? (
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
      <Field
        id="complete-valid-until"
        label={t("validUntil")}
        help={t("validUntilHelp")}
        error={errors.nextDueAt}
      >
        <Input
          id="complete-valid-until"
          type="date"
          value={nextDueAt}
          min={addDays(completedAt, 1)}
          onChange={(event) => setNextDueAt(event.target.value)}
          className="w-auto min-w-40 num"
        />
      </Field>
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
