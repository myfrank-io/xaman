import { CREDENTIALS_HTML, CREDENTIALS_SUBJECT } from "@/lib/email/templates.generated";
import { renderTemplate } from "@/lib/email/render";

/**
 * The one e-mail a new or newly-added member gets (D151): who they are on Xaman, and how to open
 * it — nothing left to click to become a member, because the account and the boat access are
 * granted before this is sent (`src/lib/actions/members.ts`).
 *
 * `password` is absent for someone who already had a Xaman account (another boat): their own
 * password still opens this one, and writing a new one over it would lock them out rather than
 * let them in. The template's `{{ if .Data.password }}` guard is what tells the two apart.
 */
export type Credentials = {
  email: string;
  /** Null when the account already existed — never overwritten, never re-sent. */
  password: string | null;
  boatName: string;
  inviterName: string;
  roleLabel: string;
  appUrl: string;
};

export function credentialsEmail(credentials: Credentials): {
  subject: string;
  html: string;
  text: string;
} {
  const html = renderTemplate(CREDENTIALS_HTML, {
    ".Data.boat_name": credentials.boatName,
    ".Data.inviter_name": credentials.inviterName,
    ".Data.role_label": credentials.roleLabel,
    ".Data.email": credentials.email,
    ".Data.password": credentials.password ?? "",
    ".SiteURL": credentials.appUrl,
  });
  return {
    subject: renderTemplate(CREDENTIALS_SUBJECT, { ".Data.boat_name": credentials.boatName }),
    html,
    text: credentialsText(credentials),
  };
}

/**
 * A plain-text part alongside the HTML: an HTML-only message is itself one of the signals a spam
 * filter weighs, on top of whatever the sending domain's own authentication says (SPF/DKIM/DMARC
 * — outside this file, configured with the mailer).
 */
function credentialsText(credentials: Credentials): string {
  const lines = [
    credentials.inviterName
      ? `${credentials.inviterName} vous a donné accès au carnet d'entretien de ${credentials.boatName} sur Xaman, en tant que ${credentials.roleLabel}.`
      : `Vous avez accès au carnet d'entretien de ${credentials.boatName} sur Xaman, en tant que ${credentials.roleLabel}.`,
    "",
    `Identifiant : ${credentials.email}`,
  ];
  if (credentials.password) {
    lines.push(`Mot de passe : ${credentials.password}`);
    lines.push("", "Vous pourrez le changer depuis Mon profil, une fois connecté.");
  } else {
    lines.push("", "Connectez-vous avec le mot de passe que vous utilisez déjà sur Xaman.");
  }
  lines.push("", `Se connecter : ${credentials.appUrl}/login`);
  return lines.join("\n");
}
