/**
 * Fills a Supabase Auth template with sample values, so the six e-mails can be looked at in
 * /dev/ui/emails instead of being discovered in someone's inbox.
 *
 * Not a Go template engine: it understands exactly the two forms the templates use — a value,
 * and a guard around a value that may be missing (`{{ if .Data.boat_name }}…{{ else }}…{{ end }}`).
 * That is deliberate. If a template ever needs a third form, this throws it into view here
 * rather than rendering `<no value>` in a real e-mail.
 */
export type EmailPreviewValues = Record<string, string>;

/** What Supabase would substitute: the invitation metadata, the code, the links. */
export const SAMPLE_VALUES: EmailPreviewValues = {
  ".Token": "418273",
  ".ConfirmationURL": "https://xaman.app/auth/v1/verify?token=b3f1…&type=invite",
  ".SiteURL": "https://xaman.app",
  ".Email": "emmanuel@exemple.fr",
  ".NewEmail": "emmanuel.lesaffre@exemple.fr",
  ".Data.boat_name": "Xaman",
  ".Data.inviter_name": "Xavier",
  ".Data.role_label": "Éditeur",
};

const GUARD = /\{\{ if (\.[\w.]+) \}\}([\s\S]*?)(?:\{\{ else \}\}([\s\S]*?))?\{\{ end \}\}/g;
const VALUE = /\{\{ (\.[\w.]+) \}\}/g;

export function renderEmailPreview(html: string, values = SAMPLE_VALUES): string {
  return html
    .replace(GUARD, (_, name: string, then: string, otherwise = "") =>
      values[name] ? then : otherwise,
    )
    .replace(VALUE, (match, name: string) => values[name] ?? match);
}

/** Every placeholder the preview could not fill — what a real inbox would show as `<no value>`. */
export function unresolvedPlaceholders(html: string, values = SAMPLE_VALUES): string[] {
  const rendered = renderEmailPreview(html, values);
  return [...new Set(rendered.match(/\{\{[^}]*\}\}/g) ?? [])];
}
