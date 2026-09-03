"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { SailboatIcon } from "lucide-react";
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
  defaultEngineCount,
  newBoatEngines,
  splitTemplates,
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
};

/**
 * « Ajouter mon bateau » (D63, E11-3). Three answers and the carnet is open: a name, a model,
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
    defaultValues: { boatId, name: "", templateId: "", engineCount: "1" },
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
      // Straight into the boat: the dashboard's « carnet neuf » block takes it from there.
      router.replace(`/boats/${result.data.boatId}/dashboard` as Route);
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

      <Button type="submit" size="xl" disabled={pending}>
        {pending ? <Spinner /> : <SailboatIcon />}
        {t("submit")}
      </Button>
    </form>
  );
}
