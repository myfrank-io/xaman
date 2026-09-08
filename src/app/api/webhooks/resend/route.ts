import { after, NextResponse, type NextRequest } from "next/server";

import { applyDelivery } from "@/lib/email/delivery";
import { deliveryFromEvent } from "@/lib/email/delivery-status";
import { verifyWebhookSignature } from "@/lib/email/webhook-signature";
import { analyseInboxItem } from "@/lib/inbox/analyse";
import { notifyInboxReceived } from "@/lib/inbox/notify";
import { receiveInboundEmail } from "@/lib/inbox/receive";
import { inboundFromEvent } from "@/lib/inbox/resend-inbound";

/**
 * Where the mailer says what became of a message it accepted (D79).
 *
 * Resend posts one signed event per state change — sent, delivered, bounced, complained,
 * delayed, failed — and `applyDelivery` writes it on the invitation carrying that message id.
 * That is what turns « En attente » into « Non délivré » on the Membres screen seconds after a
 * typo, instead of fourteen days later.
 *
 * The endpoint is public, so the signature is the whole door: no secret configured, no events
 * accepted. Nothing else in the app depends on it — without the webhook the screen still catches
 * up by asking (`refreshInvitationDeliveries`), only a minute later rather than at once.
 *
 * Since D84 the same endpoint receives `email.received`: a message sent to a boat's own address.
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

  // A message for a boat (D84). « Ignored » for an address that is nobody's: retrying would not
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

  // An event the app has nothing to store (opened, clicked, one added later) is not an error:
  // answering anything but 200 would have the provider retry it for hours.
  const delivery = deliveryFromEvent(payload);
  if (!delivery) return NextResponse.json({ ignored: true });

  try {
    // False means no invitation carries that id — the weekly digest goes through this mailer too.
    const matched = await applyDelivery(delivery.emailId, delivery);
    return NextResponse.json({ matched });
  } catch (error) {
    // Retriable on our side: a 500 gets the event again rather than losing the bounce.
    console.error("resend webhook: could not store the event", error);
    return NextResponse.json({ error: "storage failed" }, { status: 500 });
  }
}
