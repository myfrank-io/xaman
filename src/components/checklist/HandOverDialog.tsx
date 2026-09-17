"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { dueSentence } from "@/components/checklist/due-sentence";
import {
  hasCounter,
  isPunctual,
  type ChecklistRow,
  type OpenLog,
} from "@/components/checklist/rows";
import {
  contactLabel,
  groupBySpecialty,
  type ContactOption,
} from "@/components/contacts/specialties";
import { Field } from "@/components/forms/Field";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { handOverItem } from "@/lib/actions/handoff";
import { formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { newContactPath } from "@/lib/queries/boat-routes";
import { HANDOFF_MESSAGE_MAX } from "@/lib/schemas/handoff";

/**
 * « Confier au chantier » (E19-11, D141).
 *
 * Un point qui tombe est un travail que quelqu'un va facturer. Aujourd'hui c'est le mécano du
 * port, parce qu'il est sur le ponton ; le chantier qui a construit la coque n'en entend parler
 * qu'à la panne. Cette feuille pose la question au moment où elle se pose — sur le point, quand
 * il est dû — et la pose au chantier : à qui, un mot, envoyer. Ce qu'elle écrit n'est pas un
 * nouvel objet : une intervention **prévue** sur ce point (D140), au nom du prestataire, datée
 * de l'échéance ; et un e-mail qui porte ce que le coup de téléphone n'a jamais — la coque, le
 * système, le retard, les heures moteur, la dernière fois, et à qui répondre.
 *
 * Le prestataire par défaut est le chantier de l'annuaire (`pickYardContact`) ; la roulette
 * offre les autres, groupés par métier comme partout. Sans annuaire, la feuille dit d'abord où
 * l'écrire.
 */
export function HandOverDialog({
  boatId,
  row,
  contacts,
  defaultContactId,
  canCreateContact = false,
  onOpenChange,
  onHandedOver,
}: {
  boatId: string;
  /** Le point à confier ; null ferme la feuille. */
  row: ChecklistRow | null;
  contacts: ContactOption[];
  /** Le chantier du bateau, quand l'annuaire en a un. */
  defaultContactId: string | null;
  canCreateContact?: boolean;
  onOpenChange: (open: boolean) => void;
  /** Ce que la ligne devient, tout de suite : l'intervention prévue qu'elle porte désormais. */
  onHandedOver?: (row: ChecklistRow, openLog: OpenLog) => void;
}) {
  const t = useTranslations("checklist.handoff");
  const tch = useTranslations("checklist");
  const due = row
    ? dueSentence({
        status: row.status,
        daysRemaining: row.daysRemaining,
        hoursRemaining: row.hoursRemaining,
        hasCounter: hasCounter(row),
        punctual: isPunctual(row),
        hasCompletion: row.hasCompletion,
      })
    : null;

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {row ? (
              <>
                <span className="block text-body font-medium text-foreground">{row.label}</span>
                <span className="block">
                  {[due ? tch(`due.${due.key}`, due.values ?? {}) : null, row.categoryName]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        {row ? (
          contacts.length === 0 ? (
            <div className="flex flex-col gap-4">
              <Alert>
                <AlertDescription>{t("noContacts")}</AlertDescription>
              </Alert>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    {tch("handoff.close")}
                  </Button>
                </DialogClose>
                {canCreateContact ? (
                  <Button asChild>
                    <Link href={newContactPath(boatId) as Route}>{t("addContact")}</Link>
                  </Button>
                ) : null}
              </DialogFooter>
            </div>
          ) : (
            <HandOverForm
              key={row.id}
              boatId={boatId}
              row={row}
              contacts={contacts}
              defaultContactId={defaultContactId}
              onClose={() => onOpenChange(false)}
              onHandedOver={onHandedOver}
            />
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function HandOverForm({
  boatId,
  row,
  contacts,
  defaultContactId,
  onClose,
  onHandedOver,
}: {
  boatId: string;
  row: ChecklistRow;
  contacts: ContactOption[];
  defaultContactId: string | null;
  onClose: () => void;
  onHandedOver?: (row: ChecklistRow, openLog: OpenLog) => void;
}) {
  const t = useTranslations("checklist.handoff");
  const tc = useTranslations("common");
  const tcontacts = useTranslations("contacts");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // L'intervention que la feuille écrit, tirée à l'ouverture : un double tap n'en écrit qu'une.
  const [logId] = useState(() => crypto.randomUUID());
  const [contactId, setContactId] = useState(
    () =>
      (defaultContactId && contacts.some((contact) => contact.id === defaultContactId)
        ? defaultContactId
        : contacts[0]?.id) ?? "",
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const contact = contacts.find((entry) => entry.id === contactId) ?? null;
  const groups = groupBySpecialty(contacts, tcontacts("specialties.other"));

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!contact) return;
    setError(null);
    startTransition(async () => {
      const result = await handOverItem({
        boatId,
        itemId: row.id,
        logId,
        contactId: contact.id,
        message,
      });
      if (!result.ok) {
        setError(errorMessage(result.error));
        return;
      }
      const { data } = result;
      onHandedOver?.(row, {
        id: data.logId,
        status: "planned",
        at: data.plannedAt,
        contactName: data.contactName,
      });
      onClose();
      const values = { name: data.contactName, date: formatDate(data.plannedAt) };
      toast.success(
        data.emailed
          ? t("savedEmailed", values)
          : data.hasEmail
            ? t("savedNotSent", values)
            : t("savedNoEmail", values),
      );
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
      <Field id="handoff-contact" label={t("to")} required>
        <NativeSelect
          id="handoff-contact"
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
        >
          {groups.map(([specialty, list]) => (
            <optgroup key={specialty} label={specialty}>
              {list.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {contactLabel(entry)}
                </option>
              ))}
            </optgroup>
          ))}
        </NativeSelect>
      </Field>
      <Field id="handoff-message" label={t("message")}>
        <Textarea
          id="handoff-message"
          rows={3}
          value={message}
          maxLength={HANDOFF_MESSAGE_MAX}
          autoCapitalize="sentences"
          placeholder={t("messagePlaceholder")}
          onChange={(event) => setMessage(event.target.value)}
        />
      </Field>
      {contact ? (
        <Alert variant={contact.email ? "info" : "warning"}>
          <AlertDescription>
            {contact.email
              ? t("willEmail", { name: contact.name })
              : t("noEmail", { name: contact.name })}
          </AlertDescription>
        </Alert>
      ) : null}
      {error ? (
        <p role="alert" className="text-caption font-medium text-state-overdue-fg">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending || !contact} aria-busy={pending}>
          {pending ? <Spinner /> : null}
          {pending ? tc("saving") : t("submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
