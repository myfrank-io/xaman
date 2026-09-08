"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

const PREFIX = "xaman.last.";
const CHANGE_EVENT = "xaman:last-used";

function storageKey(boatId: string, key: string): string {
  return `${PREFIX}${boatId}.${key}`;
}

function readRaw(storage: string): string | null {
  try {
    return localStorage.getItem(storage);
  } catch {
    return null;
  }
}

/**
 * The last value someone chose in a form, on this device, for this boat — read synchronously.
 * Returns `null` on the server and whenever storage is unavailable, so a default computed from
 * it must always have a fallback. Safe to call from a lazy `useState` initialiser in a component
 * that only mounts after hydration (a dialog opened by a tap); a server-rendered form should go
 * through `useLastUsed`, which hydrates to what the server sent and fills in right after.
 */
export function readLastUsed<T>(boatId: string, key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = readRaw(storageKey(boatId, key));
  if (raw === null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeLastUsed<T>(boatId: string, key: string, value: T | null): void {
  if (typeof window === "undefined") return;
  const storage = storageKey(boatId, key);
  try {
    if (value === null || value === undefined || value === "") {
      localStorage.removeItem(storage);
    } else {
      localStorage.setItem(storage, JSON.stringify(value));
    }
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: storage }));
  } catch {
    // quota or private mode: the form simply starts blank next time
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/**
 * « The app knows me » (D95): a small per-boat memory of what a person last picked — the
 * category of an intervention, who did the work, the yard, the supplier, the price of a gas
 * bottle — so the next form opens on the likely answer and the tap that confirmed it goes away.
 *
 * Kept in `localStorage`, per boat, never sent anywhere: it is a convenience for this device,
 * not data. The server snapshot is `null` (a server-rendered form hydrates to what the server
 * sent, then fills in); `remember` writes the value back — call it on a successful save, never
 * on every keystroke, so an abandoned form does not teach the app a wrong habit.
 */
export function useLastUsed<T>(boatId: string, key: string) {
  const storage = storageKey(boatId, key);
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(storage),
    () => null,
  );
  const value = useMemo<T | null>(() => {
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }, [raw]);

  const remember = useCallback((next: T | null) => writeLastUsed(boatId, key, next), [boatId, key]);

  return { value, remember };
}
