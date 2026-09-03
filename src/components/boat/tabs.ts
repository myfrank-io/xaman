/**
 * Tabs of the boat screen, in a module of their own **without** `"use client"`.
 *
 * A Server Component may import a component from a client module, but not a plain value: at
 * build time every other export of that module becomes a client-reference proxy, so the array
 * arrives as an object and `BOAT_TABS.includes(...)` throws in production while it works in
 * development. Shared constants therefore live outside the client boundary.
 */
export type BoatTab = "engines" | "equipment";

/**
 * The identity left the strip (D37): it is the heading of the screen, always visible above
 * the tabs, so the tabs carry only the two lists people come for.
 */
export const BOAT_TABS: BoatTab[] = ["engines", "equipment"];

export function isBoatTab(value: string | null | undefined): value is BoatTab {
  return (BOAT_TABS as readonly string[]).includes(value ?? "");
}
