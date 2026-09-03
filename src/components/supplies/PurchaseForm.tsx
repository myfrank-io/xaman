"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";

import {
  AttachmentPicker,
  pendingRows,
  type PickedAttachment,
} from "@/components/attachments/AttachmentPicker";
import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { PageHeader } from "@/components/common/PageHeader";
import type { ContactOption } from "@/components/contacts/specialties";
import { normalise } from "@/components/contacts/specialties";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { numberToInput, textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { submitOrQueue } from "@/components/forms/submit-or-queue";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { useOnline } from "@/components/common/use-online";
import { useOutbox } from "@/components/offline/use-outbox";
import { SupplierField } from "@/components/supplies/SupplierField";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveAttachments } from "@/lib/actions/attachments";
import { upsertPurchase } from "@/lib/actions/purchases";
import { formatDate, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import type { AttachmentItem } from "@/lib/queries/attachments";
import { suppliesPath } from "@/lib/queries/boat-routes";
import {
  purchaseKindLabelKey,
  upsertPurchaseSchema,
  VISIBLE_PURCHASE_KINDS,
  type PurchaseKind,
  type VisiblePurchaseKind,
} from "@/lib/schemas/purchases";

/** Neutral grey for the « no category » chip: a category colour never travels alone (rule 12). */
const NO_CATEGORY_COLOR = "#8A99AC";
const MAX_SUGGESTIONS = 5;

export type PurchaseFormValues = {
  id: string;
  kind: PurchaseKind;
  designation: string;
  amount: number | null;
  purchasedAt: string;
  supplierContactId: string | null;
  supplierName: string | null;
  categoryId: string | null;
  bottleType: string | null;
  maintenanceLogId: string | null;
  notes: string | null;
  needsReview: boolean;
  updatedAt: string;
};

export type LogOption = { id: string; title: string; performedAt: string };

type PurchaseFormState = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  kind: PurchaseKind;
  designation: string;
  amount: string;
  purchasedAt: string;
  supplierContactId: string | null;
  supplierName: string;
  categoryId: string;
  bottleType: string;
  maintenanceLogId: string | null;
  notes: string;
  needsReview: boolean;
};
type PurchaseOutput = z.output<typeof upsertPurchaseSchema>;

/**
 * Purchase form (E5-2), a page and not a dialog: eight fields and a textarea (ux-flows §1.2).
 * No quantity, no currency. Four visible kinds; an imported « consumable » row keeps its
 * value until the chip is touched, and reads as « Pièce » everywhere.
 */
