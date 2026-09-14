import { meshZones } from "@/lib/boat-3d/model";
import type { BoatMesh } from "@/lib/boat-3d/scene";
import {
  engineIdOf,
  engineZone,
  zoneForEquipment,
  zoneForItem,
  type HullZone,
  type ZoneKey,
} from "@/lib/boat-3d/zones";
import type { ChecklistState } from "@/lib/checklist-status";

/**
 * What the model has to say about each place of the boat: what is aboard there, and what is due
 * on it. Pure, and tested on its own — the routing of a line to a place is the part of this
 * screen that can be quietly wrong, and a wrong place is worse than no place at all.
 */
export type ZonePoint = {
  id: string;
  label: string;
  /** Where the point is listed in the app: its system screen. */
  categoryId: string | null;
  state: ChecklistState;
  daysRemaining: number | null;
  hoursRemaining: number | null;
  /** false when the linked engine has no hour meter (D73). */
  hasCounter: boolean;
  engineLabel: string | null;
};

export type ZoneThing = {
  id: string;
  name: string;
  /** « Lorima · 24 m », or nothing. */
  meta: string | null;
};

export type ZoneSummary = {
  key: ZoneKey;
  /** `boat3d.zones.<labelKey>` for a place of the hull; null for an engine, which is named. */
  labelKey: HullZone | "keel" | null;
  /** The engine's own label — « Moteur BB » — when the zone is an engine. */
  name: string | null;
  things: ZoneThing[];
  points: ZonePoint[];
  overdue: number;
  soon: number;
  /** The worst state of the zone's points, or null when it has none. */
  state: ChecklistState | null;
};

/** The order the list walks the boat in: rig, then deck, then hull, then what is under water. */
const ORDER: readonly HullZone[] = [
  "mast",
  "mainsail",
  "headsail",
  "bow",
  "trampoline",
  "crossbeam",
  "coachroof",
  "cockpit",
  "hulls",
  "systems",
  "safety",
  "daggerboards",
  "rudders",
];

const SEVERITY: Record<ChecklistState, number> = { ok: 0, never: 1, soon: 2, overdue: 3 };

function worst(a: ChecklistState | null, b: ChecklistState): ChecklistState {
  if (!a) return b;
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

export type SummaryInput = {
  mesh: BoatMesh;
  /** A keel is drawn where a catamaran carries daggerboards: the same zone, another word. */
  hasKeel: boolean;
  categories: readonly { id: string; externalRef: string | null }[];
  equipment: readonly {
    id: string;
    name: string;
    brand: string | null;
    model: string | null;
    quantity: number;
    categoryId: string | null;
    externalRef?: string | null;
    /** Free key/value pairs (`equipment.specs`): the model reads sail areas and fittings here. */
    specs?: Readonly<Record<string, unknown>> | null;
  }[];
  points: readonly {
    id: string;
    label: string;
    state: ChecklistState;
    daysRemaining: number | null;
    hoursRemaining: number | null;
    hasCounter: boolean;
    categoryId: string | null;
    engineId: string | null;
  }[];
  engines: readonly { id: string; label: string }[];
};

export function buildZoneSummaries(input: SummaryInput): ZoneSummary[] {
  const available = meshZones(input.mesh);
  const categoryRefs = new Map(input.categories.map((c) => [c.id, c.externalRef]));
  const summaries = new Map<ZoneKey, ZoneSummary>();

  // Every zone the mesh carries gets a row, even an empty one: « rien à signaler sur les
  // safrans » is an answer, and a place that vanishes when it is in order cannot be tapped.
  const engineNames = new Map(input.engines.map((engine) => [engine.id, engine.label]));
  for (const zone of ordered(available)) {
    const engineId = engineIdOf(zone);
    summaries.set(zone, {
      key: zone,
      labelKey: engineId
        ? null
        : zone === "daggerboards" && input.hasKeel
          ? "keel"
          : (zone as HullZone),
      name: engineId ? (engineNames.get(engineId) ?? null) : null,
      things: [],
      points: [],
      overdue: 0,
      soon: 0,
      state: null,
    });
  }

  for (const item of input.equipment) {
    const zone = zoneForEquipment(
      {
        name: item.name,
        externalRef: item.externalRef ?? null,
        categoryRef: item.categoryId ? (categoryRefs.get(item.categoryId) ?? null) : null,
      },
      available,
    );
    summaries.get(zone)?.things.push({
      id: item.id,
      name: item.name,
      meta: metaOf(item),
    });
  }

  for (const point of input.points) {
    const zone = zoneForItem(
      {
        label: point.label,
        categoryRef: point.categoryId ? (categoryRefs.get(point.categoryId) ?? null) : null,
        engineId: point.engineId,
      },
      available,
    );
    const summary = summaries.get(zone);
    if (!summary) continue;
    summary.points.push({
      id: point.id,
      label: point.label,
      categoryId: point.categoryId,
      state: point.state,
      daysRemaining: point.daysRemaining,
      hoursRemaining: point.hoursRemaining,
      hasCounter: point.hasCounter,
      engineLabel: point.engineId ? (engineNames.get(point.engineId) ?? null) : null,
    });
    if (point.state === "overdue") summary.overdue += 1;
    if (point.state === "soon") summary.soon += 1;
    summary.state = worst(summary.state, point.state);
  }

  for (const summary of summaries.values()) {
    // The worst first: a zone is opened to find what is late on it, not to read an inventory.
    summary.points.sort(
      (a, b) => SEVERITY[b.state] - SEVERITY[a.state] || a.label.localeCompare(b.label, "fr"),
    );
    summary.things.sort((a, b) => a.name.localeCompare(b.name, "fr"));
  }
  return [...summaries.values()];
}

function metaOf(item: {
  brand: string | null;
  model: string | null;
  quantity: number;
}): string | null {
  const parts = [item.brand, item.model].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Zones in walking order, engines last and in the order the carnet lists them. */
function ordered(available: ReadonlySet<ZoneKey>): ZoneKey[] {
  const hull = ORDER.filter((zone) => available.has(zone));
  const engines = [...available].filter((zone) => engineIdOf(zone) !== null);
  return [...hull, ...engines];
}

/** The zone of an engine, when the model drew one for it. */
export function zoneOfEngine(mesh: BoatMesh, engineId: string): ZoneKey | null {
  const zone = engineZone(engineId);
  return meshZones(mesh).has(zone) ? zone : null;
}
