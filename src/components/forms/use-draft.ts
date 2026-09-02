"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const PREFIX = "xaman.draft.";
const DEBOUNCE_MS = 500;

/**
 * Session draft of a form (ux-flows §4.8): every change is written to `sessionStorage` under
 * `xaman.draft.<route>` after 500 ms. Reopening an empty form that has a draft shows
 * « Brouillon récupéré · Reprendre / Supprimer » — the browser back button is not intercepted,
 * so this is what protects a half-typed intervention.
 *
 * The draft is read once at mount: nothing is restored behind the user's back.
 */
export function useDraft<T>(route: string, enabled = true) {
  const key = `${PREFIX}${route}`;
  const [found, setFound] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dismissed = useRef(false);

  // Read after mount, never during render: `sessionStorage` does not exist on the server and a
  // value read at hydration time would not match what the server sent.
  useEffect(() => {
    if (!enabled) return;
    function load() {
      try {
        const raw = sessionStorage.getItem(key);
        if (raw) setFound(JSON.parse(raw) as T);
      } catch {
        // private mode or corrupted value: a draft is a convenience, never a blocker
      }
    }
    load();
  }, [key, enabled]);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    dismissed.current = true;
    setFound(null);
    try {
      sessionStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  const save = useCallback(
    (values: T) => {
      if (!enabled) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        try {
          sessionStorage.setItem(key, JSON.stringify(values));
        } catch {
          // quota or private mode: the form still holds the values
        }
      }, DEBOUNCE_MS);
    },
    [key, enabled],
  );

  const dismiss = useCallback(() => {
    dismissed.current = true;
    setFound(null);
  }, []);

  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  return { draft: found, save, clear, dismiss };
}
