import "server-only";

import {
  deliveryFromEmail,
  isFinalDelivery,
  toDeliveryStatus,
  type Delivery,
  type DeliveryReason,
  type DeliveryStatus,
} from "@/lib/email/delivery-status";
import { mailerConfigured } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * What became of an invitation e-mail, kept on the invitation itself (D79).
 *
 * Two ways in, one writer:
 *   * the webhook (`/api/webhooks/resend`) — instant, and what the app is built around;
 *   * `refreshInvitationDeliveries`, the catch-up poll the Membres screen runs on the
 *     invitations it is about to show. It exists because the webhook is configured outside this
 *     repository, and « nobody received this » must not wait on a dashboard being visited.
 *
 * Both write with the service key: the columns are not granted to `authenticated` (0023), and an
 * editor cannot even read back the invitation they created (owner-only select policy).
 */
const ENDPOINT = "https://api.resend.com/emails";

/** Don't ask the provider about the same message twice in a minute. */
const POLL_THROTTLE_MS = 60_000;
/** Enough for a crew, few enough to never hold a screen: the rest catches up on the next visit. */
const POLL_LIMIT = 4;

export type InvitationDelivery = {
  status: DeliveryStatus | null;
  reason: DeliveryReason | null;
};

function isoOr(value: string | null | undefined, fallback: string): string {
  const time = value ? Date.parse(value) : Number.NaN;
  return Number.isNaN(time) ? fallback : new Date(time).toISOString();
}

/**
 * The message id, the moment the app sends it. Failing to record it costs the delivery status,
 * never the invitation — which is already inserted, and whose link the dialog offers anyway.
 */
export async function recordInvitationSent(invitationId: string, emailId: string): Promise<void> {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("boat_invitations")
      .update({
        email_id: emailId,
        delivery_status: "sent",
        delivery_reason: null,
        delivery_detail: null,
        delivery_updated_at: new Date().toISOString(),
      })
      .eq("id", invitationId);
    if (error) console.error("invitation delivery: could not record the send", error.message);
  } catch (error) {
    console.error("invitation delivery: no admin client", error);
  }
}

/**
 * Stores one event against the invitation that message belongs to.
 *
 * The `lte` guard is the whole trick: events arrive out of order (a retried `sent` after a
 * `bounced` is normal), and an older one must never win. Answers false when no invitation
 * carries that message id — the weekly digest also goes through this mailer, and its events are
 * not an error.
 */
export async function applyDelivery(emailId: string, delivery: Delivery): Promise<boolean> {
  const at = isoOr(delivery.at, new Date().toISOString());
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("boat_invitations")
    .update({
      delivery_status: delivery.status,
      delivery_reason: delivery.reason,
      delivery_detail: delivery.detail,
      delivery_updated_at: at,
    })
    .eq("email_id", emailId)
    // Quoted: the value carries colons and dots, which the filter grammar reads as separators.
    .or(`delivery_updated_at.is.null,delivery_updated_at.lte."${at}"`)
    .select("id");
  if (error) {
    console.error("invitation delivery: update refused", error.message);
    return false;
  }
  return (data?.length ?? 0) > 0;
}

/**
 * Asks the provider what became of the invitations about to be shown, and returns what changed.
 *
 * Costs nothing in the steady state: a delivered or bounced message is final, and a message
 * asked about a minute ago is left alone — so the usual render polls nothing at all.
 */
export async function refreshInvitationDeliveries(
  invitationIds: string[],
): Promise<Map<string, InvitationDelivery>> {
  const fresh = new Map<string, InvitationDelivery>();
  const key = process.env.RESEND_API_KEY ?? "";
  if (!mailerConfigured() || invitationIds.length === 0) return fresh;

  try {
    const admin = createAdminClient();
    const { data: rows } = await admin
      .from("boat_invitations")
      .select("id, email_id, delivery_status, delivery_updated_at")
      .in("id", invitationIds)
      .not("email_id", "is", null);

    const stale = Date.now() - POLL_THROTTLE_MS;
    const candidates = (rows ?? [])
      .filter((row) => !isFinalDelivery(toDeliveryStatus(row.delivery_status)))
      // Never asked about (no timestamp) counts as stale: the answer is what is missing.
      .filter((row) => !row.delivery_updated_at || Date.parse(row.delivery_updated_at) < stale)
      .slice(0, POLL_LIMIT);

    // Sequential on purpose: four at once is a burst the provider rate-limits, and a 429 here
    // would cost exactly the bounce this is for.
    for (const row of candidates) {
      const delivery = await fetchDelivery(row.email_id ?? "", key);
      if (!delivery) continue;
      await applyDelivery(row.email_id ?? "", delivery);
      fresh.set(row.id, { status: delivery.status, reason: delivery.reason });
    }
  } catch (error) {
    // A screen never fails because a mailer did: it shows what the database already knows.
    console.error("invitation delivery: refresh failed", error);
  }
  return fresh;
}

async function fetchDelivery(emailId: string, key: string): Promise<Delivery | null> {
  if (!emailId) return null;
  try {
    const res = await fetch(`${ENDPOINT}/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return deliveryFromEmail(await res.json());
  } catch {
    return null;
  }
}
