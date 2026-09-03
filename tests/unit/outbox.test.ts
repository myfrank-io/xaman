import { describe, expect, it } from "vitest";

import {
  addEntry,
  isFull,
  isNetworkFailure,
  markError,
  outboxKey,
  OUTBOX_LIMIT,
  parseOutbox,
  removeEntry,
  sortOutbox,
  type OutboxEntry,
} from "@/lib/outbox";

const BOAT = "0406f409-ac58-4ec4-af7e-ef8e1261ec54";

function entry(id: string, queuedAt: string, over: Partial<OutboxEntry> = {}): OutboxEntry {
  return {
    id,
    kind: "log",
    boatId: BOAT,
    label: `Intervention ${id}`,
    queuedAt,
    values: { id, boatId: BOAT },
    ...over,
  };
}

describe("outbox queue", () => {
  it("keys the queue per boat", () => {
    expect(outboxKey(BOAT)).toBe(`xaman.outbox.${BOAT}`);
  });

  it("keeps the oldest first so a re-send replays what was typed first", () => {
    const rows = [entry("b", "2026-09-02T10:00:00Z"), entry("a", "2026-09-02T08:00:00Z")];
    expect(sortOutbox(rows).map((row) => row.id)).toEqual(["a", "b"]);
  });

  it("adds an entry and reports the queue full at the limit", () => {
    let rows: OutboxEntry[] = [];
    for (let i = 0; i < OUTBOX_LIMIT; i += 1) {
      const next = addEntry(
        rows,
        entry(`id-${i}`, `2026-09-02T10:${String(i).padStart(2, "0")}:00Z`),
      );
      expect(next).not.toBeNull();
      rows = next as OutboxEntry[];
    }
    expect(isFull(rows)).toBe(true);
    expect(addEntry(rows, entry("one-too-many", "2026-09-02T11:00:00Z"))).toBeNull();
  });

  it("replaces an entry with the same id instead of growing, even when full", () => {
    const rows = Array.from({ length: OUTBOX_LIMIT }, (_, i) =>
      entry(`id-${i}`, `2026-09-02T10:${String(i).padStart(2, "0")}:00Z`),
    );
    const next = addEntry(rows, entry("id-3", "2026-09-02T12:00:00Z", { label: "Corrigée" }));
    expect(next).toHaveLength(OUTBOX_LIMIT);
    expect(next?.find((row) => row.id === "id-3")?.label).toBe("Corrigée");
  });

  it("removes an entry and records the error of a failed re-send", () => {
    const rows = [entry("a", "2026-09-02T08:00:00Z"), entry("b", "2026-09-02T09:00:00Z")];
    expect(removeEntry(rows, "a").map((row) => row.id)).toEqual(["b"]);
    expect(markError(rows, "b", "errors.forbidden")[1]?.error).toBe("errors.forbidden");
    expect(markError(markError(rows, "b", "x"), "b", undefined)[1]?.error).toBeUndefined();
  });
});

describe("parseOutbox", () => {
  it("returns an empty queue for missing, invalid or foreign values", () => {
    expect(parseOutbox(null)).toEqual([]);
    expect(parseOutbox("not json")).toEqual([]);
    expect(parseOutbox('{"id":"a"}')).toEqual([]);
    expect(parseOutbox('[{"id":"a"}]')).toEqual([]);
    expect(
      parseOutbox('[{"id":"a","kind":"unknown","boatId":"b","label":"l","queuedAt":"t"}]'),
    ).toEqual([]);
  });

  it("keeps well-formed entries, sorted and capped", () => {
    const rows = JSON.stringify([
      entry("b", "2026-09-02T10:00:00Z"),
      entry("a", "2026-09-02T08:00:00Z"),
    ]);
    expect(parseOutbox(rows).map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("isNetworkFailure", () => {
  it("recognises a request that never reached the server", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure(new Error("NetworkError when attempting to fetch resource"))).toBe(
      true,
    );
    expect(isNetworkFailure(new Error("Load failed"))).toBe(true);
  });

  it("does not swallow a real answer from the database", () => {
    expect(isNetworkFailure(new Error("row-level security"))).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});
