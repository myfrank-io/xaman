/**
 * Tabs of the boat screen, in a module of their own **without** `"use client"`.
 *
 * A Server Component may import a component from a client module, but not a plain value: at
 * build time every other export of that module becomes a client-reference proxy, so the array
 * arrives as an object and `BOAT_TABS.includes(...)` throws in production while it works in
 * development. Shared constants therefore live outside the client boundary.
 */
export type BoatTab = "equipment" | "engines";

/**
 * The identity left the strip (D37): it is the heading of the screen, always visible above
 * the tabs, so the tabs carry only the two lists people come for.
 *
 * Équipements comes first and takes the focus (D39): the boat holds thirty-six of them against
 * three engines, and the engines have their own block on the dashboard while the equipment has
 * none. Opening Bateau on three cards while the inventory hides behind a tap was backwards.
 */
export const BOAT_TABS: BoatTab[] = ["equipment", "engines"];

export function isBoatTab(value: string | null | undefined): value is BoatTab {
  return (BOAT_TABS as readonly string[]).includes(value ?? "");
}
