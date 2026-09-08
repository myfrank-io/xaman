"use client";

import { isNetworkFailure, type OutboxEntry, type OutboxKind } from "@/lib/outbox";
import type { ActionResult } from "@/lib/actions/result";

export type QueueResult<T> =
  | { status: "sent"; data: T }
  | { status: "refused"; error: string }
  | { status: "queued" }
  | { status: "full" };

/**
 * Send a creation, or keep it on the device (E9-1b, D25).
 *
 * Offline, a creation is attempted only when it may be queued: it goes straight to the queue and
 * the form closes as if it had been saved, because for the person it has been — it is on the iPad
 * and it is listed. Online, a refusal by the database is shown as usual; only a request that never
 * reached the server falls back to the queue.
 *
 * An **edit** is never queued (`allowQueue: false`): the outbox is creations-only because an edit
 * replayed later would overwrite whatever a colleague changed in the meantime (see `lib/outbox.ts`).
 * When an edit cannot reach the server it is refused, the form keeps its input, and the person
 * retries when the network is back — it is sent or it fails, it is never silently deferred.
 */
export async function submitOrQueue<T>({
  kind,
  boatId,
  id,
  label,
  values,
  action,
  enqueue,
  online,
  allowQueue,
}: {
  kind: OutboxKind;
  boatId: string;
  /** Row id drawn when the form opened: replaying is idempotent on it (rule 11). */
  id: string;
  label: string;
  values: unknown;
  action: (input: unknown) => Promise<ActionResult<T>>;
  enqueue: (entry: OutboxEntry) => boolean;
  online: boolean;
  /** True only for genuine creations; an edit is sent or refused, never queued. */
  allowQueue: boolean;
}): Promise<QueueResult<T>> {
  const queue = (): QueueResult<T> => {
    const entry: OutboxEntry = {
      id,
      kind,
      boatId,
      label,
      queuedAt: new Date().toISOString(),
      values,
    };
    return enqueue(entry) ? { status: "queued" } : { status: "full" };
  };
  const offline = (): QueueResult<T> =>
    allowQueue ? queue() : { status: "refused", error: "errors.offline" };

  if (!online) return offline();

  try {
    const result = await action(values);
    if (result.ok) return { status: "sent", data: result.data };
    return { status: "refused", error: result.error };
  } catch (error) {
    if (isNetworkFailure(error)) return offline();
    // Anything else — a Server Action that threw, a deploy in the middle of the request — is a
    // refusal, not an exception to rethrow. Thrown from inside the caller's `startTransition`,
    // it reaches the error boundary, which unmounts the form and takes the whole intervention
    // typed into it with it (rule 13: jamais de saisie perdue). Refused, the caller shows the
    // sentence, keeps every field, and the person taps « Enregistrer » again.
    console.error("submitOrQueue: unexpected failure", error);
    return { status: "refused", error: "errors.unknown" };
  }
}
