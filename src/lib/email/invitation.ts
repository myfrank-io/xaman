import { INVITATION_HTML, INVITATION_SUBJECT } from "@/lib/email/invitation.generated";
import { renderTemplate } from "@/lib/email/render";

/**
 * The invitation e-mail, filled with the boat it is about (D75).
 *
 * The same HTML Supabase Auth uses for its `invite` template — generated from one source, so the
 * two paths cannot drift — with the Go placeholders resolved here instead of by GoTrue.
 * `{{ .ConfirmationURL }}` becomes the invitation's own address rather than an auth verification
 * link: nobody's account is created by opening it, and `/invite/[token]` asks for the sign-in.
 */
export type Invitation = {
  email: string;
  inviteUrl: string;
  boatName: string;
  inviterName: string;
  roleLabel: string;
  appUrl: string;
};

export function invitationEmail(invitation: Invitation): { subject: string; html: string } {
  return {
    subject: INVITATION_SUBJECT,
    html: renderTemplate(INVITATION_HTML, {
      ".ConfirmationURL": invitation.inviteUrl,
      ".SiteURL": invitation.appUrl,
      ".Email": invitation.email,
      ".Data.boat_name": invitation.boatName,
      ".Data.inviter_name": invitation.inviterName,
      ".Data.role_label": invitation.roleLabel,
    }),
  };
}
