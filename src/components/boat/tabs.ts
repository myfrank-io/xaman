/**
 * Tabs of the boat screen, in a module of their own **without** `"use client"`.
 *
 * A Server Component may import a component from a client module, but not a plain value: at
 * build time every other export of that module becomes a client-reference proxy, so the array
 * arrives as an object and `BOAT_TABS.includes(...)` throws in production while it works in
 * development. Shared constants therefore live outside the client boundary.
 */
export type BoatTab = "identity" | "engines" | "equipment";

export const BOAT_TABS: BoatTab[] = ["identity", "engines", "equipment"];

export function isBoatTab(value: string | null | undefined): value is BoatTab {
  return (BOAT_TABS as readonly string[]).includes(value ?? "");
}
