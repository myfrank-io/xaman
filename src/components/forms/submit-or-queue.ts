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
 * Offline, nothing is attempted: the entry goes straight to the queue and the form closes as
 * if it had been saved, because for the person it has been — it is on the iPad and it is
 * listed. Online, a refusal by the database is shown as usual; only a request that never
 * reached the server falls back to the queue.
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

  if (!online) return queue();

  try {
    const result = await action(values);
    if (result.ok) return { status: "sent", data: result.data };
    return { status: "refused", error: result.error };
  } catch (error) {
    if (isNetworkFailure(error)) return queue();
    throw error;
  }
}
