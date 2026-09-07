import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import fr from "@/messages/fr.json";
import {
  DELIVERY_REASONS,
  DELIVERY_STATUSES,
  bounceReason,
  deliveryFailed,
  deliveryFromEmail,
  deliveryFromEvent,
  isFinalDelivery,
  toDeliveryReason,
  toDeliveryStatus,
  type DeliveryStatus,
} from "@/lib/email/delivery-status";
import { verifyWebhookSignature } from "@/lib/email/webhook-signature";

/**
 * D79 — « il faut absolument que tu montres quand les mails sont en bounce dans l'app ».
 *
 * The invitation to `manu.lessafre@…` was accepted by the mailer at 19:00 and bounced at 19:00:
 * « Recipient not found ». Everything below is the path between that event and the sentence an
 * owner reads: the provider's vocabulary translated, the signature that lets the event in, and
 * a French sentence existing for every state the translation can produce.
 */
const bounced = (bounce: Record<string, string>) => ({
  type: "email.bounced",
  created_at: "2026-09-07T19:00:03.000Z",
  data: {
    email_id: "c6ad10f3-cbb0-4255-8318-7f000000000a",
    to: ["manu.lessafre@exemple.fr"],
    bounce,
  },
});

describe("delivery events", () => {
  it("reads the bounce that started this: recipient not found", () => {
    const delivery = deliveryFromEvent(
      bounced({ type: "Permanent", subType: "NoEmail", message: "The recipient does not exist" }),
    );
    expect(delivery).toEqual({
      emailId: "c6ad10f3-cbb0-4255-8318-7f000000000a",
      status: "bounced",
      reason: "no_email",
      detail: "The recipient does not exist",
      at: "2026-09-07T19:00:03.000Z",
    });
  });

  it("keeps a permanent bounce permanent when the provider only says « General »", () => {
    expect(deliveryFromEvent(bounced({ type: "Permanent", subType: "General" }))?.reason).toBe(
      "blocked",
    );
    expect(deliveryFromEvent(bounced({ type: "Transient", subType: "General" }))?.reason).toBe(
      "temporary",
    );
    expect(deliveryFromEvent(bounced({ type: "Undetermined" }))?.reason).toBe("unknown");
  });

  it("names the suppression list, whichever way the provider spells it", () => {
    expect(bounceReason({ type: "Permanent", subType: "Suppressed" })).toBe("suppressed");
    expect(bounceReason({ type: "Permanent", subType: "OnAccountSuppressionList" })).toBe(
      "suppressed",
    );
    expect(bounceReason({ subType: "MailboxFull" })).toBe("mailbox_full");
    expect(bounceReason({ subType: "message-too-large" })).toBe("content");
    expect(bounceReason(null)).toBe("unknown");
  });

  it("maps the other events, and ignores the ones the app says nothing about", () => {
    const event = (type: string, extra: Record<string, unknown> = {}) =>
      deliveryFromEvent({
        type,
        created_at: "2026-09-07T19:00:00.000Z",
        data: { email_id: "m1", ...extra },
      });
    expect(event("email.sent")?.status).toBe("sent");
    expect(event("email.delivered")?.status).toBe("delivered");
    expect(event("email.delivery_delayed")?.status).toBe("delayed");
    expect(event("email.complained")).toMatchObject({ status: "complained", reason: "spam" });
    expect(event("email.failed", { failed: { reason: "no sender" } })).toMatchObject({
      status: "failed",
      reason: "unknown",
      detail: "no sender",
    });
    expect(event("email.opened")).toBeNull();
    expect(event("contact.created")).toBeNull();
  });

  it("refuses a payload that is not an event", () => {
    expect(deliveryFromEvent(null)).toBeNull();
    expect(deliveryFromEvent({ type: "email.bounced" })).toBeNull();
    expect(deliveryFromEvent({ type: "email.bounced", data: { email_id: "" } })).toBeNull();
  });

  it("reads the answer of the catch-up poll the same way", () => {
    expect(deliveryFromEmail({ id: "m1", last_event: "queued" })?.status).toBe("sent");
    expect(deliveryFromEmail({ id: "m1", last_event: "opened" })?.status).toBe("delivered");
    expect(deliveryFromEmail({ id: "m1", last_event: "canceled" })?.status).toBe("failed");
    expect(
      deliveryFromEmail({ id: "m1", last_event: "bounced", bounce: { subType: "NoEmail" } }),
    ).toMatchObject({ status: "bounced", reason: "no_email" });
    expect(deliveryFromEmail({ id: "m1", last_event: "something_new" })).toBeNull();
    expect(deliveryFromEmail({ last_event: "delivered" })).toBeNull();
  });

  it("stops polling once nothing more can happen, and never before", () => {
    const final: DeliveryStatus[] = ["delivered", "bounced", "complained", "failed"];
    const open: DeliveryStatus[] = ["sent", "delayed"];
    expect(final.every(isFinalDelivery)).toBe(true);
    expect(open.some(isFinalDelivery)).toBe(false);
    expect(isFinalDelivery(null)).toBe(false);

    const failures: DeliveryStatus[] = ["bounced", "complained", "failed"];
    const fine: DeliveryStatus[] = ["sent", "delivered", "delayed"];
    expect(failures.every(deliveryFailed)).toBe(true);
    expect(fine.some(deliveryFailed)).toBe(false);
  });

  it("narrows what comes back from the database", () => {
    expect(toDeliveryStatus("bounced")).toBe("bounced");
    expect(toDeliveryStatus("something-else")).toBeNull();
    expect(toDeliveryStatus(null)).toBeNull();
    expect(toDeliveryReason("no_email")).toBe("no_email");
    expect(toDeliveryReason("")).toBeNull();
  });
});

