import { z } from "zod";

/**
 * What became of one e-mail, in the app's own words (D79).
 *
 * Pure translation, no I/O: the provider's vocabulary in, the app's closed vocabulary out. It is
 * the seam that keeps English out of a French screen and a mailer's naming out of the database —
 * `src/lib/email/delivery.ts` writes what comes out of here, `boat_invitations` stores it, and
 * `members.invitations.delivery.*` in `fr.json` is what an owner reads.
 */
export const DELIVERY_STATUSES = [
  "sent",
  "delivered",
  "bounced",
  "complained",
  "delayed",
  "failed",
] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export const DELIVERY_REASONS = [
  /** The address does not exist — a typo, a closed account. */
  "no_email",
  "mailbox_full",
  /** The provider refuses to send to it again after an earlier hard bounce. */
  "suppressed",
  /** Refused for good by the recipient's server, cause unnamed. */
  "blocked",
  "content",
  /** The recipient pressed « spam »: the provider will not write to them again. */
  "spam",
  "temporary",
  "unknown",
] as const;
export type DeliveryReason = (typeof DELIVERY_REASONS)[number];

export type Delivery = {
  status: DeliveryStatus;
  reason: DeliveryReason | null;
  /** The provider's own sentence. Stored for whoever opens the table, never shown. */
  detail: string | null;
  /** The event's own instant, ISO — what orders two events, not the write. */
  at: string;
};

/** A column read back from the database, narrowed — an unknown value reads as « unknown ». */
export function toDeliveryStatus(value: string | null | undefined): DeliveryStatus | null {
  return DELIVERY_STATUSES.includes(value as DeliveryStatus) ? (value as DeliveryStatus) : null;
}

export function toDeliveryReason(value: string | null | undefined): DeliveryReason | null {
  return DELIVERY_REASONS.includes(value as DeliveryReason) ? (value as DeliveryReason) : null;
}

/** The three the owner has to be told about: the invitation is not on its way. */
export const DELIVERY_FAILURES = ["bounced", "complained", "failed"] as const;
export type DeliveryFailure = (typeof DELIVERY_FAILURES)[number];

export function deliveryFailed(
  status: DeliveryStatus | null | undefined,
): status is DeliveryFailure {
  return status === "bounced" || status === "complained" || status === "failed";
}

/** Nothing more will happen to this message: asking the provider again is wasted. */
export function isFinalDelivery(status: DeliveryStatus | null | undefined): boolean {
  return status === "delivered" || deliveryFailed(status);
}

/** A send is « fresh » for ten minutes: that is where the answer still changes. */
export const FRESH_SEND_MS = 10 * 60_000;
/** How soon the provider may be asked again about a fresh send, and about an older one. */
const FRESH_INTERVAL_MS = 5_000;
const SETTLED_INTERVAL_MS = 60_000;

/**
 * Is it worth asking the provider what became of this message?
 *
 * Two rhythms, because one was wrong. A single « once a minute » was blind exactly where it
 * mattered: a hard bounce comes back in about three seconds, and the minute that follows an
 * invitation is the one minute someone is actually looking at the screen they sent it from.
 * Signalled in use — « tu n'arrives pas à faire la différence entre les deux ? », a bounced
 * address and a delivered one both reading « envoi en cours ». They did differ; the app had just
 * refused to look.
 *
 * So a send from the last ten minutes is asked about every five seconds, and anything older
 * every minute — the provider is rate-limited, and an invitation from yesterday is not news.
 * A final state (delivered, bounced, complained, failed) is never asked about again at all.
 */
export function shouldAskAgain(
  message: { status: string | null; sentAt: string | null; askedAt: string | null },
  now = Date.now(),
): boolean {
  if (isFinalDelivery(toDeliveryStatus(message.status))) return false;
  const askedAt = message.askedAt ? Date.parse(message.askedAt) : Number.NaN;
  // Never asked (or an unreadable timestamp): the answer is what is missing.
  if (Number.isNaN(askedAt)) return true;
  const sentAt = message.sentAt ? Date.parse(message.sentAt) : Number.NaN;
  const fresh = !Number.isNaN(sentAt) && now - sentAt < FRESH_SEND_MS;
  return now - askedAt >= (fresh ? FRESH_INTERVAL_MS : SETTLED_INTERVAL_MS);
}

