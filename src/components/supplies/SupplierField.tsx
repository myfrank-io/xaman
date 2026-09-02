"use client";

import { useTranslations } from "next-intl";

import { ContactPicker } from "@/components/contacts/ContactPicker";
import type { ContactOption } from "@/components/contacts/specialties";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Supplier of a purchase (ux-flows §4.5): the directory, or a free line for the place where
 * it was bought — « Hyères » is a supplier too. The two never coexist: picking a contact
 * clears the text, which is what the Server Action stores.
 */
export function SupplierField({
  id,
  boatId,
  contacts,
  contactId,
  name,
  onContactChange,
  onNameChange,
  canCreate = false,
  label,
  nameLabel,
  help,
}: {
  id: string;
  boatId: string;
  contacts: ContactOption[];
  contactId: string | null;
  name: string;
  onContactChange: (contactId: string | null) => void;
  onNameChange: (name: string) => void;
  canCreate?: boolean;
  label: string;
  /** Visible label of the free-text line — never a placeholder standing in for one. */
  nameLabel: string;
  help?: string;
}) {
  const t = useTranslations("supplies.purchases");
  return (
    <div className="flex flex-col gap-3">
      <ContactPicker
        id={id}
        boatId={boatId}
        contacts={contacts}
        value={contactId}
        onValueChange={onContactChange}
        canCreate={canCreate}
        label={label}
        crewLabel={t("noSupplier")}
      />
      {contactId === null ? (
        <div className="grid gap-2">
          <Label htmlFor={`${id}-name`}>{nameLabel}</Label>
          <Input
            id={`${id}-name`}
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            autoComplete="off"
            autoCapitalize="words"
            className="max-w-sm"
          />
          {help ? <p className="text-caption text-ink-3">{help}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
