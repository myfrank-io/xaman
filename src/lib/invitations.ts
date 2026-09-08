import type { DeliveryStatus } from "@/lib/email/delivery-status";

/**
 * What an invitation is, and when it may be sent again (D112).
 *
 * Pure rules, no I/O, one file: the Server Action decides with them (it is the authority) and
 * the Membres screen shows the button with them (a confort, per rule 2 of CLAUDE.md). Written
 * once so the two cannot disagree — a button offered for an action the server refuses is worse
 * than no button.
 */
export const INVITATION_STATUSES = ["pending", "expired", "accepted", "revoked"] as const;
export type InvitationStatus = (typeof INVITATION_STATUSES)[number];

/**
 * The window the e-mail itself promises (« un lien valable 14 jours »), and the default of
 * `boat_invitations.expires_at`. A reminder restarts it: a message sent on day thirteen must not
 * carry a link that dies tomorrow.
 */
export const INVITATION_VALIDITY_DAYS = 14;

/**
 * An hour between two reminders for the same invitation.
 *
 * Long enough that a second tap — or a second person looking at the same screen — costs one
 * message and not two (rule 11), short enough that « je réessaie » after fixing something is not
 * a wait. The invitee's mailbox is the thing being protected here; the button says nothing about
 * the delay until it is hit, because the wait is measured in minutes and the case is rare.
 */
export const REMINDER_COOLDOWN_MS = 60 * 60_000;

export type RemindableInvitation = {
  status: InvitationStatus;
  /** What became of the last message (D79). Null when the app did not send it: unknown. */
  delivery: DeliveryStatus | null;
};

/**
 * May this invitation be sent again to the same address?
 *
 * Two refusals, and both are about the address rather than the timing:
 *
 *   * an invitation that is **accepted or revoked** is over — the first has a member behind it,
 *     the second was taken back on purpose;
 *   * an address that **bounced or complained** will not receive anything, ever. After a hard
 *     bounce the provider puts it on its suppression list, so a reminder is a message that
 *     leaves and lands nowhere while the screen says « envoi en cours » (D79). The way out of
 *     that one is « Réinviter » — a corrected address, a new invitation — and it is already on
 *     the row, in the red panel that explains why.
 *
 * `failed` is *not* a refusal: the message never reached the provider at all (a key, a domain,
 * a bad minute). Sending it again is exactly the right move.
 *
 * An **expired** invitation is remindable, and this is deliberate: the reminder restarts the
 * fourteen days, which is one row and one link rather than a dead row beside a fresh one.
 */
export function canRemind(invitation: RemindableInvitation): boolean {
  if (invitation.status === "accepted" || invitation.status === "revoked") return false;
  if (invitation.delivery === "bounced" || invitation.delivery === "complained") return false;
  return true;
}

/** True while the cooldown still runs — the caller has already sent one, minutes ago. */
export function remindedTooRecently(
  remindedAt: string | null | undefined,
  now = Date.now(),
): boolean {
  const at = remindedAt ? Date.parse(remindedAt) : Number.NaN;
  if (Number.isNaN(at)) return false;
  // A timestamp in the future (a clock behind the database's) blocks nothing for ever: the
  // cooldown is a window, and anything outside it in either direction is « long enough ago ».
  const since = now - at;
  return since >= 0 && since < REMINDER_COOLDOWN_MS;
}
