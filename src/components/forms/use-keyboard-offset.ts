"use client";

import { useEffect, useState } from "react";

/**
 * Height the on-screen keyboard hides at the bottom of the window, in pixels.
 *
 * On iPad the LAYOUT viewport does not shrink when the keyboard opens, only the VISUAL one: a
 * `position: sticky; bottom: 0` action bar stays where it was and ends up under the keys — the
 * number one defect of web forms on iPad. Every sticky bar that sits under a screenful of
 * inputs adds this offset to its `bottom`.
 *
 * SSR-safe: the measurement only happens in the effect, so the first render is 0 on the server
 * and on a browser without `visualViewport` (which never traps the bar anyway, its layout
 * viewport shrinks). Both listeners are removed on unmount.
 */
export function useKeyboardOffset(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => {
      setOffset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return offset;
}
