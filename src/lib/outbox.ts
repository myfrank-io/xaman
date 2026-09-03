/**
 * Offline outbox (E9-1b, D25): creations typed while the boat has no link are kept on the
 * device and re-sent **on demand**, never in the background. The scope is deliberately narrow:
 *
 *   * creations only — an edit replayed later could overwrite someone else's change;
 *   * 20 entries at most — past that the person is not offline for a moment, they are working
 *     without a network and must be told, not silently accumulating;
 *   * manual re-send — nothing leaves the device without a tap, so a wrong line can be dropped.
 *
 * Every entry carries the row id drawn when the form opened, so replaying an entry that did
 * reach the server is a no-op: the Server Actions upsert on that id (rule 11).
 */

/** Creation forms that may be queued. The key selects the Server Action on replay. */
export const OUTBOX_KINDS = ["log", "purchase", "part", "completion"] as const;
export type OutboxKind = (typeof OUTBOX_KINDS)[number];

export type OutboxEntry = {
  /** Row id drawn by the form: replaying is idempotent on it. */
  id: string;
  kind: OutboxKind;
  boatId: string;
  /** What the person sees in the list — never the raw payload. */
  label: string;
  /** ISO timestamp of the moment it was queued. */
  queuedAt: string;
  /** Validated Server Action input, as sent when online. */
  values: unknown;
  /** Error of the last failed re-send, shown next to the line. */
  error?: string;
};

export const OUTBOX_LIMIT = 20;
export const OUTBOX_KEY_PREFIX = "xaman.outbox.";

export function outboxKey(boatId: string): string {
  return `${OUTBOX_KEY_PREFIX}${boatId}`;
}

/** Oldest first: re-sending replays them in the order they were typed. */
export function sortOutbox(entries: readonly OutboxEntry[]): OutboxEntry[] {
  return [...entries].sort(
    (a, b) => a.queuedAt.localeCompare(b.queuedAt) || a.id.localeCompare(b.id),
  );
}

export function isFull(entries: readonly OutboxEntry[]): boolean {
  return entries.length >= OUTBOX_LIMIT;
}

/**
 * Add or replace an entry. Same id = the same form saved twice offline: the last values win,
 * and the queue does not grow. Returns null when the queue is full and the entry is new.
 */
export function addEntry(
  entries: readonly OutboxEntry[],
  entry: OutboxEntry,
): OutboxEntry[] | null {
  const known = entries.some((row) => row.id === entry.id);
  if (!known && isFull(entries)) return null;
  const next = known
    ? entries.map((row) => (row.id === entry.id ? entry : row))
    : [...entries, entry];
  return sortOutbox(next);
}

export function removeEntry(entries: readonly OutboxEntry[], id: string): OutboxEntry[] {
  return entries.filter((row) => row.id !== id);
}

export function markError(
  entries: readonly OutboxEntry[],
  id: string,
  error: string | undefined,
): OutboxEntry[] {
  return entries.map((row) => (row.id === id ? { ...row, error } : row));
}

/** Defensive read: a corrupted or foreign value must never break a screen. */
export function parseOutbox(raw: string | null): OutboxEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return sortOutbox(parsed.filter(isEntry)).slice(0, OUTBOX_LIMIT);
  } catch {
    return [];
  }
}

function isEntry(value: unknown): value is OutboxEntry {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.boatId === "string" &&
    typeof row.label === "string" &&
    typeof row.queuedAt === "string" &&
    typeof row.kind === "string" &&
    (OUTBOX_KINDS as readonly string[]).includes(row.kind)
  );
}

/**
 * A failure that means « the request never reached the server ». Only those are queued: a
 * refusal by the database (forbidden, conflict, invalid) is a real answer and must be shown.
 */
export function isNetworkFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true; // fetch() rejects with TypeError when offline
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|network|load failed|connexion|offline/i.test(message);
}
