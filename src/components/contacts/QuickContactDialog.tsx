"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { specialtyOptions, type ContactOption } from "@/components/contacts/specialties";
import { Field } from "@/components/forms/Field";
import { useFieldError } from "@/components/forms/use-field-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { upsertContact } from "@/lib/actions/contacts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { upsertContactSchema, type ContactSpecialty } from "@/lib/schemas/contacts";

type FieldErrors = Partial<Record<"name" | "specialty" | "phone" | "email", string>>;

/**
 * What the dialog opens on when a document named the provider (D118): everything the invoice
 * carried, already typed. An empty object is « the person taps + and types », the case the
 * dialog was written for.
 */
export type QuickContactInitial = {
  name?: string;
  company?: string;
  phone?: string;
  email?: string;
  address?: string;
};

const BLANK: Required<QuickContactInitial> = {
  name: "",
  company: "",
  phone: "",
  email: "",
  address: "",
};

function hasExtras(initial: QuickContactInitial | undefined): boolean {
  return Boolean(initial?.company ?? initial?.email ?? initial?.address);
}

/**
 * Inline creation from ContactPicker (ux-flows §4.5): name, specialty, phone — nothing else.
 * The new contact is selected at once; the current form is never left.
 *
 * With `initial` it is the same dialogue, pre-filled from what was read on a document (D118),
 * and the three fields the invoice also carried — société, e-mail, adresse — come with it:
 * re-typing a phone number that is printed on the page is exactly the work this is meant to
 * remove, and a fiche created without them is a fiche someone completes by hand later.
 */
export function QuickContactDialog({
  boatId,
  open,
  onOpenChange,
  onCreated,
  initial,
}: {
  boatId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (contact: ContactOption) => void;
  initial?: QuickContactInitial;
}) {
  const t = useTranslations("contacts");
  const fromDocument = hasExtras(initial) || Boolean(initial?.name);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("picker.quickTitle")}</DialogTitle>
          <DialogDescription>
            {fromDocument ? t("picker.fromDocumentHelp") : t("picker.quickHelp")}
          </DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog: fresh state and a fresh id at every opening. */}
        {open ? (
          <QuickContactForm
            boatId={boatId}
            initial={initial}
            onClose={() => onOpenChange(false)}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function QuickContactForm({
  boatId,
  initial,
  onClose,
  onCreated,
}: {
  boatId: string;
  initial?: QuickContactInitial;
  onClose: () => void;
  onCreated: (contact: ContactOption) => void;
}) {
  const t = useTranslations("contacts");
  const tc = useTranslations("common");
  const ts = useTranslations("contacts.specialties");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const [pending, startTransition] = useTransition();
  const [id] = useState(() => crypto.randomUUID());
  const options = specialtyOptions((key: ContactSpecialty) => ts(key));
  const start = { ...BLANK, ...initial };
  const [name, setName] = useState(start.name);
  const [choice, setChoice] = useState<string>(options[0] ?? "");
  const [other, setOther] = useState("");
  const [phone, setPhone] = useState(start.phone);
  const [company, setCompany] = useState(start.company);
  const [email, setEmail] = useState(start.email);
  const [address, setAddress] = useState(start.address);
  const [errors, setErrors] = useState<FieldErrors>({});
  const otherKey = "__other";
  // The three extra fields show when the document filled one of them: the bare « + » keeps the
  // three-field dialogue it has always had.
  const extras = hasExtras(initial);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const specialty = choice === otherKey ? other : choice;
    const parsed = upsertContactSchema.safeParse({
      id,
      boatId,
      name,
      specialty,
      company: extras ? company : null,
      phone,
      email: extras ? email : null,
      address: extras ? address : null,
      notes: null,
    });
    if (!parsed.success) {
      const next: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0]) as keyof FieldErrors;
        next[key] ??= fieldError({ type: issue.code, message: issue.message });
      }
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await upsertContact(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      onCreated({
        id: result.data.contactId,
        name: result.data.name,
        specialty: result.data.specialty,
        company: parsed.data.company,
        phone: parsed.data.phone,
        email: parsed.data.email,
      });
      toast.success(t("saved"));
      onClose();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="quick-contact-name" label={t("fields.name")} required error={errors.name}>
        <Input
          id="quick-contact-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          enterKeyHint="next"
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>
      <Field id="quick-contact-specialty" label={t("fields.specialty")} error={errors.specialty}>
        <NativeSelect
          id="quick-contact-specialty"
          value={choice}
          onChange={(event) => setChoice(event.target.value)}
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
          <option value={otherKey}>{ts("other")}</option>
        </NativeSelect>
      </Field>
      {choice === otherKey ? (
        <Field id="quick-contact-other" label={t("fields.specialtyOther")}>
          <Input
            id="quick-contact-other"
            value={other}
            onChange={(event) => setOther(event.target.value)}
            autoComplete="off"
          />
        </Field>
      ) : null}
      <Field id="quick-contact-phone" label={t("fields.phone")} error={errors.phone}>
        <Input
          id="quick-contact-phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          autoComplete="off"
          enterKeyHint={extras ? "next" : "done"}
        />
      </Field>
      {extras ? (
        <>
          <Field id="quick-contact-company" label={t("fields.company")}>
            <Input
              id="quick-contact-company"
              value={company}
              onChange={(event) => setCompany(event.target.value)}
              autoComplete="off"
              enterKeyHint="next"
            />
          </Field>
          <Field id="quick-contact-email" label={t("fields.email")} error={errors.email}>
            <Input
              id="quick-contact-email"
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
              autoCapitalize="off"
              enterKeyHint="next"
              aria-invalid={errors.email ? true : undefined}
            />
          </Field>
          <Field id="quick-contact-address" label={t("fields.address")}>
            <Input
              id="quick-contact-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              autoComplete="off"
              enterKeyHint="done"
            />
          </Field>
        </>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner className="size-4" /> : null}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
