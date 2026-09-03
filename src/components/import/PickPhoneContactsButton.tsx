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
import type { ParsedTable } from "@/lib/import/parse";

/** The support answer is fixed for the life of the document: nothing to subscribe to. */
const subscribeNever = () => () => {};
const serverFalse = () => false;

/**
 * « Choisir dans mes contacts ».
 *
 * Absent — not disabled — where the browser has no address book to open. Most iPhones are in
 * that case (Safari keeps the Contact Picker behind a feature flag), and there is no web API
 * to fall back to, so offering a button that cannot work would only waste a tap. The check
 * runs in an effect: `navigator` does not exist while rendering on the server.
 */
export function PickPhoneContactsButton({
  onPicked,
}: {
  /** Receives the chosen cards as the table a `.vcf` would have produced. */
  onPicked: (table: ParsedTable, origin: string) => void;
}) {
  const t = useTranslations("import.source");
  // `navigator` does not exist while rendering on the server, and the answer never changes
  // afterwards — so: false on the server, read once on the client, no subscription.
  const supported = useSyncExternalStore(subscribeNever, canPickPhoneContacts, serverFalse);
  const [gone, setGone] = useState(false);
  const [pending, setPending] = useState(false);

  if (!supported || gone) return null;

  async function pick() {
    setPending(true);
    try {
      const table = await pickPhoneContacts();
      if (table.rows.length === 0) return; // dismissed, or nothing named — not an error
      onPicked(table, t("phoneOrigin"));
    } catch (error) {
      // A refused permission and a browser that turns out not to support it read the same to
      // the person holding the phone: nothing was chosen. Only say so once.
      if (error instanceof ContactPickerUnavailable) setGone(true);
      else toast.error(t("phoneFailed"));
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
      {t("phone")}
    </Button>
  );
}
