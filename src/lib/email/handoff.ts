import { HANDOFF_HTML, HANDOFF_SUBJECT } from "@/lib/email/templates.generated";
import { renderTemplate } from "@/lib/email/render";

/**
 * « Confier au chantier » (E19-11, D141): what the yard receives.
 *
 * The same shell as every e-mail of the app, generated from one source; the placeholders are
 * resolved here. Every value comes from the carnet or from what the owner typed, so each one is
 * escaped: `renderTemplate` substitutes, it does not sanitise, and a message reading
 * « <script> » must reach the yard as those nine characters.
 */
export type HandOverMail = {
  boatName: string;
  /** « Marsaudon Composites ORC 50 · coque n° 25 », or null when the boat says nothing of itself. */
  boatModel: string | null;
  itemLabel: string;
  categoryName: string | null;
  /** The due sentence as the checklist says it: « En retard de 12 jours », « Dans 3 semaines ». */
  dueLabel: string;
  /** « 1 482,5 h · Moteur bâbord », or null when the counter was never read. */
  hoursLabel: string | null;
  /** « 14/06/2025 à 1 204 h · Chantier du Guip », or null when never done. */
  lastDoneLabel: string | null;
  message: string | null;
  requesterName: string;
  requesterEmail: string;
  appUrl: string;
};

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

/** Escaped, and the owner's line breaks kept: a message is typed in a textarea. */
function multiline(value: string | null): string {
  if (!value) return "";
  return escapeHtml(value.trim()).replace(/\r?\n/g, "<br />");
}

export function handOverEmail(mail: HandOverMail): { subject: string; html: string } {
  const values = {
    ".SiteURL": mail.appUrl,
    ".Data.boat_name": escapeHtml(mail.boatName),
    ".Data.boat_model": mail.boatModel ? escapeHtml(mail.boatModel) : "",
    ".Data.item_label": escapeHtml(mail.itemLabel),
    ".Data.category_name": mail.categoryName ? escapeHtml(mail.categoryName) : "",
    ".Data.due_label": escapeHtml(mail.dueLabel),
    ".Data.hours_label": mail.hoursLabel ? escapeHtml(mail.hoursLabel) : "",
    ".Data.last_done_label": mail.lastDoneLabel ? escapeHtml(mail.lastDoneLabel) : "",
    ".Data.message": multiline(mail.message),
    ".Data.requester_name": escapeHtml(mail.requesterName),
    ".Data.requester_email": escapeHtml(mail.requesterEmail),
  };
  return {
    // The subject is plain text: what the inbox list shows, unescaped.
    subject: renderTemplate(HANDOFF_SUBJECT, {
      ".Data.boat_name": mail.boatName,
      ".Data.item_label": mail.itemLabel,
    }),
    html: renderTemplate(HANDOFF_HTML, values),
  };
}
