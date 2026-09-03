"use client";

import { useState, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { ContactRoundIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  canPickPhoneContacts,
  ContactPickerUnavailable,
  pickPhoneContacts,
} from "@/lib/import/phone-contacts";

/** The support answer is fixed for the life of the document: nothing to subscribe to. */
const subscribeNever = () => () => {};
const serverFalse = () => false;

/**
 * « Choisir dans mes contacts », on the provider form itself.
 *
 * It first shipped inside the import wizard, which is the wrong place: importing is a
 * spreadsheet gesture, and pulling one card out of your address book is what you do while
 * filling this form. « Je ne le vois toujours pas, il doit remplacer importer sur mobile » —
 * the instinct is right, the place was the form, one tap from « Nouvel intervenant ».
 *
 * It fills the fields rather than writing anything: you still see what arrived, correct the
 * trade, and save. Absent where the browser has no address book to open — most iPhones, since
 * Safari keeps the Contact Picker behind a feature flag, and there is no web API to fall back
 * to. Replacing « Importer » with it, as suggested, would have removed importing on exactly
 * those devices.
 */
export function FillFromPhoneButton({
  onPicked,
}: {
  onPicked: (contact: { name: string; phone: string; email: string }) => void;
}) {
  const t = useTranslations("contacts");
  const supported = useSyncExternalStore(subscribeNever, canPickPhoneContacts, serverFalse);
  const [gone, setGone] = useState(false);
  const [pending, setPending] = useState(false);

  /**
   * Where there is no address book to open, say so rather than render nothing.
   *
   * Silence was the wrong call. « Je ne le vois toujours pas » came back three times, and it
   * had to: from the outside, « your browser does not offer this » and « it is not deployed
   * yet » look identical. A caption cannot be tapped uselessly — the objection to a dead
   * button does not apply to it — and it names the one thing that does work here.
   */
  if (!supported || gone) {
    return <p className="text-caption text-ink-3">{t("fromPhoneUnavailable")}</p>;
  }

  async function pick() {
    setPending(true);
    try {
      const table = await pickPhoneContacts();
      const row = table.rows[0];
      if (!row) return; // dismissed, or a card with no name — a choice, not an error
      onPicked({ name: row[0] ?? "", phone: row[3] ?? "", email: row[4] ?? "" });
    } catch (error) {
      if (error instanceof ContactPickerUnavailable) setGone(true);
      else toast.error(t("fromPhoneFailed"));
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="h-auto min-h-11 w-full py-2 whitespace-normal sm:w-auto"
      disabled={pending}
      onClick={() => void pick()}
    >
      {pending ? <Spinner /> : <ContactRoundIcon />}
      {t("fromPhone")}
    </Button>
  );
}
