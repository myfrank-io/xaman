"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Guards a dirty form: `leave(fn)` runs `fn` at once when nothing changed, otherwise opens the
 * discard dialog and runs it only after confirmation. Closing the tab asks the browser's own
 * question. The browser back button is not intercepted (the App Router owns popstate); the
 * session draft (`useDraft`) is what protects that path.
 */
export function useUnsavedGuard(isDirty: boolean) {
  const [open, setOpen] = useState(false);
  const pending = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const leave = useCallback(
    (action: () => void) => {
      if (!isDirty) {
        action();
        return;
      }
      pending.current = action;
      setOpen(true);
    },
    [isDirty],
  );

  const discard = useCallback(() => {
    setOpen(false);
    const action = pending.current;
    pending.current = null;
    action?.();
  }, []);

  const stay = useCallback(() => {
    setOpen(false);
    pending.current = null;
  }, []);

  return { open, leave, discard, stay };
}