export function PurchaseForm({
  boatId,
  purchase,
  categories,
  contacts,
  logs,
  suggestions,
  attachments = [],
  defaultKind,
}: {
  boatId: string;
  purchase: PurchaseFormValues | null;
  categories: CategoryChoice[];
  contacts: ContactOption[];
  logs: LogOption[];
  /** Designations already used on this boat, most frequent first (ux-flows §4.6). */
  suggestions: string[];
  /** Invoice and documents already stored on this purchase (E10-1). */
  attachments?: AttachmentItem[];
  defaultKind?: PurchaseKind;
}) {
  const t = useTranslations("supplies.purchases");
  const ta = useTranslations("attachments");
  const tk = useTranslations("purchaseKind");
  const errorMessage = useErrorMessage();
  const to = useTranslations("offline");
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());
  const outbox = useOutbox(boatId);
  const { online } = useOnline();
  // Invoice scanned while the amount is being typed: the objects go up straight away, their
  // rows are written once the purchase exists (E10-1).
  const [picked, setPicked] = useState<PickedAttachment[]>([]);
  // Same id the form will save under: the invoice can go up before the row exists.
  const attachmentOwnerId = purchase?.id ?? newId;

  const form = useForm<PurchaseFormState, unknown, PurchaseOutput>({
    resolver: formResolver<PurchaseFormState, PurchaseOutput>(upsertPurchaseSchema),
    defaultValues: {
      id: purchase?.id ?? newId,
      boatId,
      expectedUpdatedAt: purchase?.updatedAt,
      kind: purchase?.kind ?? defaultKind ?? "part",
      designation: purchase?.designation ?? "",
      amount: numberToInput(purchase?.amount),
      purchasedAt: purchase?.purchasedAt ?? todayString(),
      supplierContactId: purchase?.supplierContactId ?? null,
      supplierName: textToInput(purchase?.supplierName),
      categoryId: purchase?.categoryId ?? "",
      bottleType: textToInput(purchase?.bottleType),
      maintenanceLogId: purchase?.maintenanceLogId ?? null,
      notes: textToInput(purchase?.notes),
      // Saving a line the user has just read is exactly what « vérifié » means.
      needsReview: false,
    },
  });
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const errors = form.formState.errors;
  const backHref = suppliesPath(boatId);
  const choices: CategoryChoice[] = [
    { id: "", name: t("fields.noCategory"), color: NO_CATEGORY_COLOR },
    ...categories,
  ];

  // useWatch and not form.watch(): the returned function cannot be memoized safely.
  const kind = useWatch({ control: form.control, name: "kind" });
  const typed = useWatch({ control: form.control, name: "designation" });
  const supplierName = useWatch({ control: form.control, name: "supplierName" });
  const needle = normalise(typed.trim());
  const matches =
    needle.length >= 2
      ? suggestions
          .filter((value) => normalise(value).includes(needle) && normalise(value) !== needle)
          .slice(0, MAX_SUGGESTIONS)
      : suggestions.slice(0, 3);

  function onSubmit(values: PurchaseOutput) {
    startTransition(async () => {
      const outcome = await submitOrQueue({
        kind: "purchase",
        boatId,
        id: values.id,
        label: values.designation,
        values,
        action: upsertPurchase,
        enqueue: outbox.enqueue,
        online: online || Boolean(purchase),
      });
      if (outcome.status === "full") {
        toast.error(to("queueFull"));
        return;
      }
      if (outcome.status === "refused") {
        toast.error(errorMessage(outcome.error));
        return;
      }
      if (outcome.status === "sent") {
        const rows = purchase ? [] : pendingRows(picked, { type: "purchase", id: values.id });
        if (rows.length > 0) {
          const committed = await saveAttachments({ boatId, items: rows });
          if (!committed.ok) toast.error(ta("commitFailed"));
        }
      }
      toast.success(outcome.status === "queued" ? to("savedOnDevice") : t("saved"));
      router.push(backHref as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={purchase ? t("edit") : t("new")} />

      <div className="grid gap-2">
        <Label>{t("fields.kind")}</Label>
        <Controller
          control={form.control}
          name="kind"
          render={({ field }) => (
            <ToggleGroup
              type="single"
              value={purchaseKindLabelKey(field.value)}
              aria-label={t("fields.kind")}
              className="flex-wrap justify-start"
              onValueChange={(value) => value && field.onChange(value as VisiblePurchaseKind)}
            >
              {VISIBLE_PURCHASE_KINDS.map((option) => (
                <ToggleGroupItem key={option} value={option} className="min-h-11">
                  {tk(option)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          )}
        />
      </div>

      <Field
        id="purchase-designation"
        label={t("fields.designation")}
        required
        error={fieldError(errors.designation)}
      >
        <Input
          id="purchase-designation"
          autoComplete="off"
          autoFocus={!purchase}
          autoCapitalize="sentences"
          enterKeyHint="next"
          aria-invalid={errors.designation ? true : undefined}
          {...form.register("designation")}
        />
        {matches.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-ink-3">{t("suggestions")}</span>
            {matches.map((suggestion) => (
              <Button
                key={suggestion}
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  form.setValue("designation", suggestion, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              >
                {suggestion}
              </Button>
            ))}
          </div>
        ) : null}
      </Field>

      {kind === "gas" ? (
        <Field
          id="purchase-bottle"
          label={t("fields.bottleType")}
          error={fieldError(errors.bottleType)}
        >
          <Input
            id="purchase-bottle"
            autoComplete="off"
            className="max-w-sm"
            {...form.register("bottleType")}
          />
        </Field>
      ) : null}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="purchase-amount" label={t("fields.amount")} error={fieldError(errors.amount)}>
          <Controller
            control={form.control}
            name="amount"
            render={({ field }) => (
              <NumericField
                id="purchase-amount"
                value={field.value}
                onValueChange={(raw) => field.onChange(raw)}
                suffix="€"
                enterKeyHint="next"
                className="max-w-40"
                containerClassName="max-w-40"
                aria-invalid={errors.amount ? true : undefined}
              />
            )}
          />
        </Field>
        <Field
          id="purchase-date"
          label={t("fields.purchasedAt")}
          required
          error={fieldError(errors.purchasedAt)}
        >
          <Controller
            control={form.control}
            name="purchasedAt"
            render={({ field }) => (
              <DateField
                id="purchase-date"
                value={field.value}
                onValueChange={field.onChange}
                max={todayString()}
              />
            )}
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
        <Label htmlFor="purchase-supplier">{t("fields.supplier")}</Label>
        <Controller
          control={form.control}
          name="supplierContactId"
          render={({ field }) => (
            <SupplierField
              id="purchase-supplier"
              boatId={boatId}
              contacts={contacts}
              contactId={field.value}
              name={supplierName}
              onContactChange={field.onChange}
              onNameChange={(value) => form.setValue("supplierName", value, { shouldDirty: true })}
              canCreate
              label={t("fields.supplier")}
              nameLabel={t("fields.supplierName")}
              help={t("supplierNameHelp")}
            />
          )}
        />
      </div>

      <Field id="purchase-log" label={t("fields.log")} help={t("logHelp")}>
        <Controller
          control={form.control}
          name="maintenanceLogId"
          render={({ field }) => (
            <div className="max-w-md">
              <NativeSelect
                id="purchase-log"
                value={field.value ?? ""}
                onChange={(event) => field.onChange(event.target.value || null)}
              >
                <option value="">{t("noLog")}</option>
                {logs.map((log) => (
                  <option key={log.id} value={log.id}>
                    {`${formatDate(log.performedAt)} — ${log.title}`}
                  </option>
                ))}
              </NativeSelect>
            </div>
          )}
        />
      </Field>

      <Field id="purchase-notes" label={t("fields.notes")} error={fieldError(errors.notes)}>
        <Textarea
          id="purchase-notes"
          rows={3}
          autoCapitalize="sentences"
          {...form.register("notes")}
        />
      </Field>

      <div className="flex flex-col gap-3">
        <Label>{t("attachments")}</Label>
        <AttachmentPicker
          boatId={boatId}
          owner={{ type: "purchase", id: attachmentOwnerId }}
          initial={attachments}
          deferred={!purchase}
          onItemsChange={setPicked}
        />
      </div>

      {purchase?.needsReview ? (
        <p className="text-caption text-state-soon-fg">{t("review.help")}</p>
      ) : null}
      <FormActionBar
        pending={pending}
        queueable={!purchase}
        onCancel={() =>
          guard.leave(() => router.push(backHref as Parameters<typeof router.push>[0]))
        }
      />
      <DiscardDialog open={guard.open} onStay={guard.stay} onDiscard={guard.discard} />
    </form>
  );
}
