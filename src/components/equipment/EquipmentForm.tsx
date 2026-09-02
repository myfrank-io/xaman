"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, XIcon } from "lucide-react";
import type { z } from "zod";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { PageHeader } from "@/components/common/PageHeader";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { numberToInput, textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { upsertEquipment } from "@/lib/actions/equipment";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatTabPath, equipmentPath } from "@/lib/queries/boat-routes";
import { upsertEquipmentSchema } from "@/lib/schemas/equipment";

export type EquipmentFormValues = {
  id: string;
  name: string;
  categoryId: string | null;
  brand: string | null;
  model: string | null;
  serial: string | null;
  quantity: number;
  installedAt: string | null;
  specs: { key: string; value: string }[];
  notes: string | null;
  updatedAt: string;
};

type EquipmentFormState = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  categoryId: string;
  name: string;
  brand: string;
  model: string;
  serial: string;
  quantity: string;
  installedAt: string | null;
  specs: { key: string; value: string }[];
  notes: string;
};
type EquipmentOutput = z.output<typeof upsertEquipmentSchema>;

// Neutral grey for the « no category » chip: a category colour never travels alone (rule 12).
const NO_CATEGORY_COLOR = "#8A99AC";

export function EquipmentForm({
  boatId,
  item,
  categories,
  defaultCategoryId,
}: {
  boatId: string;
  item: EquipmentFormValues | null;
  categories: CategoryChoice[];
  defaultCategoryId?: string;
}) {
  const t = useTranslations("equipment");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());
  const form = useForm<EquipmentFormState, unknown, EquipmentOutput>({
    resolver: formResolver<EquipmentFormState, EquipmentOutput>(upsertEquipmentSchema),
    defaultValues: {
      id: item?.id ?? newId,
      boatId,
      expectedUpdatedAt: item?.updatedAt,
      categoryId: item?.categoryId ?? defaultCategoryId ?? "",
      name: item?.name ?? "",
      brand: textToInput(item?.brand),
      model: textToInput(item?.model),
      serial: textToInput(item?.serial),
      quantity: numberToInput(item?.quantity ?? 1),
      installedAt: item?.installedAt ?? null,
      specs: item?.specs ?? [],
      notes: textToInput(item?.notes),
    },
  });
  const specs = useFieldArray({ control: form.control, name: "specs" });
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const errors = form.formState.errors;
  const backHref = item ? equipmentPath(boatId, item.id) : boatTabPath(boatId, "equipment");
  const choices: CategoryChoice[] = [
    { id: "", name: t("uncategorized"), color: NO_CATEGORY_COLOR },
    ...categories,
  ];

  function onSubmit(values: EquipmentOutput) {
    startTransition(async () => {
      const result = await upsertEquipment(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      router.push(
        equipmentPath(boatId, result.data.equipmentId) as Parameters<typeof router.push>[0],
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={item ? t("edit") : t("new")} />
      <Field id="equipment-name" label={t("fields.name")} required error={fieldError(errors.name)}>
        <Input
          id="equipment-name"
          autoComplete="off"
          autoFocus={!item}
          aria-invalid={errors.name ? true : undefined}
          {...form.register("name")}
        />
      </Field>
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
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="equipment-brand" label={t("fields.brand")} error={fieldError(errors.brand)}>
          <Input id="equipment-brand" autoComplete="off" {...form.register("brand")} />
        </Field>
        <Field id="equipment-model" label={t("fields.model")} error={fieldError(errors.model)}>
          <Input id="equipment-model" autoComplete="off" {...form.register("model")} />
        </Field>
        <Field id="equipment-serial" label={t("fields.serial")} error={fieldError(errors.serial)}>
          <Input
            id="equipment-serial"
            autoComplete="off"
            autoCapitalize="none"
            {...form.register("serial")}
          />
        </Field>
        <Field
          id="equipment-quantity"
          label={t("fields.quantity")}
          error={fieldError(errors.quantity)}
        >
          <NumericField
            id="equipment-quantity"
            mode="numeric"
            aria-invalid={errors.quantity ? true : undefined}
            {...form.register("quantity")}
          />
        </Field>
        <Field
          id="equipment-installed"
          label={t("fields.installedAt")}
          error={fieldError(errors.installedAt)}
        >
          <Controller
            control={form.control}
            name="installedAt"
            render={({ field }) => (
              <Input
                id="equipment-installed"
                type="date"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value || null)}
                className="w-auto min-w-40 num"
              />
            )}
          />
        </Field>
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="text-label font-semibold text-ink-2">{t("fields.specs")}</legend>
        {specs.fields.map((spec, index) => (
          <div key={spec.id} className="flex items-end gap-2">
            <Field
              id={`spec-key-${index}`}
              label={t("specKey")}
              className="flex-1"
              error={fieldError(errors.specs?.[index]?.key)}
            >
              <Input
                id={`spec-key-${index}`}
                autoComplete="off"
                {...form.register(`specs.${index}.key`)}
              />
            </Field>
            <Field
              id={`spec-value-${index}`}
              label={t("specValue")}
              className="flex-1"
              error={fieldError(errors.specs?.[index]?.value)}
            >
              <Input
                id={`spec-value-${index}`}
                autoComplete="off"
                {...form.register(`specs.${index}.value`)}
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t("removeSpec")}
              onClick={() => specs.remove(index)}
            >
              <XIcon />
            </Button>
          </div>
        ))}
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => specs.append({ key: "", value: "" })}
          >
            <PlusIcon />
            {t("addSpec")}
          </Button>
        </div>
      </fieldset>
      <Field id="equipment-notes" label={t("fields.notes")} error={fieldError(errors.notes)}>
        <Textarea
          id="equipment-notes"
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
