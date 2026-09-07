import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Standard Webhooks (Svix) signature — how the mailer proves an event is its own (D79).
 *
 * The endpoint is public: anything on the internet can POST « this invitation bounced » and,
 * without this, be believed. So the body is HMAC'd with the endpoint's own secret and the
 * result compared in constant time, and a replay of a real event is bounded by the timestamp
 * the signature covers.
 *
 * `node:crypto` rather than the provider's SDK: three headers and one HMAC do not deserve a
 * dependency (rule 10).
 */
const TOLERANCE_SECONDS = 300;
const VERSION = "v1,";

export type SignedWebhook = {
  /** `svix-id`, `svix-timestamp`, `svix-signature` — a space-separated list of `v1,<base64>`. */
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  /** The raw body, byte for byte: re-serialising parsed JSON changes it and breaks the check. */
  body: string;
  secret: string;
  now?: number;
};

export function verifyWebhookSignature({
  id,
  timestamp,
  signature,
  body,
  secret,
  now = Date.now(),
}: SignedWebhook): boolean {
  if (!id || !timestamp || !signature || !secret) return false;

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) return false;
  if (Math.abs(now / 1000 - sentAt) > TOLERANCE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  if (key.length === 0) return false;
  const expected = createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest();

  // A header carries every signature the endpoint has ever had, so a secret rotation does not
  // drop events: one of them matching is the answer.
  return signature
    .split(" ")
    .filter((part) => part.startsWith(VERSION))
    .some((part) => {
      const candidate = Buffer.from(part.slice(VERSION.length), "base64");
      return candidate.length === expected.length && timingSafeEqual(candidate, expected);
    });
}
