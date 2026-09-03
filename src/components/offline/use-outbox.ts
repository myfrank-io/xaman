"use client";

import { useCallback, useEffect, useState } from "react";

import { OUTBOX_ACTIONS } from "@/components/offline/outbox-kinds";
import {
  addEntry,
  markError,
  outboxKey,
  parseOutbox,
  removeEntry,
  type OutboxEntry,
} from "@/lib/outbox";

/** Same-tab notification: the `storage` event only fires in the other tabs. */
const CHANGED = "xaman:outbox";

function read(boatId: string): OutboxEntry[] {
  try {
    return parseOutbox(localStorage.getItem(outboxKey(boatId)));
  } catch {
    return [];
  }
}

function write(boatId: string, entries: OutboxEntry[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(outboxKey(boatId));
    else localStorage.setItem(outboxKey(boatId), JSON.stringify(entries));
  } catch {
    // private mode or quota: the queue is a convenience, it never blocks a save
  }
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: boatId }));
}

export type ResendOutcome = { sent: number; failed: number };

/**
 * The offline queue of one boat (E9-1b, D25): entries live in `localStorage`, so closing the
 * tab or the app does not lose them, and they leave only when someone taps « Tout renvoyer ».
 */
export function useOutbox(boatId: string) {
  const [entries, setEntries] = useState<OutboxEntry[]>([]);
  const [sending, setSending] = useState(false);

  // Read after mount: `localStorage` does not exist on the server, and a value read during
  // hydration would not match what was rendered.
  useEffect(() => {
    const sync = () => setEntries(read(boatId));
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGED, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGED, sync);
    };
  }, [boatId]);

  /** Returns false when the queue is full: the caller must say so rather than lose the line. */
  const enqueue = useCallback(
    (entry: OutboxEntry): boolean => {
      const next = addEntry(read(boatId), entry);
      if (!next) return false;
      write(boatId, next);
      return true;
    },
    [boatId],
  );

  const discard = useCallback(
    (id: string) => {
      write(boatId, removeEntry(read(boatId), id));
    },
    [boatId],
  );

  /**
   * Replays the queue oldest first. An entry the server accepts is dropped; one it refuses
   * keeps its error and stays, so nothing is thrown away silently. A network failure stops
   * the run: the link is down again and the rest would fail the same way.
   */
  const resendAll = useCallback(async (): Promise<ResendOutcome> => {
    setSending(true);
    let sent = 0;
    let failed = 0;
    try {
      for (const entry of read(boatId)) {
        try {
          const result = await OUTBOX_ACTIONS[entry.kind](entry.values);
          if (result.ok) {
            write(boatId, removeEntry(read(boatId), entry.id));
            sent += 1;
          } else {
            write(boatId, markError(read(boatId), entry.id, result.error));
            failed += 1;
          }
        } catch {
          // Still offline: stop, keep the rest, and let the person try again later.
          failed += 1;
          break;
        }
      }
    } finally {
      setSending(false);
    }
    return { sent, failed };
  }, [boatId]);

  return { entries, enqueue, discard, resendAll, sending };
}
