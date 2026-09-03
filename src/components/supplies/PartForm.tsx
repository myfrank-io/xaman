"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { upsertPart } from "@/lib/actions/parts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { suppliesPath } from "@/lib/queries/boat-routes";
import { PART_UNITS, upsertPartSchema } from "@/lib/schemas/parts";

/** Neutral grey for the « no category » chip: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";

export type PartFormValues = {
  id: string;
  name: string;
  reference: string | null;
  quantity: number;
  minQuantity: number;
  unit: string;
  location: string | null;
  categoryId: string | null;
  supplierContactId: string | null;
  notes: string | null;
  updatedAt: string;
};

type PartFormState = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  name: string;
  reference: string;
  quantity: string;
  minQuantity: string;
  unit: string;
  location: string;
  categoryId: string;
  supplierContactId: string | null;
  notes: string;
};
type PartOutput = z.output<typeof upsertPartSchema>;

/**
 * Part of the stock (E5-4), a page: name, reference, quantity with its unit, threshold,
 * place on board, system, supplier, notes. Saving counts as a check of the quantity.
 */
export function PartForm({
  boatId,
  part,
  categories,
  contacts,
}: {
  boatId: string;
  part: PartFormValues | null;
  categories: CategoryChoice[];
  contacts: ContactOption[];
}) {
  const t = useTranslations("supplies.stock");
  const tu = useTranslations("supplies.stock.units");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());

  const form = useForm<PartFormState, unknown, PartOutput>({
    resolver: formResolver<PartFormState, PartOutput>(upsertPartSchema),
    defaultValues: {
      id: part?.id ?? newId,
      boatId,
      expectedUpdatedAt: part?.updatedAt,
      name: part?.name ?? "",
      reference: textToInput(part?.reference),
      quantity: numberToInput(part?.quantity ?? 1),
      minQuantity: numberToInput(part?.minQuantity ?? 0),
      unit: part?.unit ?? "pc",
      location: textToInput(part?.location),
      categoryId: part?.categoryId ?? "",
      supplierContactId: part?.supplierContactId ?? null,
      notes: textToInput(part?.notes),
    },
  });
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const errors = form.formState.errors;
  const backHref = suppliesPath(boatId, "stock");
  const choices: CategoryChoice[] = [
    { id: "", name: t("fields.noCategory"), color: NO_CATEGORY_COLOR },
    ...categories,
  ];
  // A unit stored outside the chip list (an import, an old value) stays selectable.
  const units: string[] = [
    ...PART_UNITS,
    ...(part?.unit && !(PART_UNITS as readonly string[]).includes(part.unit) ? [part.unit] : []),
  ];
  const unitLabel = (unit: string) => (tu.has(unit as "pc") ? tu(unit as "pc") : unit);

  function onSubmit(values: PartOutput) {
    startTransition(async () => {
      const result = await upsertPart(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      router.push(backHref as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={part ? t("edit") : t("new")} />

      <Field id="part-name" label={t("fields.name")} required error={fieldError(errors.name)}>
        <Input
          id="part-name"
          autoComplete="off"
          autoFocus={!part}
          autoCapitalize="sentences"
          enterKeyHint="next"
          aria-invalid={errors.name ? true : undefined}
          {...form.register("name")}
        />
      </Field>

      <Field id="part-reference" label={t("fields.reference")} error={fieldError(errors.reference)}>
        <Input
          id="part-reference"
          autoComplete="off"
          className="max-w-sm"
          enterKeyHint="next"
          {...form.register("reference")}
        />
      </Field>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="part-quantity"
          label={t("fields.quantity")}
          required
          error={fieldError(errors.quantity)}
        >
          <Controller
            control={form.control}
            name="quantity"
            render={({ field }) => (
              <NumericField
                id="part-quantity"
                value={field.value}
                onValueChange={(raw) => field.onChange(raw)}
                enterKeyHint="next"
                className="max-w-40"
                aria-invalid={errors.quantity ? true : undefined}
              />
            )}
          />
        </Field>
        <div className="grid gap-2">
          <Label>{t("fields.unit")}</Label>
          <Controller
            control={form.control}
            name="unit"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                value={field.value}
                aria-label={t("fields.unit")}
                className="flex-wrap justify-start"
                onValueChange={(value) => value && field.onChange(value)}
              >
                {units.map((unit) => (
                  <ToggleGroupItem key={unit} value={unit} className="min-h-11">
                    {unitLabel(unit)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="part-min"
          label={t("fields.minQuantity")}
          help={t("fields.minQuantityHelp")}
          error={fieldError(errors.minQuantity)}
        >
          <Controller
            control={form.control}
            name="minQuantity"
            render={({ field }) => (
              <NumericField
                id="part-min"
                value={field.value}
                onValueChange={(raw) => field.onChange(raw)}
                enterKeyHint="next"
                className="max-w-40"
                aria-invalid={errors.minQuantity ? true : undefined}
              />
            )}
          />
        </Field>
        <Field id="part-location" label={t("fields.location")} error={fieldError(errors.location)}>
          <Input
            id="part-location"
            autoComplete="off"
            autoCapitalize="sentences"
            enterKeyHint="next"
            {...form.register("location")}
          />
        </Field>
      </div>

      <div className="grid gap-2">
        <Label>{t("fields.category")}</Label>
        <Controller
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <CategoryChips
              categories={choices}
              value={field.value}
              onValueChange={field.onChange}
              label={t("fields.category")}
            />
          )}
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="part-supplier">{t("fields.supplier")}</Label>
        <Controller
          control={form.control}
          name="supplierContactId"
          render={({ field }) => (
            <ContactPicker
              id="part-supplier"
              boatId={boatId}
              contacts={contacts}
              value={field.value}
              onValueChange={field.onChange}
              canCreate
              label={t("fields.supplier")}
              crewLabel={t("fields.noSupplier")}
            />
          )}
        />
      </div>

      <Field id="part-notes" label={t("fields.notes")} error={fieldError(errors.notes)}>
        <Textarea id="part-notes" rows={3} autoCapitalize="sentences" {...form.register("notes")} />
      </Field>

      <p className="text-caption text-ink-3">{t("checkedHelp")}</p>
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
