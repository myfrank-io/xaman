"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";

import { PageHeader } from "@/components/common/PageHeader";
import { ContactPicker } from "@/components/contacts/ContactPicker";
import type { ContactOption } from "@/components/contacts/specialties";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { numberToInput, textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { upsertHaulOut } from "@/lib/actions/haul-outs";
import { todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath, haulOutPath } from "@/lib/queries/boat-routes";
import { upsertHaulOutSchema } from "@/lib/schemas/haul-outs";

export type HaulOutFormValues = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  yardContactId: string | null;
  yardName: string | null;
  works: string | null;
  cost: number | null;
  updatedAt: string;
};

type HaulOutFormState = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  startedAt: string;
  endedAt: string | null;
  yardContactId: string | null;
  yardName: string;
  works: string;
  cost: string;
};
type HaulOutOutput = z.output<typeof upsertHaulOutSchema>;

/**
 * Haul-out form (E6-1, flow g), a page: two separate dates — « Sortie » and « Remise à
 * l'eau » — never a range picker (ux-flows §4.3), the yard from the directory or free text,
 * the works as a textarea and the yard's own cost.
 */
export function HaulOutForm({
  boatId,
  haulOut,
  contacts,
}: {
  boatId: string;
  haulOut: HaulOutFormValues | null;
  contacts: ContactOption[];
}) {
  const t = useTranslations("haulOuts");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());

  const form = useForm<HaulOutFormState, unknown, HaulOutOutput>({
    resolver: formResolver<HaulOutFormState, HaulOutOutput>(upsertHaulOutSchema),
    defaultValues: {
      id: haulOut?.id ?? newId,
      boatId,
      expectedUpdatedAt: haulOut?.updatedAt,
      startedAt: haulOut?.startedAt ?? todayString(),
      // Empty on purpose at the lift-out: it is what makes the boat « à terre ».
      endedAt: haulOut?.endedAt ?? null,
      yardContactId: haulOut?.yardContactId ?? null,
      yardName: textToInput(haulOut?.yardName),
      works: textToInput(haulOut?.works),
      cost: numberToInput(haulOut?.cost),
    },
  });
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const errors = form.formState.errors;
  const backHref = haulOut ? haulOutPath(boatId, haulOut.id) : boatPath(boatId, "haulOuts");
  // useWatch and not form.watch(): the returned function cannot be memoized safely.
  const startedAt = useWatch({ control: form.control, name: "startedAt" });
  const yardContactId = useWatch({ control: form.control, name: "yardContactId" });

  // The only rule the schema adds beyond the field types; its key lives in this namespace.
  const endedError =
    errors.endedAt?.message === "haul_out_end_before_start"
      ? t("errors.endBeforeStart")
      : fieldError(errors.endedAt);

  function onSubmit(values: HaulOutOutput) {
    startTransition(async () => {
      const result = await upsertHaulOut(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      router.push(haulOutPath(boatId, result.data.haulOutId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={haulOut ? t("edit") : t("new")} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="haul-out-start"
          label={t("fields.startedAt")}
          required
          error={fieldError(errors.startedAt)}
        >
          <Controller
            control={form.control}
            name="startedAt"
            render={({ field }) => (
              <DateField id="haul-out-start" value={field.value} onValueChange={field.onChange} />
            )}
          />
        </Field>
        <Field
          id="haul-out-end"
          label={t("fields.endedAt")}
          help={t("endedHelp")}
          error={endedError}
        >
          <Controller
            control={form.control}
            name="endedAt"
            render={({ field }) => (
              <DateField
                id="haul-out-end"
                value={field.value ?? ""}
                min={startedAt}
                onValueChange={(value) => field.onChange(value || null)}
              />
            )}
          />
        </Field>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="haul-out-yard">{t("fields.yard")}</Label>
        <Controller
          control={form.control}
          name="yardContactId"
          render={({ field }) => (
            <ContactPicker
              id="haul-out-yard"
              boatId={boatId}
              contacts={contacts}
              value={field.value}
              onValueChange={field.onChange}
              canCreate
              label={t("fields.yard")}
              crewLabel={t("noYard")}
            />
          )}
        />
        {yardContactId === null ? (
          <Field
            id="haul-out-yard-name"
            label={t("fields.yardName")}
            help={t("yardNameHelp")}
            error={fieldError(errors.yardName)}
          >
            <Input
              id="haul-out-yard-name"
              autoComplete="off"
              autoCapitalize="words"
              className="max-w-sm"
              {...form.register("yardName")}
            />
          </Field>
        ) : null}
      </div>

      <Field
        id="haul-out-works"
        label={t("fields.works")}
        help={t("worksHelp")}
        error={fieldError(errors.works)}
      >
        <Textarea
          id="haul-out-works"
          rows={5}
          autoCapitalize="sentences"
          {...form.register("works")}
        />
      </Field>

      <Field id="haul-out-cost" label={t("fields.cost")} error={fieldError(errors.cost)}>
        <Controller
          control={form.control}
          name="cost"
          render={({ field }) => (
            <NumericField
              id="haul-out-cost"
              value={field.value}
              onValueChange={(raw) => field.onChange(raw)}
              suffix="€"
              enterKeyHint="done"
              className="max-w-40"
              containerClassName="max-w-40"
              aria-invalid={errors.cost ? true : undefined}
            />
          )}
        />
      </Field>

      <FormActionBar
        pending={pending}
        onCancel={() =>
          guard.leave(() => router.push(backHref as Parameters<typeof router.push>[0]))
        }
      />
      <DiscardDialog open={guard.open} onStay={guard.stay} onDiscard={guard.discard} />
    </form>
  );
}
