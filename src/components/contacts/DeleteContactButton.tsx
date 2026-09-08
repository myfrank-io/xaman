"use client";

import { useTranslations } from "next-intl";

import { TrashEntityButton } from "@/components/common/TrashEntityButton";

/**
 * « Mettre à la corbeille » a provider (D41). The confirmation this replaces existed for one
 * reason — the reference counts, which are what the person is really deciding about — so the
 * counts move into the toast rather than disappearing with the dialog. Until the purge, thirty
 * days later, every one of those links is kept.
 */
export function DeleteContactButton({
  boatId,
  contactId,
  name,
  references,
}: {
  boatId: string;
  contactId: string;
  name: string;
  references: { logs: number; purchases: number; haulOuts: number };
}) {
  const t = useTranslations("contacts.delete");
  return (
    <TrashEntityButton
      kind="contact"
      boatId={boatId}
      id={contactId}
      description={t("kept", { ...references, name })}
    />
  );
}
