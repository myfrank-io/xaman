import { describe, expect, it, vi } from "vitest";

import { submitOrQueue } from "@/components/forms/submit-or-queue";
import { type OutboxEntry } from "@/lib/outbox";

const BOAT = "0406f409-ac58-4ec4-af7e-ef8e1261ec54";
const ID = "5f1d0b2e-1f4a-4c2e-9a3b-6d2c8f0a1b23";

function harness(over: Partial<Parameters<typeof submitOrQueue>[0]> = {}) {
  const queued: OutboxEntry[] = [];
  const params = {
    kind: "log" as const,
    boatId: BOAT,
    id: ID,
    label: "Vidange moteur bâbord",
    values: { id: ID, boatId: BOAT },
    action: async () => ({ ok: true as const, data: { id: ID } }),
    enqueue: (entry: OutboxEntry) => {
      queued.push(entry);
      return true;
    },
    online: true,
    allowQueue: true,
    ...over,
  };
  return { params, queued };
}

describe("submitOrQueue", () => {
  it("sends when the network answers", async () => {
    const { params, queued } = harness();
    expect(await submitOrQueue(params)).toEqual({ status: "sent", data: { id: ID } });
    expect(queued).toHaveLength(0);
  });

  it("passes on a refusal from the database", async () => {
    const { params } = harness({
      action: async () => ({ ok: false as const, error: "errors.forbidden" }),
    });
    expect(await submitOrQueue(params)).toEqual({ status: "refused", error: "errors.forbidden" });
  });

  it("queues a creation when the device is offline, refuses an edit", async () => {
    const { params, queued } = harness({ online: false });
    expect(await submitOrQueue(params)).toEqual({ status: "queued" });
    expect(queued).toHaveLength(1);
    expect(await submitOrQueue({ ...params, allowQueue: false })).toEqual({
      status: "refused",
      error: "errors.offline",
    });
  });

  it("queues a creation when the request never reached the server", async () => {
    const { params, queued } = harness({
      action: async () => {
        throw new TypeError("Failed to fetch");
      },
    });
    expect(await submitOrQueue(params)).toEqual({ status: "queued" });
    expect(queued).toHaveLength(1);
  });

  it("reports the queue full rather than losing the entry", async () => {
    const { params } = harness({ online: false, enqueue: () => false });
    expect(await submitOrQueue(params)).toEqual({ status: "full" });
  });

  // The regression this file exists for: a Server Action that throws used to be rethrown into
  // the caller's `startTransition`, where the error boundary unmounted the form — everything
  // typed lost (rule 13). It must come back as an ordinary refusal.
  it("refuses instead of rethrowing when the action throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { params, queued } = harness({
      action: async () => {
        throw new Error("An unexpected response was received from the server.");
      },
    });
    await expect(submitOrQueue(params)).resolves.toEqual({
      status: "refused",
      error: "errors.unknown",
    });
    expect(queued).toHaveLength(0);
    spy.mockRestore();
  });

  it("refuses an edit that throws too, without queueing it", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { params, queued } = harness({
      allowQueue: false,
      action: async () => {
        throw new Error("boom");
      },
    });
    await expect(submitOrQueue(params)).resolves.toEqual({
      status: "refused",
      error: "errors.unknown",
    });
    expect(queued).toHaveLength(0);
    spy.mockRestore();
  });
});
