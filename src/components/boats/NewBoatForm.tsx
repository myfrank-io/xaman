"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { ArrowRightIcon } from "lucide-react";
import { toast } from "sonner";
import type { z } from "zod";

import { SuggestionChips } from "@/components/boats/SuggestionChips";
import { Field } from "@/components/forms/Field";
import { formResolver } from "@/components/forms/form-resolver";
import { useFieldError } from "@/components/forms/use-field-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createBoat } from "@/lib/actions/boat";
import {
  ENGINE_COUNT_CHOICES,
  builderSuggestions,
  defaultEngineCount,
  modelSuggestions,
  newBoatEngines,
  type TemplateOption,
} from "@/lib/boat-onboarding";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { onboardingPath } from "@/lib/queries/boat-routes";
import { boatTypeSchema, createBoatSchema } from "@/lib/schemas/boat";

/**
 * The form holds strings; the schema turns them into what the action receives. `engines` is not a
 * field: it is built at submit time from the count and the hull, so what the person answers is
 * « combien » and what the server gets is a list of engines with their positions.
 */
const newBoatFormSchema = createBoatSchema.omit({ engines: true });
type NewBoatOutput = z.output<typeof newBoatFormSchema>;

type NewBoatFormState = {
  boatId: string;
  name: string;
  type: string;
  builder: string;
  model: string;
  engineCount: string;
};

/**
 * Step 1 of three (D67, D65, E11-3): « Le bateau ». It asks about the boat, and about nothing
 * else — the existing logbook is step 2, the maintenance plan is step 3.
 *
 * The word « checklist » does not appear here. Creating a carnet and choosing a maintenance plan
 * are two questions, and merging them meant that someone whose builder has published nothing had
 * to file their boat under « générique » at sign-up. Constructeur and Modèle are free text with
 * suggestions: a Neel 47 is written as a Neel 47 even though we have no Neel plan.
 *
 * The hull type is the one thing the server needs, because it is what gives the boat its eight
 * systems — and it also pre-sets the engine count, so the common case costs no tap at all.
 *
 * This is the only step that can be reached without a boat, and the only one that writes one. It
 * therefore ends the moment `create_boat` answers: everything after it happens inside a carnet
 * that exists, which is what makes steps 2 and 3 resumable from their own address.
 */
export function NewBoatForm({ templates }: { templates: TemplateOption[] }) {
  const t = useTranslations("boats.new");
  const tb = useTranslations("boatType");
  const te = useTranslations("engines.onboarding");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  // Drawn once, when the screen opens (rule 11, D18): the second tap of a double tap replays the
  // same id and `create_boat` hands back the same boat instead of opening a second carnet.
  const [boatId] = useState(() => crypto.randomUUID());

  const form = useForm<NewBoatFormState, unknown, NewBoatOutput>({
    resolver: formResolver<NewBoatFormState, NewBoatOutput>(newBoatFormSchema),
    defaultValues: {
      boatId,
      name: "",
      type: "monohull_sail",
      builder: "",
      model: "",
      engineCount: "1",
    },
  });

  // `useWatch` rather than `form.watch()`: the latter returns a fresh function every render,
  // which opts the whole component out of the React Compiler.
  const type = useWatch({ control: form.control, name: "type" }) as z.infer<typeof boatTypeSchema>;
  const builder = useWatch({ control: form.control, name: "builder" });
  const model = useWatch({ control: form.control, name: "model" });

  const builders = useMemo(() => builderSuggestions(templates, builder), [templates, builder]);
  const models = useMemo(
    () => modelSuggestions(templates, builder, model),
    [templates, builder, model],
  );

  function chooseType(next: string) {
    form.setValue("type", next, { shouldValidate: form.formState.isSubmitted });
    // The hull knows how many engines it usually carries. A count already corrected by hand is
    // never overwritten.
    if (!form.getFieldState("engineCount").isDirty) {
      const parsed = boatTypeSchema.safeParse(next);
      form.setValue("engineCount", String(defaultEngineCount(parsed.success ? parsed.data : null)));
    }
  }

  function onSubmit(values: NewBoatOutput) {
    const count = Number(form.getValues("engineCount"));
    startTransition(async () => {
      const result = await createBoat({
        ...values,
        engines: newBoatEngines(count, values.type, {
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
      // Step 2 of three (D67). `replace` rather than `push`: going « back » to this screen would
      // draw a new id and open a second carnet, so the browser's back button must not be able to.
      router.replace(onboardingPath(result.data.boatId, 2) as Route);
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

      <Field id="boat-type" label={t("type")} help={t("typeHelp")} error={fieldError(errors.type)}>
        <Controller
          control={form.control}
          name="type"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              value={field.value}
              aria-label={t("type")}
              onValueChange={(next) => next && chooseType(next)}
            >
              {boatTypeSchema.options.map((option) => (
                <ToggleGroupItem key={option} value={option} id={`boat-type-${option}`}>
                  {tb(option)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </Field>

      <div className="flex flex-col gap-2">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            id="boat-builder"
            label={t("builder")}
            help={t("optional")}
            error={fieldError(errors.builder)}
          >
            <div className="flex flex-col gap-2">
              <Input
                id="boat-builder"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
                placeholder={t("builderPlaceholder")}
                {...form.register("builder")}
              />
              <SuggestionChips
                options={builders}
                label={t("builder")}
                onPick={(value) => form.setValue("builder", value, { shouldDirty: true })}
              />
            </div>
          </Field>

          <Field
            id="boat-model"
            label={t("model")}
            help={t("optional")}
            error={fieldError(errors.model)}
          >
            <div className="flex flex-col gap-2">
              <Input
                id="boat-model"
                autoCapitalize="words"
                autoComplete="off"
                enterKeyHint="next"
                placeholder={t("modelPlaceholder")}
                {...form.register("model")}
              />
              <SuggestionChips
                options={models}
                label={t("model")}
                onPick={(value) => form.setValue("model", value, { shouldDirty: true })}
              />
            </div>
          </Field>
        </div>
        {/* Said once for the pair rather than twice side by side. */}
        <p className="text-caption text-ink-3">{t("identityHelp")}</p>
      </div>

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

      <Button type="submit" size="xl" disabled={pending} aria-busy={pending}>
        {pending ? <Spinner /> : <ArrowRightIcon />}
        {t("submit")}
      </Button>

      <p className="text-caption text-ink-3">{t("systems", { type: tb(type) })}</p>
    </form>
  );
}
