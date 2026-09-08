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
import { useLastUsed } from "@/components/forms/use-last-used";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

/** Three chips is what a thumb reads at a glance; beyond that the wheel is the better tool. */
const MAX_RECENTS = 3;

/**
 * « Réalisé par » / « Fournisseur » (ux-flows §4.5, D32): « Nous-mêmes » by default
 * (`contact_id = null`), else a grouped native select and an inline creation that selects
 * the new contact without leaving the form.
 *
 * The providers used most recently on this boat sit above as chips (D95): a boat calls the same
 * two or three people all year, so the common case is one tap instead of « Un prestataire » plus
 * a spin of the native wheel. The list is written by the picker itself the moment a provider is
 * chosen — unlike the other memories, which wait for the save — because it is only an order of
 * appearance: the wrong guess costs a scroll, never a wrong value.
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
  // The chosen tab, once someone chooses one. Until then the value decides, so a provider
  // filled in after mount — a remembered yard, a resumed draft — opens on the right tab.
  const [tab, setTab] = useState<"crew" | "provider" | null>(null);
  const [creating, setCreating] = useState(false);
  const recents = useLastUsed<string[]>(boatId, "contact.recents");

  const all = [...contacts, ...extra.filter((e) => !contacts.some((c) => c.id === e.id))];
  const groups = groupBySpecialty(all, t("specialties.other"));
  const mode = tab ?? (value ? "provider" : "crew");
  // A provider removed from the directory since then simply drops out of the chips.
  const recent = (recents.value ?? [])
    .map((recentId) => all.find((contact) => contact.id === recentId))
    .filter((contact): contact is ContactOption => contact !== undefined)
    .slice(0, MAX_RECENTS);

  function choose(contactId: string | null) {
    onValueChange(contactId);
    if (contactId === null) return;
    setTab("provider");
    recents.remember(
      [contactId, ...(recents.value ?? []).filter((recentId) => recentId !== contactId)].slice(
        0,
        MAX_RECENTS,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        type="single"
        value={mode}
        aria-label={label}
        onValueChange={(next) => {
          if (!next) return;
          setTab(next as "crew" | "provider");
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
      {recent.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-caption text-ink-3">{t("picker.recents")}</span>
          <ToggleGroup
            type="single"
            value={recent.some((contact) => contact.id === value) ? (value ?? "") : ""}
            aria-label={t("picker.recents")}
            className="flex-wrap justify-start"
            onValueChange={(next) => next && choose(next)}
          >
            {recent.map((contact) => (
              <ToggleGroupItem key={contact.id} value={contact.id} className="min-h-11">
                {contact.name}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      ) : null}
      {mode === "provider" ? (
        <div className="flex flex-wrap items-center gap-2">
          <NativeSelect
            id={id}
            value={value ?? ""}
            onChange={(event) => choose(event.target.value || null)}
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
            choose(contact.id);
          }}
        />
      ) : null}
    </div>
  );
}
