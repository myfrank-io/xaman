"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import type { z } from "zod";

import type { Boat } from "@/components/boat/BoatProvider";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { numberToInput, textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { updateBoat } from "@/lib/actions/boat";
import { formatNumber } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatTypeSchema, updateBoatSchema, type BoatType } from "@/lib/schemas/boat";

type IdentityForm = {
  boatId: string;
  expectedUpdatedAt?: string;
  name: string;
  type: BoatType;
  builder: string;
  model: string;
  hullNumber: string;
  year: string;
  flag: string;
  homePort: string;
  sailNumber: string;
  lengthM: string;
  beamM: string;
  draftM: string;
  notes: string;
};
type IdentityOutput = z.output<typeof updateBoatSchema>;

function toForm(boat: Boat): IdentityForm {
  return {
    boatId: boat.id,
    expectedUpdatedAt: boat.updated_at,
    name: boat.name,
    type: boat.type,
    builder: textToInput(boat.builder),
    model: textToInput(boat.model),
    hullNumber: textToInput(boat.hull_number),
    year: numberToInput(boat.year),
    flag: textToInput(boat.flag),
    homePort: textToInput(boat.home_port),
    sailNumber: textToInput(boat.sail_number),
    lengthM: numberToInput(boat.length_m),
    beamM: numberToInput(boat.beam_m),
    draftM: numberToInput(boat.draft_m),
    notes: textToInput(boat.notes),
  };
}

function Value({ children }: { children: React.ReactNode }) {
  const tc = useTranslations("common");
  return children ? (
    <dd className="mt-0.5 text-body text-foreground">{children}</dd>
  ) : (
    <dd className="mt-0.5 text-body text-ink-3">{tc("notSpecified")}</dd>
  );
}

function Term({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-caption font-semibold tracking-wide text-ink-3 uppercase">{children}</dt>
  );
}

function meters(value: number | string | null): string | null {
  if (value === null || value === undefined) return null;
  return `${formatNumber(value)} m`;
}

