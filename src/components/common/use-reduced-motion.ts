"use client";

import * as React from "react";

/**
 * `prefers-reduced-motion`, watched. Anything that moves on its own — and a boat that turns by
 * itself is the most literal case in the app — has to stop for someone who asked the system to
 * stop things moving. The controls stay: the boat is then turned by hand.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return reduced;
}
