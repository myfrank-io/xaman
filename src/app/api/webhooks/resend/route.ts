import { after, NextResponse, type NextRequest } from "next/server";

import { verifyWebhookSignature } from "@/lib/email/webhook-signature";
import { analyseInboxItem } from "@/lib/inbox/analyse";
import { notifyInboxReceived } from "@/lib/inbox/notify";
import { receiveInboundEmail } from "@/lib/inbox/receive";
import { inboundFromEvent } from "@/lib/inbox/resend-inbound";

/**
 * Where Resend posts what happens to mail sent through it.
 *
 * D151 dropped the invitation-delivery tracking this endpoint used to feed (`boat_invitations`,
 * bounces, complaints): there is no pending invitation to report on any more, since a member's
 * account and membership are created up front. What is left, and what this endpoint is for now:
 *
 * Since D91 it receives `email.received`: a message sent to a boat's own address.
 * Its attachments become rows of the inbox before the mailer gets its answer — the bytes have to
 * be fetched while the event is fresh — and the reading of each document, which takes as long as
 * a Claude call, runs after the response (`after`), then one e-mail tells the crew.
 *
 * To wire it: Resend → Webhooks → this URL, events `email.*` (sending) and `email.received`
 * (the receiving domain of `INBOUND_EMAIL_DOMAIN`), then `RESEND_WEBHOOK_SECRET`.
 */
export const dynamic = "force-dynamic";
/** Fetching a few attachments, then reading them: the platform's floor is too short for both. */
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET ?? "";
  if (!secret) {
    console.error("resend webhook: RESEND_WEBHOOK_SECRET is not set, event refused");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // The raw body, not the parsed one: the signature covers these exact bytes.
  const body = await request.text();
  const verified = verifyWebhookSignature({
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    body,
    secret,
  });
  if (!verified) return NextResponse.json({ error: "invalid signature" }, { status: 401 });

  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  // A message for a boat (D91). « Ignored » for an address that is nobody's: retrying would not
  // make it somebody's.
  const inbound = inboundFromEvent(payload);
  if (inbound) {
    try {
      const received = await receiveInboundEmail(inbound);
      if (!received) return NextResponse.json({ ignored: true });
      if (received.itemIds.length > 0) {
        after(async () => {
          for (const itemId of received.itemIds) await analyseInboxItem(itemId);
          await notifyInboxReceived(received.boatId, received.itemIds);
        });
      }
      return NextResponse.json({ received: received.itemIds.length, skipped: received.skipped });
    } catch (error) {
      console.error("resend webhook: could not receive the message", error);
      return NextResponse.json({ error: "storage failed" }, { status: 500 });
    }
  }

  // Everything else (sent, delivered, bounced, opened, …) has nothing left to be stored against
  // since D151: answering 200 rather than an error keeps the provider from retrying it forever.
  return NextResponse.json({ ignored: true });
}
