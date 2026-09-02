"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";

import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { PageHeader } from "@/components/common/PageHeader";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { upsertEngine } from "@/lib/actions/engines";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatTabPath, enginePath } from "@/lib/queries/boat-routes";
import {
  enginePositionSchema,
  upsertEngineSchema,
  type EnginePosition,
} from "@/lib/schemas/engines";

export type EngineFormValues = {
  id: string;
  label: string;
  position: EnginePosition;
  brand: string | null;
  model: string | null;
  serial: string | null;
  installedAt: string | null;
  notes: string | null;
  updatedAt: string;
};

type EngineForm = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  label: string;
  position: EnginePosition;
  brand: string;
  model: string;
  serial: string;
  installedAt: string | null;
  notes: string;
};
type EngineOutput = z.output<typeof upsertEngineSchema>;

// Engine create / edit page (E2-2). The id is drawn when the page opens (rule 11).
export function EngineForm({
  boatId,
  engine,
}: {
  boatId: string;
  engine: EngineFormValues | null;
}) {
  const t = useTranslations("engines");
  const tp = useTranslations("enginePosition");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());
  const form = useForm<EngineForm, unknown, EngineOutput>({
    resolver: formResolver<EngineForm, EngineOutput>(upsertEngineSchema),
    defaultValues: {
      id: engine?.id ?? newId,
      boatId,
      expectedUpdatedAt: engine?.updatedAt,
      label: engine?.label ?? "",
      position: engine?.position ?? "starboard",
      brand: textToInput(engine?.brand),
      model: textToInput(engine?.model),
      serial: textToInput(engine?.serial),
      installedAt: engine?.installedAt ?? null,
      notes: textToInput(engine?.notes),
    },
  });
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const errors = form.formState.errors;
  const backHref = engine ? enginePath(boatId, engine.id) : boatTabPath(boatId, "engines");

  function onSubmit(values: EngineOutput) {
    startTransition(async () => {
      const result = await upsertEngine(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      router.push(enginePath(boatId, result.data.engineId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={engine ? t("edit") : t("new")} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field
          id="engine-label"
          label={t("fields.label")}
          required
          error={fieldError(errors.label)}
        >
          <Input
            id="engine-label"
            autoComplete="off"
            autoFocus={!engine}
            aria-invalid={errors.label ? true : undefined}
            {...form.register("label")}
          />
        </Field>
        <Field
          id="engine-position"
          label={t("fields.position")}
          required
          error={fieldError(errors.position)}
        >
          <Controller
            control={form.control}
            name="position"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                id="engine-position"
                value={field.value}
                onValueChange={(next) => next && field.onChange(next)}
                className="w-full"
              >
                {enginePositionSchema.options.map((position) => (
                  <ToggleGroupItem key={position} value={position} className="min-h-11">
                    {tp(position)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </Field>
        <Field id="engine-brand" label={t("fields.brand")} error={fieldError(errors.brand)}>
          <Input id="engine-brand" autoComplete="off" {...form.register("brand")} />
        </Field>
        <Field id="engine-model" label={t("fields.model")} error={fieldError(errors.model)}>
          <Input id="engine-model" autoComplete="off" {...form.register("model")} />
        </Field>
        <Field id="engine-serial" label={t("fields.serial")} error={fieldError(errors.serial)}>
          <Input
            id="engine-serial"
            autoComplete="off"
            autoCapitalize="none"
            {...form.register("serial")}
          />
        </Field>
        <Field
          id="engine-installed"
          label={t("fields.installedAt")}
          error={fieldError(errors.installedAt)}
        >
          <Controller
            control={form.control}
            name="installedAt"
            render={({ field }) => (
              <Input
                id="engine-installed"
                type="date"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value || null)}
                className="w-auto min-w-40 num"
              />
            )}
          />
        </Field>
      </div>
      <Field id="engine-notes" label={t("fields.notes")} error={fieldError(errors.notes)}>
        <Textarea
          id="engine-notes"
          rows={4}
          autoCapitalize="sentences"
          {...form.register("notes")}
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