// Boat identity card (E2-1): read view, edited in place by owner/editor.
export function BoatIdentity({
  boat,
  canEdit,
  templateName,
}: {
  boat: Boat;
  canEdit: boolean;
  templateName: string | null;
}) {
  const t = useTranslations("boat.identity");
  const tt = useTranslations("boatType");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<IdentityForm, unknown, IdentityOutput>({
    resolver: formResolver<IdentityForm, IdentityOutput>(updateBoatSchema),
    defaultValues: toForm(boat),
  });
  const guard = useUnsavedGuard(editing && form.formState.isDirty);
  const errors = form.formState.errors;

  function startEditing() {
    form.reset(toForm(boat));
    setEditing(true);
  }

  function cancel() {
    guard.leave(() => {
      form.reset(toForm(boat));
      setEditing(false);
    });
  }

  function onSubmit(values: IdentityOutput) {
    startTransition(async () => {
      const result = await updateBoat(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-h2">{t("title")}</CardTitle>
          {canEdit ? (
            <CardAction>
              <Button type="button" variant="outline" onClick={startEditing}>
                <PencilIcon />
                {t("edit")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <Term>{t("name")}</Term>
              <Value>{boat.name}</Value>
            </div>
            <div>
              <Term>{t("type")}</Term>
              <Value>{tt(boat.type)}</Value>
            </div>
            <div>
              <Term>{t("builder")}</Term>
              <Value>{boat.builder}</Value>
            </div>
            <div>
              <Term>{t("model")}</Term>
              <Value>{boat.model}</Value>
            </div>
            <div>
              <Term>{t("hullNumber")}</Term>
              <Value>{boat.hull_number}</Value>
            </div>
            <div>
              <Term>{t("year")}</Term>
              <Value>{boat.year ? <span className="num">{boat.year}</span> : null}</Value>
            </div>
            <div>
              <Term>{t("flag")}</Term>
              <Value>{boat.flag}</Value>
            </div>
            <div>
              <Term>{t("homePort")}</Term>
              <Value>{boat.home_port}</Value>
            </div>
            <div>
              <Term>{t("sailNumber")}</Term>
              <Value>{boat.sail_number}</Value>
            </div>
          </dl>
          <Accordion type="single" collapsible className="border-t border-border">
            <AccordionItem value="dimensions">
              <AccordionTrigger>{t("characteristics")}</AccordionTrigger>
              <AccordionContent>
                <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
                  <div>
                    <Term>{t("lengthM")}</Term>
                    <Value>{meters(boat.length_m)}</Value>
                  </div>
                  <div>
                    <Term>{t("beamM")}</Term>
                    <Value>{meters(boat.beam_m)}</Value>
                  </div>
                  <div>
                    <Term>{t("draftM")}</Term>
                    <Value>{meters(boat.draft_m)}</Value>
                  </div>
                </dl>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          <div className="border-t border-border pt-4">
            <h3 className="text-overline text-ink-2 uppercase">{t("notes")}</h3>
            <p className="mt-2 text-body whitespace-pre-wrap text-foreground">
              {boat.notes || <span className="text-ink-3">{t("noNotes")}</span>}
            </p>
          </div>
          <p className="text-caption text-ink-3">
            {templateName ? t("template", { name: templateName }) : t("noTemplate")}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <CardTitle className="text-h2">{t("edit")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="boat-name" label={t("name")} required error={fieldError(errors.name)}>
              <Input
                id="boat-name"
                autoComplete="off"
                aria-invalid={errors.name ? true : undefined}
                {...form.register("name")}
              />
            </Field>
            <Field id="boat-type" label={t("type")} required error={fieldError(errors.type)}>
              <NativeSelect id="boat-type" {...form.register("type")}>
                {boatTypeSchema.options.map((type) => (
                  <option key={type} value={type}>
                    {tt(type)}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field id="boat-builder" label={t("builder")} error={fieldError(errors.builder)}>
              <Input id="boat-builder" autoComplete="off" {...form.register("builder")} />
            </Field>
            <Field id="boat-model" label={t("model")} error={fieldError(errors.model)}>
              <Input id="boat-model" autoComplete="off" {...form.register("model")} />
            </Field>
            <Field id="boat-hull" label={t("hullNumber")} error={fieldError(errors.hullNumber)}>
              <Input id="boat-hull" autoComplete="off" {...form.register("hullNumber")} />
            </Field>
            <Field id="boat-year" label={t("year")} error={fieldError(errors.year)}>
              <NumericField
                id="boat-year"
                mode="numeric"
                aria-invalid={errors.year ? true : undefined}
                {...form.register("year")}
              />
            </Field>
            <Field id="boat-flag" label={t("flag")} error={fieldError(errors.flag)}>
              <Input id="boat-flag" autoComplete="off" {...form.register("flag")} />
            </Field>
            <Field id="boat-port" label={t("homePort")} error={fieldError(errors.homePort)}>
              <Input id="boat-port" autoComplete="off" {...form.register("homePort")} />
            </Field>
            <Field id="boat-sail" label={t("sailNumber")} error={fieldError(errors.sailNumber)}>
              <Input id="boat-sail" autoComplete="off" {...form.register("sailNumber")} />
            </Field>
          </div>
          <fieldset className="grid gap-5 border-t border-border pt-5 sm:grid-cols-3">
            <legend className="text-overline text-ink-2 uppercase">{t("characteristics")}</legend>
            <Field id="boat-length" label={t("lengthM")} error={fieldError(errors.lengthM)}>
              <NumericField
                id="boat-length"
                suffix={t("meters")}
                aria-invalid={errors.lengthM ? true : undefined}
                {...form.register("lengthM")}
              />
            </Field>
            <Field id="boat-beam" label={t("beamM")} error={fieldError(errors.beamM)}>
              <NumericField
                id="boat-beam"
                suffix={t("meters")}
                aria-invalid={errors.beamM ? true : undefined}
                {...form.register("beamM")}
              />
            </Field>
            <Field id="boat-draft" label={t("draftM")} error={fieldError(errors.draftM)}>
              <NumericField
                id="boat-draft"
                suffix={t("meters")}
                aria-invalid={errors.draftM ? true : undefined}
                {...form.register("draftM")}
              />
            </Field>
          </fieldset>
          <Field id="boat-notes" label={t("notes")} error={fieldError(errors.notes)}>
            <Textarea
              id="boat-notes"
              rows={4}
              autoCapitalize="sentences"
              {...form.register("notes")}
            />
          </Field>
          <FormActionBar pending={pending} onCancel={cancel} className="mt-2" />
        </CardContent>
      </form>
      <DiscardDialog open={guard.open} onStay={guard.stay} onDiscard={guard.discard} />
    </Card>
  );
}
