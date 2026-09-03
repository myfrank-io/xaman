"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import type { z } from "zod";

import { FillFromPhoneButton } from "@/components/contacts/FillFromPhoneButton";
import { isListedSpecialty, specialtyOptions } from "@/components/contacts/specialties";
import { PageHeader } from "@/components/common/PageHeader";
import { DiscardDialog } from "@/components/forms/DiscardDialog";
import { Field } from "@/components/forms/Field";
import { FormActionBar } from "@/components/forms/FormActionBar";
import { formResolver } from "@/components/forms/form-resolver";
import { textToInput } from "@/components/forms/form-values";
import { useFieldError } from "@/components/forms/use-field-error";
import { useUnsavedGuard } from "@/components/forms/use-unsaved-guard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { upsertContact } from "@/lib/actions/contacts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { boatPath, contactPath } from "@/lib/queries/boat-routes";
import { upsertContactSchema, type ContactSpecialty } from "@/lib/schemas/contacts";

export type ContactFormValues = {
  id: string;
  name: string;
  specialty: string;
  company: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  updatedAt: string;
};

type ContactFormState = {
  id: string;
  boatId: string;
  expectedUpdatedAt?: string;
  name: string;
  specialty: string;
  company: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
};
type ContactOutput = z.output<typeof upsertContactSchema>;

const OTHER = "__other";

// Full contact form (E6-2), a page: seven fields and a textarea (ux-flows §1.2).
export function ContactForm({
  boatId,
  contact,
  usedSpecialties = [],
}: {
  boatId: string;
  contact: ContactFormValues | null;
  /** Trades already on this boat: each becomes a chip, so one typed once comes back. */
  usedSpecialties?: string[];
}) {
  const t = useTranslations("contacts");
  const ts = useTranslations("contacts.specialties");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newId] = useState(() => crypto.randomUUID());
  const label = (key: ContactSpecialty) => ts(key);
  const options = specialtyOptions(label, usedSpecialties);
  const [otherMode, setOtherMode] = useState(
    contact ? !isListedSpecialty(contact.specialty, label, usedSpecialties) : false,
  );

  const form = useForm<ContactFormState, unknown, ContactOutput>({
    resolver: formResolver<ContactFormState, ContactOutput>(upsertContactSchema),
    defaultValues: {
      id: contact?.id ?? newId,
      boatId,
      expectedUpdatedAt: contact?.updatedAt,
      name: contact?.name ?? "",
      specialty: contact?.specialty ?? "",
      company: textToInput(contact?.company),
      phone: textToInput(contact?.phone),
      email: textToInput(contact?.email),
      address: textToInput(contact?.address),
      notes: textToInput(contact?.notes),
    },
  });
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful);
  const errors = form.formState.errors;
  const backHref = contact ? contactPath(boatId, contact.id) : boatPath(boatId, "contacts");

  function onSubmit(values: ContactOutput) {
    startTransition(async () => {
      const result = await upsertContact(values);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("saved"));
      router.push(contactPath(boatId, result.data.contactId) as Parameters<typeof router.push>[0]);
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      <PageHeader title={contact ? t("edit") : t("new")} />
      {/* Only on a new provider: on an existing one it would overwrite what is already right. */}
      {contact ? null : (
        <FillFromPhoneButton
          onPicked={(picked) => {
            form.setValue("name", picked.name, { shouldDirty: true });
            if (picked.phone) form.setValue("phone", picked.phone, { shouldDirty: true });
            if (picked.email) form.setValue("email", picked.email, { shouldDirty: true });
          }}
        />
      )}
      <Field id="contact-name" label={t("fields.name")} required error={fieldError(errors.name)}>
        <Input
          id="contact-name"
          autoComplete="off"
          autoFocus={!contact}
          enterKeyHint="next"
          aria-invalid={errors.name ? true : undefined}
          {...form.register("name")}
        />
      </Field>
      <Controller
        control={form.control}
        name="specialty"
        render={({ field }) => {
          const chip = otherMode ? OTHER : field.value;
          return (
            <Field
              id="contact-specialty"
              label={t("fields.specialty")}
              required
              error={fieldError(errors.specialty)}
            >
              <ToggleGroup
                type="single"
                value={chip}
                aria-label={t("fields.specialty")}
                className="flex-wrap justify-start"
                onValueChange={(next) => {
                  if (!next) return;
                  if (next === OTHER) {
                    setOtherMode(true);
                    field.onChange("");
                    return;
                  }
                  setOtherMode(false);
                  field.onChange(next);
                }}
              >
                {options.map((option) => (
                  <ToggleGroupItem key={option} value={option} className="min-h-11">
                    {option}
                  </ToggleGroupItem>
                ))}
                <ToggleGroupItem value={OTHER} className="min-h-11">
                  {ts("other")}
                </ToggleGroupItem>
              </ToggleGroup>
              {otherMode ? (
                <Input
                  id="contact-specialty"
                  value={field.value}
                  onChange={(event) => field.onChange(event.target.value)}
                  placeholder={t("fields.specialtyOther")}
                  autoComplete="off"
                  aria-invalid={errors.specialty ? true : undefined}
                  className="mt-1 max-w-sm"
                />
              ) : null}
            </Field>
          );
        }}
      />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="contact-company" label={t("fields.company")} error={fieldError(errors.company)}>
          <Input id="contact-company" autoComplete="off" {...form.register("company")} />
        </Field>
        <Field id="contact-phone" label={t("fields.phone")} error={fieldError(errors.phone)}>
          <Input
            id="contact-phone"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            {...form.register("phone")}
          />
        </Field>
        <Field id="contact-email" label={t("fields.email")} error={fieldError(errors.email)}>
          <Input
            id="contact-email"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoComplete="off"
            aria-invalid={errors.email ? true : undefined}
            {...form.register("email")}
          />
        </Field>
        <Field id="contact-address" label={t("fields.address")} error={fieldError(errors.address)}>
          <Input id="contact-address" autoComplete="off" {...form.register("address")} />
        </Field>
      </div>
      <Field id="contact-notes" label={t("fields.notes")} error={fieldError(errors.notes)}>
        <Textarea
          id="contact-notes"
          rows={3}
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