const EVENT_STATUS: Record<string, DeliveryStatus> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.delivery_delayed": "delayed",
  "email.failed": "failed",
};

/**
 * `last_event` of `GET /emails/{id}`: the same states without the prefix, plus the two the
 * webhook has no equivalent for. `opened` and `clicked` only happen to a message that arrived,
 * so they read as delivered — the app tracks neither, and shows neither.
 */
const LAST_EVENT_STATUS: Record<string, DeliveryStatus> = {
  queued: "sent",
  scheduled: "sent",
  sent: "sent",
  delivered: "delivered",
  opened: "delivered",
  clicked: "delivered",
  delivery_delayed: "delayed",
  bounced: "bounced",
  complained: "complained",
  failed: "failed",
  canceled: "failed",
};

/** SES vocabulary, which is what the provider passes through. Compared lowercased. */
const SUBTYPE_REASON: Record<string, DeliveryReason> = {
  noemail: "no_email",
  mailboxfull: "mailbox_full",
  suppressed: "suppressed",
  onaccountsuppressionlist: "suppressed",
  onsuppressionlist: "suppressed",
  contentrejected: "content",
  attachmentrejected: "content",
  messagetoolarge: "content",
};

/**
 * Why a bounce bounced. A subtype names it when there is one; otherwise the type decides, and
 * « Permanent » means the address refused the message for good — which is the typo, nine times
 * out of ten, so `blocked` says so in French too.
 */
export function bounceReason(
  bounce: {
    type?: string | null;
    subType?: string | null;
  } | null,
): DeliveryReason {
  const subType = (bounce?.subType ?? "").toLowerCase().replace(/[\s_-]/g, "");
  const known = SUBTYPE_REASON[subType];
  if (known) return known;
  const type = (bounce?.type ?? "").toLowerCase();
  if (type === "transient") return "temporary";
  if (type === "permanent") return "blocked";
  return "unknown";
}

const bounceSchema = z
  .object({
    type: z.string().nullish(),
    subType: z.string().nullish(),
    message: z.string().nullish(),
  })
  .nullish();

const eventSchema = z.object({
  type: z.string(),
  created_at: z.string().nullish(),
  data: z.object({
    email_id: z.string().min(1),
    created_at: z.string().nullish(),
    bounce: bounceSchema,
    failed: z.object({ reason: z.string().nullish() }).nullish(),
  }),
});

const emailSchema = z.object({
  id: z.string().min(1),
  last_event: z.string().nullish(),
  bounce: bounceSchema,
});

function reasonFor(
  status: DeliveryStatus,
  bounce: { type?: string | null; subType?: string | null } | null | undefined,
): DeliveryReason | null {
  if (status === "bounced") return bounceReason(bounce ?? null);
  if (status === "complained") return "spam";
  if (status === "failed") return "unknown";
  return null;
}

/**
 * One webhook event → what to store, or null when it is an event the app has nothing to say
 * about (`email.opened`, an unknown future type). A payload that is not an event at all also
 * answers null: the route replies 200 to it rather than making the provider retry forever.
 */
export function deliveryFromEvent(payload: unknown): (Delivery & { emailId: string }) | null {
  const parsed = eventSchema.safeParse(payload);
  if (!parsed.success) return null;
  const { type, created_at: eventAt, data } = parsed.data;
  const status = EVENT_STATUS[type];
  if (!status) return null;
  return {
    emailId: data.email_id,
    status,
    reason: reasonFor(status, data.bounce),
    detail: data.bounce?.message ?? data.failed?.reason ?? null,
    at: eventAt ?? data.created_at ?? new Date().toISOString(),
  };
}

/**
 * `GET /emails/{id}` → the same shape. The catch-up path (`refreshInvitationDeliveries`), for
 * the deploy where no webhook is configured: it asks, instead of being told.
 */
export function deliveryFromEmail(
  payload: unknown,
  at = new Date().toISOString(),
): Delivery | null {
  const parsed = emailSchema.safeParse(payload);
  if (!parsed.success) return null;
  const status = LAST_EVENT_STATUS[(parsed.data.last_event ?? "").toLowerCase()];
  if (!status) return null;
  return {
    status,
    reason: reasonFor(status, parsed.data.bounce),
    detail: parsed.data.bounce?.message ?? null,
    at,
  };
}
