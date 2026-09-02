"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { QuickContactDialog } from "@/components/contacts/QuickContactDialog";
import {
  contactLabel,
  groupBySpecialty,
  type ContactOption,
} from "@/components/contacts/specialties";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/**
 * « Réalisé par » / « Fournisseur » (ux-flows §4.5, D32): « Nous-mêmes » by default
 * (`contact_id = null`), else a grouped native select and an inline creation that selects
 * the new contact without leaving the form.
 */
export function ContactPicker({
  id,
  boatId,
  contacts,
  value,
  onValueChange,
  canCreate = false,
  label,
  crewLabel,
}: {
  id: string;
  boatId: string;
  contacts: ContactOption[];
  value: string | null;
  onValueChange: (contactId: string | null) => void;
  canCreate?: boolean;
  label?: string;
  /** Overrides « Nous-mêmes » (e.g. « Sans fournisseur » on a purchase). */
  crewLabel?: string;
}) {
  const t = useTranslations("contacts");
  const [extra, setExtra] = useState<ContactOption[]>([]);
  const [mode, setMode] = useState<"crew" | "provider">(value ? "provider" : "crew");
  const [creating, setCreating] = useState(false);

  const all = [...contacts, ...extra.filter((e) => !contacts.some((c) => c.id === e.id))];
  const groups = groupBySpecialty(all, t("specialties.other"));

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        value={mode}
        aria-label={label}
        onValueChange={(next) => {
          if (!next) return;
          setMode(next as "crew" | "provider");
          if (next === "crew") onValueChange(null);
        }}
      >
        <ToggleGroupItem value="crew" className="min-h-11">
          {crewLabel ?? t("picker.crew")}
        </ToggleGroupItem>
        <ToggleGroupItem value="provider" className="min-h-11">
          {t("picker.provider")}
        </ToggleGroupItem>
      </ToggleGroup>
      {mode === "provider" ? (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            id={id}
            value={value ?? ""}
            onChange={(event) => onValueChange(event.target.value || null)}
            className="min-w-0 flex-1 sm:min-w-64"
          >
            <option value="">{t("picker.placeholder")}</option>
            {groups.map(([specialty, list]) => (
              <optgroup key={specialty} label={specialty}>
                {list.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contactLabel(contact)}
                  </option>
                ))}
              </optgroup>
            ))}
          </NativeSelect>
          {canCreate ? (
            <Button type="button" variant="outline" onClick={() => setCreating(true)}>
              <PlusIcon />
              {t("picker.add")}
            </Button>
          ) : null}
        </div>
      ) : null}
      {canCreate ? (
        <QuickContactDialog
          boatId={boatId}
          open={creating}
          onOpenChange={setCreating}
          onCreated={(contact) => {
            setExtra((current) => [...current, contact]);
            onValueChange(contact.id);
          }}
        />
      ) : null}
    </div>
  );
}