/**
 * The endpoint is public: without this check anyone could post « this bounced » about anyone.
 */
describe("webhook signature", () => {
  const secret = `whsec_${Buffer.from("a-32-byte-endpoint-secret-value!").toString("base64")}`;
  const id = "msg_2Xd8hV";
  const now = Date.parse("2026-09-07T19:00:05.000Z");
  const timestamp = String(Math.floor(now / 1000));
  const body = JSON.stringify(bounced({ type: "Permanent", subType: "NoEmail" }));
  const sign = (secretUsed: string, payload: string, ts = timestamp) =>
    `v1,${createHmac("sha256", Buffer.from(secretUsed.replace(/^whsec_/, ""), "base64"))
      .update(`${id}.${ts}.${payload}`)
      .digest("base64")}`;

  it("accepts what the mailer signed", () => {
    expect(
      verifyWebhookSignature({ id, timestamp, signature: sign(secret, body), body, secret, now }),
    ).toBe(true);
  });

  it("accepts a header carrying several signatures (secret rotation)", () => {
    const other = `whsec_${Buffer.from("another-32-byte-endpoint-secret!").toString("base64")}`;
    const signature = `${sign(other, body)} ${sign(secret, body)}`;
    expect(verifyWebhookSignature({ id, timestamp, signature, body, secret, now })).toBe(true);
  });

  it("refuses another secret, an edited body, a stale timestamp, a missing header", () => {
    const other = `whsec_${Buffer.from("another-32-byte-endpoint-secret!").toString("base64")}`;
    const valid = { id, timestamp, signature: sign(secret, body), body, secret, now };
    expect(verifyWebhookSignature({ ...valid, secret: other })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, body: `${body} ` })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, now: now + 3_600_000 })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, signature: null })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, id: null })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, timestamp: "not-a-time" })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, secret: "" })).toBe(false);
    expect(verifyWebhookSignature({ ...valid, signature: "v0,deadbeef" })).toBe(false);
  });
});

/**
 * Rule 7: every state the mapping can produce has a French sentence, or the screen shows a key.
 */
describe("delivery messages", () => {
  const delivery = fr.members.invitations.delivery;

  it("has a sentence for every reason", () => {
    for (const reason of DELIVERY_REASONS) {
      expect(delivery.reasons[reason], reason).toBeTruthy();
    }
  });

  it("has a badge and a title for every state that failed, a note for the others", () => {
    for (const status of DELIVERY_STATUSES) {
      const shown = deliveryFailed(status)
        ? [delivery.badge[status as "bounced"], delivery.title[status as "bounced"]]
        : [delivery[status as "sent"]];
      expect(shown.every(Boolean), status).toBe(true);
    }
  });

  it("never colours the failure with the word alone", () => {
    // Art direction: a state is an icon + a label, never a colour on its own — the badge is
    // read out loud by « Non délivré », not by being red.
    const badges = Object.values(delivery.badge) as string[];
    expect(badges.every((label) => label.trim().length > 3)).toBe(true);
  });
});

/**
 * The vocabulary is written twice — once in TypeScript, once as a check constraint (0023) — and
 * a value in one but not the other is a write the database refuses, which is a bounce lost.
 */
describe("stored vocabulary", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "supabase", "migrations", "0023_invitation_delivery.sql"),
    "utf8",
  );
  const allowed = (constraint: string): string[] => {
    const clause = migration
      .split(`add constraint ${constraint}`)[1]
      ?.split(";")[0]
      ?.replace(/\s+/g, " ");
    return [...(clause ?? "").matchAll(/'([a-z_]+)'/g)].map(([, value]) => value ?? "");
  };

  it("matches the check constraint on the status", () => {
    expect(allowed("boat_invitations_delivery_status_check").sort()).toEqual(
      [...DELIVERY_STATUSES].sort(),
    );
  });

  it("matches the check constraint on the reason", () => {
    expect(allowed("boat_invitations_delivery_reason_check").sort()).toEqual(
      [...DELIVERY_REASONS].sort(),
    );
  });

  it("stores nothing the app cannot show", () => {
    const statuses: DeliveryStatus[] = [...DELIVERY_STATUSES];
    expect(statuses.filter((status) => !isFinalDelivery(status))).toEqual(["sent", "delayed"]);
  });
});
