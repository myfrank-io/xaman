import { NextResponse, type NextRequest } from "next/server";

import { applyDelivery } from "@/lib/email/delivery";
import { deliveryFromEvent } from "@/lib/email/delivery-status";
import { verifyWebhookSignature } from "@/lib/email/webhook-signature";

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
 * To wire it: Resend → Webhooks → this URL, events `email.*`, then `RESEND_WEBHOOK_SECRET`.
 */
export const dynamic = "force-dynamic";

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
