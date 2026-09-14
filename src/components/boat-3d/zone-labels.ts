import type { HullZone } from "@/lib/boat-3d/zones";

/**
 * The message key of each place of the boat. Written out rather than interpolated so the
 * compiler — and `next-intl` — refuse a zone that has no French name: a zone that renders its
 * own key is exactly the kind of thing nobody sees before it is aboard.
 */
export const ZONE_LABELS = {
  mast: "zones.mast",
  mainsail: "zones.mainsail",
  headsail: "zones.headsail",
  bow: "zones.bow",
  crossbeam: "zones.crossbeam",
  trampoline: "zones.trampoline",
  coachroof: "zones.coachroof",
  cockpit: "zones.cockpit",
  hulls: "zones.hulls",
  daggerboards: "zones.daggerboards",
  keel: "zones.keel",
  rudders: "zones.rudders",
  systems: "zones.systems",
  safety: "zones.safety",
} as const satisfies Record<HullZone | "keel", string>;
