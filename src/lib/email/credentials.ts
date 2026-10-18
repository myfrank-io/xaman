import { CREDENTIALS_HTML, CREDENTIALS_SUBJECT } from "@/lib/email/templates.generated";
import { renderTemplate } from "@/lib/email/render";

/**
 * The one e-mail an invited or reissued member gets (D151): their login e-mail and a fresh,
 * simple password, nothing to click, nothing to accept. App-only — Supabase Auth never sends
 * this one, so there is no `supabase/templates/credentials.html` counterpart.
 */
export type Credentials = {
  email: string;
  password: string;
  appUrl: string;
  boatName?: string;
  inviterName?: string;
  roleLabel?: string;
};

export function credentialsEmail({
  email,
  password,
  appUrl,
  boatName = "",
  inviterName = "",
  roleLabel = "",
}: Credentials): { subject: string; html: string } {
  const values = {
    ".Data.email": email,
    ".SiteURL": appUrl,
    ".Data.password": password,
    ".Data.boat_name": boatName,
    ".Data.inviter_name": inviterName,
    ".Data.role_label": roleLabel,
    ".Data.login_url": `${appUrl}/login?email=${encodeURIComponent(email)}`,
  };
  return {
    subject: renderTemplate(CREDENTIALS_SUBJECT, values),
    html: renderTemplate(CREDENTIALS_HTML, values),
  };
}
