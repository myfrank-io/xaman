"use client";

import * as React from "react";

/**
 * `navigator.onLine` alone lies on a degraded Starlink link: the modem answers
 * but nothing gets through. Three consecutive request failures therefore count
 * as « offline » too (ux-flows §5.4).
 */
const FAILURE_THRESHOLD = 3;

type OnlineState = {
  online: boolean;
  /** Browser-level flag, before the failure counter is applied. */
  navigatorOnline: boolean;
  failures: number;
  reportFailure: () => void;
  reportSuccess: () => void;
};

export function useOnline(): OnlineState {
  // Server render and first paint assume online: an offline banner that flashes
  // on every load would train people to ignore it.
  const [navigatorOnline, setNavigatorOnline] = React.useState(true);
  const [failures, setFailures] = React.useState(0);

  React.useEffect(() => {
    const sync = () => {
      const up = navigator.onLine;
      setNavigatorOnline(up);
      // Back online: forget the failure counter, the stale queries are refetched.
      if (up) setFailures(0);
    };
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const reportFailure = React.useCallback(() => setFailures((n) => n + 1), []);
  const reportSuccess = React.useCallback(() => setFailures(0), []);

  return {
    online: navigatorOnline && failures < FAILURE_THRESHOLD,
    navigatorOnline,
    failures,
    reportFailure,
    reportSuccess,
  };
}
