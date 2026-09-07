/**
 * Sample values for /dev/ui/emails: what Supabase would substitute — the invitation metadata,
 * the code, the links. The substitution itself lives in `@/lib/email/render`, shared with the
 * invitation the app sends itself (D75).
 */
import { renderTemplate, unresolvedPlaceholders as unresolved } from "@/lib/email/render";

export const SAMPLE_VALUES: Record<string, string> = {
  ".Token": "418273",
  ".ConfirmationURL": "https://xaman.app/auth/v1/verify?token=b3f1…&type=invite",
  ".SiteURL": "https://xaman.app",
  ".Email": "emmanuel@exemple.fr",
  ".NewEmail": "emmanuel.lesaffre@exemple.fr",
  ".Data.boat_name": "Xaman",
  ".Data.inviter_name": "Xavier",
  ".Data.role_label": "Éditeur",
};

export const renderEmailPreview = (html: string, values = SAMPLE_VALUES) =>
  renderTemplate(html, values);

export const unresolvedPlaceholders = (html: string, values = SAMPLE_VALUES) =>
  unresolved(html, values);
