import "server-only";

import {
  deliveryFromEmail,
  shouldAskAgain,
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

type PendingMessage = {
  id: string;
  email_id: string | null;
  delivery_status: string | null;
  delivery_updated_at: string | null;
  created_at: string;
  reminded_at: string | null;
};

const MESSAGE_COLUMNS = "id, email_id, delivery_status, delivery_updated_at, created_at";

/**
 * The invitations that carry a message, with when that message last went out.
 *
 * The second select is the deploy order (rule 3): the schema is pushed by hand, so a build can
 * reach production before `0030` does and `reminded_at` may not exist yet. A read path degrades
 * rather than stops — without it a resent invitation is simply asked about once a minute instead
 * of every five seconds, which is a slower screen, not a wrong one.
 */
async function pendingMessages(
  admin: ReturnType<typeof createAdminClient>,
  invitationIds: string[],
): Promise<PendingMessage[]> {
  const withReminder = await admin
    .from("boat_invitations")
    .select(`${MESSAGE_COLUMNS}, reminded_at`)
    .in("id", invitationIds)
    .not("email_id", "is", null);
  if (!withReminder.error) return withReminder.data;

  console.error(`invitation delivery: read without the reminders — ${withReminder.error.message}`);
  const { data } = await admin
    .from("boat_invitations")
    .select(MESSAGE_COLUMNS)
    .in("id", invitationIds)
    .not("email_id", "is", null);
  return (data ?? []).map((row) => ({ ...row, reminded_at: null }));
}

/**
 * Asks the provider what became of the invitations about to be shown, and returns what changed.
 *
 * Costs nothing in the steady state: a delivered or bounced message is final, and an old send
 * is asked about at most once a minute — so the usual render polls nothing at all. A send from
 * the last ten minutes is asked about every five seconds instead: see `shouldAskAgain`.
 */
export async function refreshInvitationDeliveries(
  invitationIds: string[],
): Promise<Map<string, InvitationDelivery>> {
  const fresh = new Map<string, InvitationDelivery>();
  const key = process.env.RESEND_API_KEY ?? "";
  if (!mailerConfigured() || invitationIds.length === 0) return fresh;

  try {
    const admin = createAdminClient();
    const rows = await pendingMessages(admin, invitationIds);

    const now = Date.now();
    const candidates = rows
      .filter((row) =>
        shouldAskAgain(
          {
            status: row.delivery_status,
            // The last message this invitation sent, which a reminder replaces (D110): the ten
            // minutes worth watching closely follow the send, not the invitation's birthday.
            sentAt: row.reminded_at ?? row.created_at,
            askedAt: row.delivery_updated_at,
          },
          now,
        ),
      )
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
    if (!res.ok) {
      // A refused read is the one failure that hides itself: the screen keeps saying « envoi en
      // cours » for ever and nothing says why. A sending-only API key answers 401 here.
      console.error(`resend GET /emails ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    return deliveryFromEmail(await res.json());
  } catch (error) {
    console.error("resend GET /emails failed", error);
    return null;
  }
}
