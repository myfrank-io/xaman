"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { differenceInCalendarDays } from "date-fns";

import { Field } from "@/components/forms/Field";
import { useFieldError } from "@/components/forms/use-field-error";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { addHourReading } from "@/lib/actions/engines";
import { formatDate, formatHours, toDate, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { parseDecimal } from "@/lib/numbers";
import { addHourReadingSchema, ENGINE_HOURS_JUMP_WARNING } from "@/lib/schemas/engines";

export type ReadingEngine = {
  id: string;
  label: string;
  lastHours: number | null;
  lastDate: string | null;
};

type FieldErrors = Partial<Record<"engineId" | "hours" | "readAt" | "note", string>>;

/**
 * Manual hour reading (ux-flows §3e): engine chips, counter, date, note. 3 taps, < 15 s.
 * A lower value is a warning, never a refusal (the paper logbook shows why), with the
 * « counter replaced » box for owner/editor (D12). The row id is drawn when the dialog
 * opens, so a double tap on « Enregistrer » inserts one row (rule 11).
 */
export function HourReadingDialog({
  boatId,
  engines,
  defaultEngineId,
  open,
  onOpenChange,
  canResetCounter,
  onSaved,
}: {
  boatId: string;
  engines: ReadingEngine[];
  defaultEngineId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canResetCounter: boolean;
  onSaved?: () => void;
}) {
  const t = useTranslations("engines.reading");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">{t("title")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog: every opening starts from fresh state and a fresh row id. */}
        <ReadingForm
          boatId={boatId}
          engines={engines}
          defaultEngineId={defaultEngineId}
          canResetCounter={canResetCounter}
          onClose={() => onOpenChange(false)}
          onSaved={onSaved}
        />
      </DialogContent>
    </Dialog>
  );
}

function ReadingForm({
  boatId,
  engines,
  defaultEngineId,
  canResetCounter,
  onClose,
  onSaved,
}: {
  boatId: string;
  engines: ReadingEngine[];
  defaultEngineId?: string;
  canResetCounter: boolean;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const t = useTranslations("engines.reading");
  const te = useTranslations("engines");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [readingId] = useState(() => crypto.randomUUID());
  const [engineId, setEngineId] = useState(defaultEngineId ?? engines[0]?.id ?? "");
  const [hours, setHours] = useState("");
  const [readAt, setReadAt] = useState(() => todayString());
  const [note, setNote] = useState("");
  const [counterReplaced, setCounterReplaced] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  const engine = engines.find((candidate) => candidate.id === engineId);
  const value = parseDecimal(hours);
  const last = engine?.lastHours ?? null;
  const lower = typeof value === "number" && last !== null && value < last;
  const delta = typeof value === "number" && last !== null ? value - last : null;
  const lastDate = toDate(engine?.lastDate);
  const days = lastDate ? differenceInCalendarDays(toDate(readAt) ?? new Date(), lastDate) : null;
  const bigJump = delta !== null && delta > ENGINE_HOURS_JUMP_WARNING;

  let help: string | undefined;
  if (engine && last === null) help = te("firstReading");
  else if (engine && last !== null && engine.lastDate) {
    help = t("last", { hours: formatHours(last), date: formatDate(engine.lastDate) });
    if (delta !== null && delta >= 0 && days !== null) {
      help += ` · ${days > 0 ? t("delta", { hours: formatHours(delta), days }) : t("deltaSameDay", { hours: formatHours(delta) })}`;
    }
  }
  let warning: string | undefined;
  if (lower && last !== null && engine?.lastDate && typeof value === "number") {
    warning = t("lower", {
      value: formatHours(value),
      last: formatHours(last),
      date: formatDate(engine.lastDate),
    });
  } else if (bigJump && engine?.lastDate && delta !== null) {
    warning = t("bigJump", { hours: formatHours(delta), date: formatDate(engine.lastDate) });
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = addHourReadingSchema.safeParse({
      id: readingId,
      boatId,
      engineId,
      hours,
      readAt,
      note: counterReplaced && note.trim() === "" ? t("counterReplacedNote") : note,
      counterReplaced,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof FieldErrors;
        next[key] ??= fieldError({ type: issue.code, message: issue.message });
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await addHourReading(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(
        t("saved", { engine: engine?.label ?? "", hours: formatHours(parsed.data.hours) }),
      );
      onClose();
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      {engines.length === 0 ? (
        <p className="text-body text-ink-2">{t("noEngine")}</p>
      ) : (
        <>
          <div className="grid gap-2">
            <Label>{t("engine")}</Label>
            <ToggleGroup
              type="single"
              value={engineId}
              onValueChange={(next) => next && setEngineId(next)}
              aria-label={t("engine")}
              className="w-full"
            >
              {engines.map((candidate) => (
                <ToggleGroupItem key={candidate.id} value={candidate.id} className="min-h-11">
                  {candidate.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <Field
            id="reading-hours"
            label={t("hours")}
            required
            help={help}
            warning={warning}
            error={errors.hours}
          >
            <NumericField
              id="reading-hours"
              value={hours}
              onValueChange={(raw) => setHours(raw)}
              suffix="h"
              enterKeyHint="next"
              autoFocus
              aria-invalid={errors.hours ? true : undefined}
            />
          </Field>
          {lower && canResetCounter ? (
            <label className="flex min-h-11 items-center gap-3 text-body">
              <Checkbox
                checked={counterReplaced}
                onCheckedChange={(checked) => setCounterReplaced(checked === true)}
              />
              {t("counterReplaced")}
            </label>
          ) : null}
          <Field id="reading-date" label={t("date")} required error={errors.readAt}>
            <DateField
              id="reading-date"
              value={readAt}
              onValueChange={setReadAt}
              max={todayString()}
            />
          </Field>
          <Field id="reading-note" label={t("note")} error={errors.note}>
            <Input
              id="reading-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              autoComplete="off"
              autoCapitalize="sentences"
              enterKeyHint="done"
            />
          </Field>
        </>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || engines.length === 0} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
