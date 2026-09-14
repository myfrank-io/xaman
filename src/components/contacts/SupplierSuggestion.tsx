"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BuildingIcon, CheckCircle2Icon, UserPlusIcon } from "lucide-react";

import {
  QuickContactDialog,
  type QuickContactInitial,
} from "@/components/contacts/QuickContactDialog";
import type { ContactOption } from "@/components/contacts/specialties";
import { Button } from "@/components/ui/button";
import {
  contactDraftFromSupplier,
  hasSupplierDetails,
  matchSupplierContact,
  supplierDisplayName,
  type SupplierRead,
} from "@/lib/contacts/match";

/**
 * Le prestataire lu sur le document (D119).
 *
 * Une facture porte le nom du chantier, son téléphone, son e-mail et son adresse ; l'annuaire du
 * bateau porte souvent déjà sa fiche. Ce bloc fait les deux moitiés du travail que la personne
 * faisait à la main : il dit « c'est X, déjà dans l'annuaire » et le sélectionne, ou il propose
 * de créer la fiche **avec tout ce qui est écrit sur la page** — numéros, mail, adresse — plutôt
 * que de rouvrir un formulaire vide à côté du document qui contient la réponse.
 *
 * Il ne décide jamais seul : le rapprochement est exact (e-mail, téléphone, nom), sans score
 * flou, et la création reste un tap. Ce que le document dit reste affiché à côté, pour que la
 * personne voie ce qu'elle va enregistrer.
 */
export function SupplierSuggestion({
  boatId,
  supplier,
  contacts,
  value,
  onValueChange,
  onContactCreated,
  canCreate,
}: {
  boatId: string;
  /** What the reading found; nothing is shown when it found no provider at all. */
  supplier: SupplierRead | null | undefined;
  contacts: ContactOption[];
  /** The provider currently selected on the form. */
  value: string | null;
  onValueChange: (contactId: string) => void;
  /** The new fiche, so the form's own picker lists it at once. */
  onContactCreated?: (contact: ContactOption) => void;
  canCreate: boolean;
}) {
  const t = useTranslations("contacts.supplier");
  const [creating, setCreating] = useState(false);

  const match = useMemo(
    () => (hasSupplierDetails(supplier) ? matchSupplierContact(supplier, contacts) : null),
    [supplier, contacts],
  );

  if (!hasSupplierDetails(supplier)) return null;

  const matched = match ? contacts.find((contact) => contact.id === match.contactId) : undefined;
  const written = supplierDisplayName(supplier);
  const details = [supplier.phone, supplier.email, supplier.address].filter(Boolean).join(" · ");
  const initial: QuickContactInitial = contactDraftFromSupplier(supplier);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-3">
      <p className="flex items-start gap-2 text-body text-ink-2">
        <BuildingIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
        <span>
          {t("read", { name: written })}
          {details ? <span className="block text-caption text-ink-3">{details}</span> : null}
        </span>
      </p>

      {matched ? (
        // Already known: the picker above is on it — this only says why, so a wrong guess is
        // visible rather than silent, and changing it is the picker, one row up.
        value === matched.id ? (
          <p className="flex items-center gap-2 text-caption text-ink-2">
            <CheckCircle2Icon aria-hidden className="size-4 shrink-0 text-state-ok-fg" />
            {t(`matched.${match?.key ?? "name"}`, { name: matched.name })}
          </p>
        ) : (
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => onValueChange(matched.id)}
          >
            {t("useExisting", { name: matched.name })}
          </Button>
        )
      ) : canCreate ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="self-start"
            onClick={() => setCreating(true)}
          >
            <UserPlusIcon />
            {t("create")}
          </Button>
          <QuickContactDialog
            boatId={boatId}
            open={creating}
            onOpenChange={setCreating}
            initial={initial}
            onCreated={(contact) => {
              onContactCreated?.(contact);
              onValueChange(contact.id);
            }}
          />
        </>
      ) : null}
    </div>
  );
}
