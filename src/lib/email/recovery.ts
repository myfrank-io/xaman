import { renderTemplate } from "@/lib/email/render";
import { RECOVERY_HTML, RECOVERY_SUBJECT } from "@/lib/email/templates.generated";

/**
 * The password-recovery e-mail, carrying the code rather than a link (D78).
 *
 * The same HTML Supabase Auth uses for its `recovery` template — generated from one source, so
 * the two paths cannot drift — with the Go placeholders resolved here instead of by GoTrue.
 * `{{ .Token }}` is the raw OTP that `generateLink` hands back, which is what makes this a code
 * e-mail: nothing in it is a URL, so nothing in it can be opened by a mailbox's scanner before
 * its owner reads it.
 *
 * The subject carries the code too — `{{ .Token }}` again, resolved here — because on an iPad
 * the notification is often all someone needs to read.
 */
export type Recovery = {
  code: string;
  appUrl: string;
};

export function recoveryEmail({ code, appUrl }: Recovery): { subject: string; html: string } {
  const values = { ".Token": code, ".SiteURL": appUrl };
  return {
    subject: renderTemplate(RECOVERY_SUBJECT, values),
    html: renderTemplate(RECOVERY_HTML, values),
  };
}
