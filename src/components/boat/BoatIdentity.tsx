"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";
import type { z } from "zod";

import type { Boat } from "@/components/boat/BoatProvider";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { SuggestionChips } from "@/components/boats/SuggestionChips";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { updateBoat } from "@/lib/actions/boat";
import {
  builderSuggestions,
  findModelById,
  modelSuggestions,
  type BoatModelOption,
} from "@/lib/boat-models";
import { looksLikeFrenchRegistration } from "@/lib/boat-registration";
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
  registration: string;
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
    registration: textToInput(boat.registration),
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

/**
 * Boat identity (E2-1, D37). It is the **heading** of the Bateau screen, not a destination:
 * the name and what the boat is are always on screen above the tabs, a small pencil edits
 * them in place, and everything a person reads twice a year — hull number, flag, home port,
 * dimensions, notes — sits in a « Détails » section that starts closed.
 */
export function BoatIdentity({
  boat,
  canEdit,
  templateName,
  models,
}: {
  boat: Boat;
  canEdit: boolean;
  templateName: string | null;
  /** The catalogue (D66) — suggestions here, and the dimensions of a model that is tapped. */
  models: BoatModelOption[];
}) {
  const t = useTranslations("boat.identity");
  // Shared with the creation screen: the chip lists need names of their own, so that a
  // `<ul aria-label="Modèle">` does not collide with the `<input>` that already has that name.
  const ts = useTranslations("boats.new");
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

  // Shown, never enforced: a boat registered before the 2016 reform or under a foreign flag has a
  // perfectly valid number that this shape does not match. `useWatch` rather than `form.watch()`,
  // which returns a fresh function every render and opts the component out of the React Compiler.
  const registration = useWatch({ control: form.control, name: "registration" });
  const registrationHint = !!registration?.trim() && !looksLikeFrenchRegistration(registration);

  const builder = useWatch({ control: form.control, name: "builder" });
  const model = useWatch({ control: form.control, name: "model" });
  const builders = useMemo(() => builderSuggestions(models, builder), [models, builder]);
  const suggestedModels = useMemo(
    () => modelSuggestions(models, builder, model),
    [models, builder, model],
  );

  /**
   * A tapped model fills the yard and the hull type, and then only the measurements the field is
   * still empty for. Someone who measured their own draft has the right number in front of them;
   * a catalogue that overwrote it with a figure « for this model » would be wrong and confident.
   */
  function pickModel(id: string) {
    const row = findModelById(models, id);
    if (!row) return;
    form.setValue("model", row.model, { shouldDirty: true });
    form.setValue("builder", row.builder, { shouldDirty: true });
    form.setValue("type", row.boatType, { shouldDirty: true });
    for (const [field, value] of [
      ["lengthM", row.lengthM],
      ["beamM", row.beamM],
      ["draftM", row.draftM],
    ] as const) {
      if (value === null) continue;
      if (form.getValues(field).trim() !== "") continue;
      form.setValue(field, numberToInput(value), { shouldDirty: true });
    }
  }

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

  // What the boat IS, in one line: the model and the builder earn the top of the screen;
  // the hull number and the flag are read twice a year and live under « Détails ».
  const subtitle = [
    [boat.model, boat.hull_number ? `#${boat.hull_number}` : null].filter(Boolean).join(" "),
    boat.builder,
    tt(boat.type),
  ]
    .filter(Boolean)
    .join(" · ");

  if (!editing) {
    return (
      <div className="flex flex-col gap-3 sm:gap-4">
        {/* No `flex-wrap`: the subtitle's intrinsic width is 320 px, so with the 12 px gap and
            the 44 px button it asked for 376 px of a 358 px row and the pencil dropped onto a
            line of its own — 56 px measured, for a button that belongs beside the name. `flex-1`
            plus `truncate` lets the text give way instead. At both iPad sizes the subtitle sits
            in a 664 px box, so nothing truncates there. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{boat.name}</h1>
            {subtitle ? (
              <p className="mt-1 truncate num text-sm text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={t("editAria")}
              onClick={startEditing}
            >
              <PencilIcon />
            </Button>
          ) : null}
        </div>
        {/* Read « twice a year », says its own comment below — and it sat between the title and
            the tabs on every single visit, 74 px of the only thing above the data. `order-last`
            bites only on a phone; from `sm` it returns to where it has always been. */}
        <Accordion
          type="single"
          collapsible
          className="order-last rounded-xl border border-border px-4 sm:order-none"
        >
          <AccordionItem value="details">
            <AccordionTrigger className="text-body text-ink-2">{t("details")}</AccordionTrigger>
            <AccordionContent>
              <div className="flex flex-col gap-5 pb-2">
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
                    <Term>{t("registration")}</Term>
                    <Value>
                      {boat.registration ? <span className="num">{boat.registration}</span> : null}
                    </Value>
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
                <div className="border-t border-border pt-4">
                  <h2 className="text-overline text-ink-2 uppercase">{t("notes")}</h2>
                  <p className="mt-2 text-body whitespace-pre-wrap text-foreground">
                    {boat.notes || <span className="text-ink-3">{t("noNotes")}</span>}
                  </p>
                </div>
                <p className="text-caption text-ink-3">
                  {templateName ? t("template", { name: templateName }) : t("noTemplate")}
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
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
            <div className="flex flex-col gap-2">
              <Field id="boat-builder" label={t("builder")} error={fieldError(errors.builder)}>
                <Input id="boat-builder" autoComplete="off" {...form.register("builder")} />
              </Field>
              <SuggestionChips
                options={builders}
                label={ts("builderSuggestions")}
                onPick={(option) => form.setValue("builder", option.key, { shouldDirty: true })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Field id="boat-model" label={t("model")} error={fieldError(errors.model)}>
                <Input id="boat-model" autoComplete="off" {...form.register("model")} />
              </Field>
              <SuggestionChips
                options={suggestedModels}
                label={ts("modelSuggestions")}
                onPick={(option) => pickModel(option.key)}
              />
            </div>
            <Field id="boat-hull" label={t("hullNumber")} error={fieldError(errors.hullNumber)}>
              <Input id="boat-hull" autoComplete="off" {...form.register("hullNumber")} />
            </Field>
            <Field
              id="boat-registration"
              label={t("registration")}
              help={t("registrationHelp")}
              warning={registrationHint ? t("registrationShape") : undefined}
              error={fieldError(errors.registration)}
            >
              <Input
                id="boat-registration"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                className="num"
                placeholder={t("registrationPlaceholder")}
                {...form.register("registration")}
              />
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
            <p className="text-caption text-ink-3 sm:col-span-3">{t("characteristicsHelp")}</p>
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
