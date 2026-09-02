"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field } from "@/components/forms/Field";
import type { LogEngineHours } from "@/components/logs/rows";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createRecurringFromLog } from "@/lib/actions/logs";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { categoryPath } from "@/lib/queries/boat-routes";
import { RECURRING_MONTHS } from "@/lib/schemas/logs";

type Months = (typeof RECURRING_MONTHS)[number];

/**
 * « En faire un entretien récurrent » (E3-4): the intervention becomes a checklist point
 * anchored on its own date, and counts as its first completion. Only the engines this
 * intervention actually recorded hours for can carry an hour interval — otherwise the point
 * would start without an hour reference.
 */
export function RecurringItemDialog({
  boatId,
  logId,
  title,
  engineHours,
  open,
  onOpenChange,
}: {
  boatId: string;
  logId: string;
  title: string;
  engineHours: LogEngineHours[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("logs.detail.recurring");
  const tc = useTranslations("common");
  const tu = useTranslations("units");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [months, setMonths] = useState<Months>(12);
  const [hours, setHours] = useState("");
  const [engineId, setEngineId] = useState<string>(engineHours[0]?.engineId ?? "");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createRecurringFromLog({
        boatId,
        logId,
        itemId: crypto.randomUUID(),
        intervalMonths: months,
        intervalHours: hours,
        engineId: hours.trim() === "" ? null : engineId,
      });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      onOpenChange(false);
      toast.success(t("created", { title }), {
        action: {
          label: t("viewItem"),
          onClick: () =>
            router.push(
              categoryPath(boatId, result.data.categoryId) as Parameters<typeof router.push>[0],
            ),
        },
      });
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { title })}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
          <Field id="recurring-months" label={t("interval")}>
            <ToggleGroup
              type="single"
              value={String(months)}
              aria-label={t("interval")}
              className="flex-wrap"
              onValueChange={(next) => {
                if (next) setMonths(Number(next) as Months);
              }}
            >
              {RECURRING_MONTHS.map((value) => (
                <ToggleGroupItem key={value} value={String(value)} className="min-h-11">
                  {tu("months", { count: value })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          {engineHours.length > 0 ? (
            <>
              <Field id="recurring-hours" label={t("hours")}>
                <NumericField
                  id="recurring-hours"
                  mode="numeric"
                  value={hours}
                  onValueChange={(raw) => setHours(raw)}
                  suffix={t("hoursUnit")}
                />
              </Field>
              {hours.trim() !== "" ? (
                <Field id="recurring-engine" label={t("engine")}>
                  <NativeSelect
                    id="recurring-engine"
                    value={engineId}
                    onChange={(event) => setEngineId(event.target.value)}
                  >
                    {engineHours.map((entry) => (
                      <option key={entry.engineId} value={entry.engineId}>
                        {entry.label}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              ) : null}
            </>
          ) : null}
          {error ? (
            <p role="alert" className="text-caption font-medium text-state-overdue-fg">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {tc("cancel")}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending} aria-busy={pending}>
              {pending ? <Spinner /> : null}
              {pending ? tc("saving") : t("confirm")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
