"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field } from "@/components/forms/Field";
import { useFieldError } from "@/components/forms/use-field-error";
import { numberToInput } from "@/components/forms/form-values";
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
import { updateHourReading } from "@/lib/actions/engines";
import { todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { updateHourReadingSchema } from "@/lib/schemas/engines";

export type EditableReading = {
  id: string;
  hours: number;
  readAt: string;
  note: string | null;
  updatedAt: string;
};

type FieldErrors = Partial<Record<"hours" | "readAt" | "note", string>>;

// D16: the reading history is editable; the views recompute everything downstream.
export function EditReadingDialog({
  boatId,
  reading,
  onOpenChange,
}: {
  boatId: string;
  reading: EditableReading | null;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("engines.reading");
  return (
    <Dialog open={reading !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("edit")}</DialogTitle>
          <DialogDescription className="sr-only">{t("edit")}</DialogDescription>
        </DialogHeader>
        {reading ? (
          <EditReadingForm
            key={reading.id}
            boatId={boatId}
            reading={reading}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function EditReadingForm({
  boatId,
  reading,
  onClose,
}: {
  boatId: string;
  reading: EditableReading;
  onClose: () => void;
}) {
  const t = useTranslations("engines.reading");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [hours, setHours] = useState(numberToInput(reading.hours));
  const [readAt, setReadAt] = useState(reading.readAt);
  const [note, setNote] = useState(reading.note ?? "");
  const [errors, setErrors] = useState<FieldErrors>({});

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = updateHourReadingSchema.safeParse({
      boatId,
      readingId: reading.id,
      expectedUpdatedAt: reading.updatedAt,
      hours,
      readAt,
      note,
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
    startTransition(async () => {
      const result = await updateHourReading(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("updated"));
      onClose();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field id="edit-reading-hours" label={t("hours")} required error={errors.hours}>
        <NumericField
          id="edit-reading-hours"
          value={hours}
          onValueChange={(raw) => setHours(raw)}
          suffix="h"
          autoFocus
          aria-invalid={errors.hours ? true : undefined}
        />
      </Field>
      <Field id="edit-reading-date" label={t("date")} required error={errors.readAt}>
        <DateField
          id="edit-reading-date"
          value={readAt}
          onValueChange={setReadAt}
          max={todayString()}
        />
      </Field>
      <Field id="edit-reading-note" label={t("note")} error={errors.note}>
        <Input
          id="edit-reading-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          autoComplete="off"
          autoCapitalize="sentences"
        />
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
