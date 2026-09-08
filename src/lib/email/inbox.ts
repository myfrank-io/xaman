import {
  INBOX_READY_HTML,
  INBOX_READY_SUBJECT,
  INBOX_VALIDATED_HTML,
  INBOX_VALIDATED_SUBJECT,
} from "@/lib/email/templates.generated";
import { renderTemplate } from "@/lib/email/render";

/**
 * The two e-mails of the inbox (D91): « un document est arrivé, il attend votre validation », and
 * « c'est validé ». Same shell as every other e-mail of the app, generated from one source; the
 * placeholders are resolved here.
 */
export type InboxReadyMail = {
  boatName: string;
  /** « Chantier Naval (compta@chantier.fr) », or the address alone. */
  senderLabel: string;
  subject: string | null;
  /** « 1 document » / « 3 documents ». */
  countLabel: string;
  inboxUrl: string;
  appUrl: string;
};

export function inboxReadyEmail(mail: InboxReadyMail): { subject: string; html: string } {
  const values = {
    ".SiteURL": mail.appUrl,
    ".Data.boat_name": mail.boatName,
    ".Data.sender": mail.senderLabel,
    ".Data.subject": mail.subject ?? "",
    ".Data.count_label": mail.countLabel,
    ".Data.inbox_url": mail.inboxUrl,
  };
  return {
    subject: renderTemplate(INBOX_READY_SUBJECT, values),
    html: renderTemplate(INBOX_READY_HTML, values),
  };
}

export type InboxValidatedMail = {
  boatName: string;
  validatorName: string;
  /** « Intervention » or « Achat ». */
  kindLabel: string;
  title: string;
  dateLabel: string;
  amountLabel: string | null;
  url: string;
  appUrl: string;
};

export function inboxValidatedEmail(mail: InboxValidatedMail): { subject: string; html: string } {
  const values = {
    ".SiteURL": mail.appUrl,
    ".Data.boat_name": mail.boatName,
    ".Data.validator_name": mail.validatorName,
    ".Data.kind_label": mail.kindLabel,
    ".Data.title": mail.title,
    ".Data.date_label": mail.dateLabel,
    ".Data.amount_label": mail.amountLabel ?? "",
    ".Data.url": mail.url,
  };
  return {
    subject: renderTemplate(INBOX_VALIDATED_SUBJECT, values),
    html: renderTemplate(INBOX_VALIDATED_HTML, values),
  };
}
