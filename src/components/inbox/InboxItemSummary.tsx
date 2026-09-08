"use client";

import { useTranslations } from "next-intl";

import type { ContactOption } from "@/components/contacts/specialties";
import type { InboxDraft } from "@/components/inbox/inbox-draft";
import { formatCurrency, formatDate } from "@/lib/format";
import { parseDecimal } from "@/lib/numbers";

/**
 * A document the reading had nothing to flag, said in one line: what it will become, its title,
 * its date, its amount, who it comes from. « Valider » is then a single tap, and « Modifier »
 * opens the very same form the other cards open on.
 *
 * The sentence under it keeps what every wording of this screen keeps (D94): an agent IA filled
 * these fields, they are to be checked — a glance here rather than eight fields, but a glance.
 */
export function InboxItemSummary({
  draft,
  contacts,
}: {
  draft: InboxDraft;
  contacts: ContactOption[];
}) {
  const t = useTranslations("inbox");
  const read = parseDecimal(draft.amount);
  const amount = typeof read === "number" && Number.isFinite(read) ? read : null;
  const supplier =
    contacts.find((contact) => contact.id === draft.contactId)?.name ||
    draft.supplierName.trim() ||
    null;

  // A document with no total is still a document: the line simply says one thing less.
  const parts: string[] = [t(`kind.${draft.kind}`), formatDate(draft.date)];
  if (amount !== null) parts.push(formatCurrency(amount));
  if (supplier) parts.push(supplier);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-label font-medium text-foreground">{draft.title}</p>
      <p className="num text-body text-ink-2">{parts.join(" · ")}</p>
      <p className="text-caption text-ink-3">{t("summary.hint")}</p>
    </div>
  );
}
