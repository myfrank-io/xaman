"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { FileSpreadsheetIcon, ImagesIcon, SailboatIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { Field } from "@/components/forms/Field";
import { formResolver } from "@/components/forms/form-resolver";
import { useFieldError } from "@/components/forms/use-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createBoat } from "@/lib/actions/boat";
import {
  ENGINE_COUNT_CHOICES,
  EXISTING_LOG_FORMATS,
  defaultEngineCount,
  existingLogDestination,
  newBoatEngines,
  splitTemplates,
  type ExistingLogFormat,
  type TemplateOption,
} from "@/lib/boat-onboarding";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { createBoatSchema } from "@/lib/schemas/boat";

/**
 * The form holds strings; the schema turns them into what the action receives. `engines` is not
 * a field: it is built at submit time from the count and the chosen model, so what the person
 * answers is « combien » and what the server gets is a list of engines with their positions.
 */
const newBoatFormSchema = createBoatSchema.pick({ boatId: true, name: true, templateId: true });
type NewBoatOutput = z.output<typeof newBoatFormSchema>;

type NewBoatFormState = {
  boatId: string;
  name: string;
  templateId: string;
  engineCount: string;
  /** What the boat's history is written on today (D65): it decides where the creation lands. */
  logbook: ExistingLogFormat;
};

/** The icon of each format — « rien à reprendre » is a word, not a picture. */
const LOGBOOK_ICONS: Partial<Record<ExistingLogFormat, typeof FileSpreadsheetIcon>> = {
  spreadsheet: FileSpreadsheetIcon,
  paper: ImagesIcon,
};

/**
 * « Ajouter mon bateau » (D64, E11-3). Three answers and the carnet is open: a name, a model,
 * and how many engines.
 *
 * There is no boat type field and no builder field. The model carries all three, and asking a
 * question whose answer is already known is exactly the kind of step that makes people abandon
 * an onboarding — `create_boat` copies them off the template, and the Bateau screen edits them
 * afterwards for the rare boat that needs it.
 *
 * The engine count is the only question with a reliable default, so it is a toggle already on
 * the right answer rather than a field to fill: from there it is one tap to « Créer le carnet ».
 */
export function NewBoatForm({ templates }: { templates: TemplateOption[] }) {
  const t = useTranslations("boats.new");
  const te = useTranslations("engines.onboarding");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Drawn once, when the screen opens (rule 11, D18): the second tap of a double tap replays the
  // same id and `create_boat` hands back the same boat instead of opening a second carnet.
  const [boatId] = useState(() => crypto.randomUUID());

  const { exact, generic } = useMemo(() => splitTemplates(templates), [templates]);

  const form = useForm<NewBoatFormState, unknown, NewBoatOutput>({
    resolver: formResolver<NewBoatFormState, NewBoatOutput>(newBoatFormSchema),
    defaultValues: { boatId, name: "", templateId: "", engineCount: "1", logbook: "none" },
  });

  // Registered like any other plain input, rather than driven by `setValue` from a controlled
  // `value`: the model is read back by `useWatch` on the same render (the summary line and the
  // engine default both depend on it), and a registered field is the subscription that makes
  // that reliable. `chooseTemplate` then only has the side effect to apply.
  const templateField = form.register("templateId");

  // `useWatch` rather than `form.watch()`: the latter returns a fresh function every render,
  // which opts the whole component out of the React Compiler.
  const templateId = useWatch({ control: form.control, name: "templateId" });
  const template = templates.find((option) => option.id === templateId) ?? null;

  // Read back on the same render: the help line under the chips and the label of the submit
  // button both say where « Créer le carnet » is about to land.
  const logbook = useWatch({ control: form.control, name: "logbook" });

  function chooseTemplate(nextId: string) {
    const next = templates.find((option) => option.id === nextId);
    // The model knows how many engines the hull usually carries. A count the person has already
    // corrected by hand is never overwritten.
    if (next && !form.getFieldState("engineCount").isDirty) {
      form.setValue("engineCount", String(defaultEngineCount(next.boatType)));
    }
  }

  function onSubmit(values: NewBoatOutput) {
    const count = Number(form.getValues("engineCount"));
    startTransition(async () => {
      const result = await createBoat({
        ...values,
        engines: newBoatEngines(count, template?.boatType ?? null, {
          single: te("single"),
          port: te("port"),
          starboard: te("starboard"),
          outboard: te("outboard"),
        }),
      });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      // Straight into the boat — on the screen the answer about the existing carnet asked for
      // (D65): the import of a spreadsheet, that of the paper pages, or the dashboard and its
      // « carnet neuf » block when there is nothing to take over.
      router.replace(existingLogDestination(logbook, result.data.boatId) as Route);
      router.refresh();
    });
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6" noValidate>
      <Field id="boat-name" label={t("name")} required error={fieldError(errors.name)}>
        <Input
          id="boat-name"
          autoFocus
          autoCapitalize="words"
          autoComplete="off"
          enterKeyHint="next"
          placeholder={t("namePlaceholder")}
          aria-invalid={errors.name ? true : undefined}
          {...form.register("name")}
        />
      </Field>

      <Field
        id="boat-template"
        label={t("model")}
        required
        help={
          template
            ? t("modelSummary", {
                categories: template.categoryCount,
                items: template.itemCount,
              })
            : t("modelHelp")
        }
        error={fieldError(errors.templateId)}
      >
        <NativeSelect
          id="boat-template"
          {...templateField}
          onChange={(event) => {
            void templateField.onChange(event);
            chooseTemplate(event.target.value);
          }}
          aria-invalid={errors.templateId ? true : undefined}
        >
          <option value="">{t("modelPlaceholder")}</option>
          {exact.length > 0 ? (
            <optgroup label={t("modelGroupExact")}>
              {exact.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          ) : null}
          {generic.length > 0 ? (
            <optgroup label={t("modelGroupGeneric")}>
              {generic.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </NativeSelect>
      </Field>

      <Field id="boat-engines-1" label={t("engines")} help={t("enginesHelp")}>
        <Controller
          control={form.control}
          name="engineCount"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              value={field.value}
              aria-label={t("engines")}
              onValueChange={(next) => next && field.onChange(next)}
            >
              {ENGINE_COUNT_CHOICES.map((count) => (
                <ToggleGroupItem key={count} value={String(count)} id={`boat-engines-${count}`}>
                  {te("count", { count })}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </Field>

      <Field
        id="boat-logbook-none"
        label={t("logbook")}
        help={t(`logbookNext.${logbook}` as "logbookNext.none")}
        className="rounded-xl border border-border bg-surface p-4 shadow-sm sm:p-5"
      >
        <ToggleGroup
          type="single"
          value={logbook}
          aria-label={t("logbook")}
          onValueChange={(next) =>
            next && form.setValue("logbook", next as ExistingLogFormat, { shouldDirty: true })
          }
        >
          {EXISTING_LOG_FORMATS.map((format) => {
            const Icon = LOGBOOK_ICONS[format];
            return (
              <ToggleGroupItem key={format} value={format} id={`boat-logbook-${format}`}>
                {Icon ? <Icon aria-hidden /> : null}
                {t(`logbookFormat.${format}` as "logbookFormat.none")}
              </ToggleGroupItem>
            );
          })}
        </ToggleGroup>
      </Field>

      <Button type="submit" size="xl" disabled={pending}>
        {pending ? <Spinner /> : <SailboatIcon />}
        {logbook === "none" ? t("submit") : t("submitImport")}
      </Button>
    </form>
  );
}
