import { NO_FEATURES, type BoatFeatures } from "@/lib/boat-3d/features";
import { MeshBuilder, type BoatMesh, type Vec3 } from "@/lib/boat-3d/scene";
import { engineZone, type ZoneKey } from "@/lib/boat-3d/zones";
import type { Database } from "@/types/database";

type BoatType = Database["public"]["Enums"]["boat_type"];
type EnginePosition = Database["public"]["Enums"]["engine_position"];

export type BoatShape = {
  type: BoatType;
  /** Hors-tout, in metres. Null is normal: the carnet does not require the dimensions. */
  lengthM: number | null;
  beamM: number | null;
  draftM: number | null;
  engines: readonly { id: string; position: EnginePosition }[];
  /** What the carnet's own inventory says this boat carries (`readFeatures`). */
  features?: BoatFeatures;
};

/**
 * The boat, as a mesh. Not a scan of Xaman — a **parametric hull** whose proportions come from
 * the carnet (type, length, beam, draft) and whose parts carry the zones. It is a diagram you
 * can turn, not a plan: it has to be recognisable from the pontoon and correct about what is
 * where, not about a millimetre.
 *
 * Dimensions are often null (`boats.length_m` is optional, `boat_models` leaves an unconfirmed
 * figure null on purpose). A typical boat of the type is then drawn, and the zones are the same
 * either way — the model never pretends to know a hull it was not given.
 */
const DEFAULTS: Record<BoatType, { length: number; beam: number; draft: number }> = {
  catamaran: { length: 15, beam: 7.9, draft: 1.2 },
  trimaran: { length: 15, beam: 11, draft: 1.2 },
  monohull_sail: { length: 12, beam: 3.9, draft: 1.9 },
  motor: { length: 11, beam: 3.6, draft: 0.9 },
  rib: { length: 6.5, beam: 2.5, draft: 0.5 },
  other: { length: 11, beam: 3.6, draft: 1 },
};

/**
 * Stations of a hull: `t` runs from the tip of the aft skirt (0) to the stem (1).
 *
 * These are the proportions of a modern performance catamaran, which is what the carnet's own
 * boat is — an ORC 50, whose inventory names « jupes de flotteur allongées » and « safrans
 * suspendus ». So the hull leaves the water in a long sloping skirt aft rather than a transom,
 * and the stem is plumb: the keel line stays deep almost to the bow instead of sweeping up.
 */
type Station = {
  /** 0 at the tip of the skirt, 1 at the stem. */
  t: number;
  /** Half-beam at the waterline, as a fraction of the hull's own half-beam. */
  width: number;
  /** Depth of the canoe body, as a fraction of the hull's depth. */
  keel: number;
  /** Half-beam at deck level. */
  deck: number;
  /** Sheer height, as a fraction of the freeboard: it rises toward the bow. */
  sheer: number;
};

/** A hull that ends in a long sloping skirt — « jupes de flotteur allongées » on the carnet. */
const SKIRTED: readonly Station[] = [
  { t: 0.0, width: 0.36, keel: 0.04, deck: 0.33, sheer: 0.4 },
  { t: 0.06, width: 0.72, keel: 0.4, deck: 0.68, sheer: 0.66 },
  { t: 0.13, width: 0.9, keel: 0.76, deck: 0.85, sheer: 0.85 },
  { t: 0.3, width: 0.99, keel: 0.94, deck: 0.92, sheer: 0.87 },
  { t: 0.45, width: 1.0, keel: 1.0, deck: 0.92, sheer: 0.89 },
  { t: 0.6, width: 0.95, keel: 0.99, deck: 0.87, sheer: 0.94 },
  { t: 0.74, width: 0.8, keel: 0.94, deck: 0.73, sheer: 1.01 },
  { t: 0.85, width: 0.58, keel: 0.86, deck: 0.52, sheer: 1.1 },
  // Plumb stem: full depth almost to the end, then a hair of rake.
  { t: 0.93, width: 0.34, keel: 0.74, deck: 0.3, sheer: 1.2 },
  { t: 0.98, width: 0.14, keel: 0.52, deck: 0.12, sheer: 1.29 },
  { t: 1.0, width: 0.04, keel: 0.14, deck: 0.04, sheer: 1.34 },
];

/** A hull that stops at its transom. */
const TRANSOM: readonly Station[] = [
  { t: 0.0, width: 0.86, keel: 0.62, deck: 0.82, sheer: 0.88 },
  { t: 0.12, width: 0.95, keel: 0.86, deck: 0.9, sheer: 0.87 },
  { t: 0.3, width: 1.0, keel: 0.97, deck: 0.93, sheer: 0.87 },
  { t: 0.45, width: 1.0, keel: 1.0, deck: 0.92, sheer: 0.89 },
  { t: 0.6, width: 0.94, keel: 0.98, deck: 0.86, sheer: 0.94 },
  { t: 0.74, width: 0.78, keel: 0.92, deck: 0.71, sheer: 1.01 },
  { t: 0.85, width: 0.56, keel: 0.82, deck: 0.5, sheer: 1.1 },
  { t: 0.93, width: 0.32, keel: 0.66, deck: 0.28, sheer: 1.19 },
  { t: 0.98, width: 0.13, keel: 0.42, deck: 0.11, sheer: 1.27 },
  { t: 1.0, width: 0.04, keel: 0.1, deck: 0.04, sheer: 1.32 },
];

/** How many sections a hull is lofted from: enough for the sheer to read as a curve. */
const SECTIONS = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function station(table: readonly Station[], t: number): Omit<Station, "t"> {
  const u = clamp(t, 0, 1);
  let previous = table[0] ?? { t: 0, width: 1, keel: 1, deck: 1, sheer: 1 };
  for (const next of table) {
    if (next.t < u) {
      previous = next;
      continue;
    }
    const span = next.t - previous.t;
    const k = span > 0 ? (u - previous.t) / span : 0;
    return {
      width: lerp(previous.width, next.width, k),
      keel: lerp(previous.keel, next.keel, k),
      deck: lerp(previous.deck, next.deck, k),
      sheer: lerp(previous.sheer, next.sheer, k),
    };
  }
  return previous;
}

/** Everything the builder needs, once the type and the dimensions have been reconciled. */
type Plan = {
  length: number;
  beam: number;
  draft: number;
  /** Centre and relative size of each hull. One for a monohull, two for a cat, three for a tri. */
  hulls: readonly { x: number; scale: number }[];
  hullHalfBeam: number;
  hullDepth: number;
  /** Deck level above the waterline. */
  deck: number;
  bridgedeck: boolean;
  rig: boolean;
  appendage: "daggerboards" | "keel" | "none";
  tubes: boolean;
};

function planFor(shape: BoatShape): Plan {
  const base = DEFAULTS[shape.type] ?? DEFAULTS.other;
  const length = clamp(shape.lengthM ?? base.length, 3, 40);
  // A beam is only believed inside what a hull can be: a typo (« 70 m ») must not draw a raft.
  const beam = clamp(shape.beamM ?? (base.beam * length) / base.length, length * 0.12, length);
  const draft = clamp(shape.draftM ?? (base.draft * length) / base.length, 0.15, length * 0.45);
  const multihull = shape.type === "catamaran" || shape.type === "trimaran";

  if (multihull) {
    const hullHalfBeam = Math.min(length * 0.038, beam * 0.14);
    const offset = beam / 2 - hullHalfBeam;
    const hulls =
      shape.type === "trimaran"
        ? [
            { x: -offset, scale: 0.58 },
            { x: 0, scale: 1 },
            { x: offset, scale: 0.58 },
          ]
        : [
            { x: -offset, scale: 1 },
            { x: offset, scale: 1 },
          ];
    return {
      length,
      beam,
      draft,
      hulls,
      hullHalfBeam,
      hullDepth: length * 0.055,
      deck: length * 0.075,
      bridgedeck: true,
      rig: true,
      // Boards because the carnet says there are boards, not because it is a catamaran.
      appendage: shape.features?.daggerboards ? "daggerboards" : "none",
      tubes: false,
    };
  }

  const sail = shape.type === "monohull_sail";
  return {
    length,
    beam,
    draft,
    hulls: [{ x: 0, scale: 1 }],
    hullHalfBeam: beam / 2,
    hullDepth: length * (sail ? 0.075 : 0.06),
    deck: length * (sail ? 0.085 : 0.09),
    bridgedeck: false,
    rig: sail,
    appendage: shape.features?.daggerboards ? "daggerboards" : sail ? "keel" : "none",
    tubes: shape.type === "rib",
  };
}

/**
 * One lofted hull. Seven points to a section rather than five, so the waterline can be drawn
 * where it belongs — as a boot stripe between the bottom paint and the topsides. A hull without
 * one reads as a slab; with one it reads as a boat, and it costs two quads a station.
 */
function addHull(
  b: MeshBuilder,
  part: number,
  o: {
    x: number;
    halfBeam: number;
    depth: number;
    deck: number;
    length: number;
    stations: readonly Station[];
  },
): void {
  // Bottom, boot stripe, topsides, deck, and back down the other side.
  const STRAKES = ["bottom", "boot", "hull", "deck", "hull", "boot", "bottom"] as const;
  // The waterline is flat, so the top of the stripe is a constant height whatever the station.
  const boot = o.deck * 0.06;
  let previous: number[] | null = null;
  let transom: number[] | null = null;
  for (let i = 0; i < SECTIONS; i += 1) {
    const t = i / (SECTIONS - 1);
    const s = station(o.stations, t);
    const z = -o.length / 2 + t * o.length;
    const width = o.halfBeam * s.width;
    const deckWidth = o.halfBeam * s.deck;
    const keelY = -o.depth * s.keel;
    const sheerY = o.deck * s.sheer;
    // The widest point sits a hand's breadth under the waterline, and closes on the keel at
    // the ends of the hull, so the stripe narrows to nothing at the stem and at the skirt.
    const bilgeY = -o.depth * 0.16 * s.keel;
    const ring = [
      b.vertex(o.x, keelY, z),
      b.vertex(o.x - width, bilgeY, z),
      b.vertex(o.x - width * 0.99, boot, z),
      b.vertex(o.x - deckWidth, sheerY, z),
      b.vertex(o.x + deckWidth, sheerY, z),
      b.vertex(o.x + width * 0.99, boot, z),
      b.vertex(o.x + width, bilgeY, z),
    ];
    const closed = [...ring, ring[0] ?? 0];
    if (previous) {
      for (let k = 0; k < STRAKES.length; k += 1) {
        b.strip(part, previous.slice(k, k + 2), closed.slice(k, k + 2), STRAKES[k] ?? "hull");
      }
    } else {
      transom = ring;
    }
    previous = closed;
  }
  if (transom) b.face(part, transom, "hull", 0.78);
}

/**
 * A sail. Not a triangle: the mainsail of a boat like this one has a **square top** — a head a
 * metre and a half wide — and a **roach**, a leech that bows outward well past the straight line
 * from clew to head. Those two are the whole silhouette of a modern rig; drawn as a triangle the
 * boat could be any sailing boat of the last hundred years.
 */
function addSail(
  b: MeshBuilder,
  part: number,
  o: {
    tack: Vec3;
    head: Vec3;
    clew: Vec3;
    /** Belly, across the sail, in metres. */
    camber: number;
    /** Width of the head, along the leech, in metres. 0 = a pointed head. */
    headWidth?: number;
    /** How far the leech bows out past the straight line, in metres. */
    roach?: number;
  },
): void {
  const span = 6;
  const chord = 3;
  // The leech runs aft of the luff: its direction is clew minus tack, flattened.
  const aft: Vec3 = [o.clew[0] - o.tack[0], 0, o.clew[2] - o.tack[2]];
  const aftLength = Math.hypot(aft[0], aft[2]) || 1;
  const unit: Vec3 = [aft[0] / aftLength, 0, aft[2] / aftLength];
  const headAft: Vec3 = [
    o.head[0] + unit[0] * (o.headWidth ?? 0),
    o.head[1],
    o.head[2] + unit[2] * (o.headWidth ?? 0),
  ];
  let previous: number[] | null = null;
  for (let i = 0; i <= span; i += 1) {
    const u = i / span;
    const luff = mix(o.tack, o.head, u);
    const straight = mix(o.clew, headAft, u);
    const bow = (o.roach ?? 0) * Math.sin(Math.PI * Math.pow(u, 0.85));
    const leech: Vec3 = [straight[0] + unit[0] * bow, straight[1], straight[2] + unit[2] * bow];
    const row: number[] = [];
    for (let j = 0; j <= chord; j += 1) {
      const v = j / chord;
      const point = mix(luff, leech, v);
      const belly = o.camber * Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.pow(u, 0.8));
      row.push(b.vertex(point[0] + belly, point[1], point[2]));
    }
    // The cloth darkens a little toward the foot, the way a sail does against the sky.
    if (previous) b.strip(part, previous, row, "sail", 0.9 + 0.1 * u);
    previous = row;
  }
}

/** A tapered four-sided spar: the mast, and nothing else needs one. */
function addSpar(
  b: MeshBuilder,
  part: number,
  o: { x: number; z: number; y0: number; y1: number; halfX: number; halfZ: number; taper: number },
): void {
  const steps = 3;
  let previous: number[] | null = null;
  let top: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const k = lerp(1, o.taper, t);
    const y = lerp(o.y0, o.y1, t);
    const hx = o.halfX * k;
    const hz = o.halfZ * k;
    const ring = [
      b.vertex(o.x - hx, y, o.z - hz),
      b.vertex(o.x + hx, y, o.z - hz),
      b.vertex(o.x + hx, y, o.z + hz),
      b.vertex(o.x - hx, y, o.z + hz),
    ];
    const closed = [...ring, ring[0] ?? 0];
    if (previous) b.strip(part, previous, closed, "carbon");
    previous = closed;
    top = ring;
  }
  b.face(part, top, "carbon");
}

/** A foil — daggerboard, rudder blade, keel fin: a thin tapered plate hanging under a hull. */
function addFoil(
  b: MeshBuilder,
  part: number,
  o: { x: number; z: number; top: number; bottom: number; chord: number; thickness: number },
): void {
  const tipChord = o.chord * 0.62;
  const half = o.thickness / 2;
  // The tip rakes aft, as a blade does once it is down.
  const rake = o.chord * 0.18;
  const top = [
    b.vertex(o.x - half, o.top, o.z - o.chord / 2),
    b.vertex(o.x + half, o.top, o.z - o.chord / 2),
    b.vertex(o.x + half, o.top, o.z + o.chord / 2),
    b.vertex(o.x - half, o.top, o.z + o.chord / 2),
  ];
  const bottom = [
    b.vertex(o.x - half * 0.6, o.bottom, o.z - tipChord / 2 - rake),
    b.vertex(o.x + half * 0.6, o.bottom, o.z - tipChord / 2 - rake),
    b.vertex(o.x + half * 0.6, o.bottom, o.z + tipChord / 2 - rake),
    b.vertex(o.x - half * 0.6, o.bottom, o.z + tipChord / 2 - rake),
  ];
  b.strip(part, [...top, top[0] ?? 0], [...bottom, bottom[0] ?? 0], "foil");
  b.face(part, bottom, "foil", 0.72);
}

/**
 * Builds the whole boat. Order matters only for readability — the painter sorts the faces every
 * frame, so nothing here depends on being added first.
 */
export function buildBoatMesh(shape: BoatShape): BoatMesh {
  const p = planFor(shape);
  const f = shape.features ?? NO_FEATURES;
  const b = new MeshBuilder();
  const L = p.length;
  const deck = p.deck;
  const outer = Math.max(...p.hulls.map((hull) => hull.x));
  const inner = Math.min(...p.hulls.map((hull) => hull.x));
  const halfDeck = p.bridgedeck ? p.beam / 2 : p.hullHalfBeam;

  /* ---- hulls, and the bridgedeck that joins them --------------------------------------- */
  const hulls = b.part("hulls", [inner - p.hullHalfBeam * 0.4, deck * 0.35, -L * 0.05]);
  for (const hull of p.hulls) {
    addHull(b, hulls, {
      x: hull.x,
      halfBeam: p.hullHalfBeam * hull.scale,
      depth: p.hullDepth * hull.scale,
      deck: deck * lerp(0.82, 1, hull.scale),
      length: L * lerp(0.82, 1, hull.scale),
      stations: f.skirts ? SKIRTED : TRANSOM,
    });
  }
  if (p.bridgedeck) {
    // The nacelle: a raised floor between the hulls, clear of the water, ending at the forebeam.
    const bottom = deck * 0.34;
    const aft = -L * 0.45;
    const forward = L * 0.28;
    b.box(hulls, [inner, bottom, aft], [outer, deck, forward], "deck");
  }
  if (p.tubes) {
    // A semi-rigid is read by its tubes: two long rolls along the sheer.
    for (const side of [-1, 1]) {
      const inner = side * p.hullHalfBeam * 0.7;
      const outer = side * p.hullHalfBeam;
      b.box(
        hulls,
        [Math.min(inner, outer), deck * 0.5, -L * 0.46],
        [Math.max(inner, outer), deck * 1.15, L * 0.4],
        "hull",
      );
    }
  }

  /* ---- superstructure ------------------------------------------------------------------ */
  // Low and wedge-shaped, not a box. The ORC 50's carbon roof is barely more than half a metre
  // proud of the deck — it is what the boat is known for, and a charter-cat flybridge on it
  // would make every catamaran in the app look like the same catamaran.
  const roofHeight = L * (p.bridgedeck ? 0.038 : 0.05);
  const roofHalf = halfDeck * (p.bridgedeck ? 0.6 : 0.76);
  const roofTop = deck + roofHeight;
  const roofAft = -L * 0.26;
  const roofFwd = L * 0.07;
  const coachroof = b.part("coachroof", [0, roofTop + L * 0.01, -L * 0.08]);
  // Raked front: the top edge stops short of the bottom one, which is the whole wedge.
  const roofSill = deck + roofHeight * 0.3;
  for (const side of [-1, 1]) {
    const x = side * roofHalf;
    const inb = side * roofHalf * 0.94;
    // Side: coaming below, glass above.
    b.quad(
      coachroof,
      b.vertex(x, deck, roofAft),
      b.vertex(x, deck, roofFwd),
      b.vertex(x, roofSill, roofFwd),
      b.vertex(x, roofSill, roofAft),
      "roof",
      0.92,
    );
    b.quad(
      coachroof,
      b.vertex(x, roofSill, roofAft),
      b.vertex(x, roofSill, roofFwd),
      b.vertex(inb, roofTop, roofFwd - L * 0.03),
      b.vertex(inb, roofTop, roofAft),
      "glass",
    );
  }
  // Windscreen and after bulkhead.
  b.quad(
    coachroof,
    b.vertex(-roofHalf, deck, roofFwd),
    b.vertex(roofHalf, deck, roofFwd),
    b.vertex(roofHalf * 0.94, roofTop, roofFwd - L * 0.03),
    b.vertex(-roofHalf * 0.94, roofTop, roofFwd - L * 0.03),
    "glass",
  );
  b.quad(
    coachroof,
    b.vertex(-roofHalf, deck, roofAft),
    b.vertex(roofHalf, deck, roofAft),
    b.vertex(roofHalf * 0.94, roofTop, roofAft),
    b.vertex(-roofHalf * 0.94, roofTop, roofAft),
    "roof",
    0.8,
  );
  b.quad(
    coachroof,
    b.vertex(-roofHalf * 0.94, roofTop, roofAft),
    b.vertex(roofHalf * 0.94, roofTop, roofAft),
    b.vertex(roofHalf * 0.94, roofTop, roofFwd - L * 0.03),
    b.vertex(-roofHalf * 0.94, roofTop, roofFwd - L * 0.03),
    "roof",
  );

  const cockpitAft = p.bridgedeck ? -L * 0.42 : -L * 0.42;
  const cockpit = b.part("cockpit", [0, deck + L * 0.04, -L * 0.34]);
  b.quad(
    cockpit,
    b.vertex(-roofHalf, deck + 0.02, cockpitAft),
    b.vertex(roofHalf, deck + 0.02, cockpitAft),
    b.vertex(roofHalf, deck + 0.02, roofAft),
    b.vertex(-roofHalf, deck + 0.02, roofAft),
    "sole",
  );
  if (p.bridgedeck) {
    // Two helms, one outboard on each hull: on this boat you steer from the side deck, looking
    // up at the mainsail, not from a saloon.
    for (const side of [-1, 1]) {
      const x = side * halfDeck * 0.82;
      b.box(
        cockpit,
        [Math.min(x, x - side * L * 0.022), deck, -L * 0.34],
        [Math.max(x, x - side * L * 0.022), deck + L * 0.03, -L * 0.29],
        "deck",
      );
      // The wheel: a plate on edge, which is enough to read as one at this size.
      b.quad(
        cockpit,
        b.vertex(x - side * L * 0.011, deck + L * 0.03, -L * 0.325),
        b.vertex(x - side * L * 0.011, deck + L * 0.03, -L * 0.295),
        b.vertex(x - side * L * 0.011, deck + L * 0.058, -L * 0.3),
        b.vertex(x - side * L * 0.011, deck + L * 0.058, -L * 0.32),
        "carbon",
      );
    }
  } else {
    b.box(
      cockpit,
      [roofHalf * 0.42, deck, -L * 0.3],
      [roofHalf * 0.86, deck + L * 0.035, -L * 0.24],
      "deck",
    );
  }

  // The liferaft: the one piece of safety gear that is a place aboard rather than a locker.
  if (f.liferaft) {
    const safety = b.part("safety", [roofHalf * 0.86, deck + L * 0.05, -L * 0.22]);
    b.box(
      safety,
      [roofHalf * 0.52, deck + 0.02, -L * 0.24],
      [roofHalf * 0.98, deck + L * 0.03, -L * 0.18],
      "deck",
    );
  }
  // A dome on the after edge of the roof: the carnet names Starlink and a B&G pack.
  if (f.dome) {
    b.box(
      coachroof,
      [-roofHalf * 0.18, roofTop, roofAft + L * 0.01],
      [roofHalf * 0.18, roofTop + L * 0.018, roofAft + L * 0.05],
      "metal",
    );
  }

  // Systems live below: their handle on deck is the engine-room hatch, on the port side.
  const systems = b.part("systems", [inner, deck + 0.05, -L * 0.14]);
  b.quad(
    systems,
    b.vertex(inner - p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.2),
    b.vertex(inner + p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.2),
    b.vertex(inner + p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.08),
    b.vertex(inner - p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.08),
    "sole",
  );

  if (f.solar === "roof") {
    // Panels lying on the roof, when that is where the carnet says they are.
    for (const side of [-1, 1]) {
      b.quad(
        coachroof,
        b.vertex(side * roofHalf * 0.14, roofTop + 0.02, roofAft + L * 0.02),
        b.vertex(side * roofHalf * 0.86, roofTop + 0.02, roofAft + L * 0.02),
        b.vertex(side * roofHalf * 0.86, roofTop + 0.02, roofFwd - L * 0.06),
        b.vertex(side * roofHalf * 0.14, roofTop + 0.02, roofFwd - L * 0.06),
        "solar",
      );
    }
  }
  if (p.bridgedeck && f.solar === "davits") {
    // Davits across the transoms with the panels on top: « 990 W sur bossoirs » is where this
    // boat actually carries them, and a roof full of panels would be another boat's roof.
    const archZ = -L * 0.45;
    const archTop = deck + L * 0.085;
    const archHalf = halfDeck * 0.58;
    for (const side of [-1, 1]) {
      const x = side * halfDeck * 0.88;
      // A leg on each transom, raked in toward the panel it carries.
      b.quad(
        coachroof,
        b.vertex(x, deck, archZ - L * 0.008),
        b.vertex(x, deck, archZ + L * 0.008),
        b.vertex(side * archHalf, archTop, archZ + L * 0.008),
        b.vertex(side * archHalf, archTop, archZ - L * 0.008),
        "carbon",
      );
    }
    b.quad(
      coachroof,
      b.vertex(-archHalf, archTop, archZ - L * 0.035),
      b.vertex(archHalf, archTop, archZ - L * 0.035),
      b.vertex(archHalf, archTop, archZ + L * 0.03),
      b.vertex(-archHalf, archTop, archZ + L * 0.03),
      "solar",
    );
  }

  /* ---- foredeck: beam, trampoline, bowsprit ------------------------------------------- */
  if (p.bridgedeck) {
    const beamZ = L * 0.3;
    const crossbeam = b.part("crossbeam", [0, deck + L * 0.012, beamZ]);
    b.box(
      crossbeam,
      [inner, deck - L * 0.012, beamZ - L * 0.018],
      [outer, deck + L * 0.022, beamZ + L * 0.018],
      "hull",
    );

    // The trampoline is part of the boat, not of its inventory — nobody writes « trampoline »
    // on a list of equipment, and every catamaran has one between the beam and the bows. Drawn
    // as strips: a filled panel would read as a deck, and it is a net.
    {
      const tramp = b.part("trampoline", [0, deck, L * 0.38]);
      const strips = 5;
      for (let i = 0; i < strips; i += 1) {
        const a = inner + ((outer - inner) * i) / strips;
        const w = ((outer - inner) / strips) * 0.88;
        b.quad(
          tramp,
          b.vertex(a, deck, beamZ + L * 0.02),
          b.vertex(a + w, deck, beamZ + L * 0.02),
          b.vertex(a + w * 0.76, deck + L * 0.012, L * 0.46),
          b.vertex(a + w * 0.1, deck + L * 0.012, L * 0.46),
          "tramp",
        );
      }
    }
  }

  const bowZ = L * (p.bridgedeck ? 0.47 : 0.46);
  // A long carbon bowsprit: the Code 0 and the spinnakers all tack out there.
  const spritTip = bowZ + (f.bowsprit ? L * 0.16 : 0);
  const bowKit = f.bowsprit || f.anchor || f.windlass;
  const bow = bowKit ? b.part("bow", [0, deck + L * 0.02, bowZ + L * 0.06]) : null;
  if (bow !== null) {
    if (f.bowsprit) {
      b.box(
        bow,
        [-L * 0.011, deck + L * 0.004, bowZ],
        [L * 0.011, deck + L * 0.026, spritTip],
        "carbon",
      );
    }
    if (f.windlass) {
      b.box(
        bow,
        [-L * 0.019, deck, bowZ - L * 0.05],
        [L * 0.019, deck + L * 0.02, bowZ - L * 0.01],
        "metal",
      );
    }
    if (f.anchor) {
      // At the tip of the sprit when there is one, on the stemhead when there is not.
      const at = f.bowsprit ? spritTip : bowZ;
      b.box(
        bow,
        [-L * 0.016, deck - L * 0.016, at - L * 0.025],
        [L * 0.016, deck + L * 0.01, at],
        "metal",
      );
    }
  }

  /* ---- rig ----------------------------------------------------------------------------- */
  if (p.rig) {
    const mastZ = L * (p.bridgedeck ? 0.06 : 0.06);
    const mastBase = p.bridgedeck ? roofTop : deck;
    const mastTop = mastBase + L * 1.24;
    const mast = b.part("mast", [0, mastBase + (mastTop - mastBase) * 0.55, mastZ]);
    addSpar(b, mast, {
      x: 0,
      z: mastZ,
      y0: mastBase,
      y1: mastTop,
      halfX: L * 0.008,
      halfZ: L * 0.015,
      taper: 0.5,
    });

    // A winch at the foot of the mast, on the side the carnet names.
    if (f.mastWinch) {
      const side = f.mastWinch === "port" ? -1 : 1;
      b.box(
        mast,
        [Math.min(side * L * 0.016, side * L * 0.03), mastBase, mastZ - L * 0.012],
        [Math.max(side * L * 0.016, side * L * 0.03), mastBase + L * 0.016, mastZ + L * 0.012],
        "metal",
      );
    }

    const boomY = mastBase + L * 0.055;
    const luff = mastTop - L * 0.015 - (boomY + L * 0.013);
    // 88 m² of Hydranet: the foot follows from the area and the luff, so a boat whose carnet
    // records a bigger mainsail gets a bigger mainsail. The factor is what a square top with a
    // roach actually measures against the triangle its corners describe.
    const foot = clamp(
      f.mainsailArea !== null ? f.mainsailArea / (0.62 * luff) : L * 0.4,
      L * 0.28,
      L * 0.6,
    );
    const boomAft = mastZ - foot;
    const mainsail = b.part("mainsail", [
      L * 0.03,
      mastBase + (mastTop - mastBase) * 0.42,
      mastZ - foot * 0.45,
    ]);
    b.box(
      mainsail,
      [-L * 0.007, boomY - L * 0.011, boomAft],
      [L * 0.007, boomY + L * 0.011, mastZ],
      "carbon",
    );
    addSail(b, mainsail, {
      tack: [0, boomY + L * 0.013, mastZ - L * 0.01],
      head: [0, mastTop - L * 0.015, mastZ - L * 0.005],
      clew: [0, boomY + L * 0.018, boomAft + L * 0.012],
      camber: L * 0.03,
      // A square top: a head a fifth of the foot wide, and a roach carrying the rest of the area.
      headWidth: foot * 0.2,
      roach: foot * 0.21,
    });

    // The headsail tacks on the sprit when there is one, on the stemhead when there is not.
    const jibTackZ = f.bowsprit ? spritTip - L * 0.02 : bowZ;
    const jibTackY = deck + L * 0.028;
    const jibHeadY = mastBase + (mastTop - mastBase) * 0.93;
    const jibLuff = Math.hypot(jibHeadY - jibTackY, jibTackZ - mastZ);
    const jibFoot = clamp(
      f.headsailArea !== null ? (2.3 * f.headsailArea) / jibLuff : L * 0.42,
      L * 0.24,
      L * 0.62,
    );
    const headsail = b.part("headsail", [
      L * 0.02,
      mastBase + (mastTop - mastBase) * 0.36,
      jibTackZ - jibFoot * 0.45,
    ]);
    addSail(b, headsail, {
      tack: [0, jibTackY, jibTackZ],
      head: [0, jibHeadY, mastZ + L * 0.01],
      clew: [0, deck + L * 0.085, jibTackZ - jibFoot],
      camber: L * 0.028,
      roach: L * 0.012,
    });
  }

  /* ---- appendages ---------------------------------------------------------------------- */
  if (p.appendage === "daggerboards") {
    const boards = b.part("daggerboards", [inner, -p.draft * 0.6, L * 0.12]);
    const carriers = p.hulls.filter((hull) => hull.scale === 1);
    for (const hull of carriers) {
      addFoil(b, boards, {
        x: hull.x,
        z: L * 0.12,
        top: -p.hullDepth * 0.5,
        bottom: -p.draft,
        chord: L * 0.055,
        thickness: L * 0.008,
      });
    }
  }
  if (p.appendage === "keel") {
    const keel = b.part("daggerboards", [0, -p.draft * 0.6, -L * 0.02]);
    addFoil(b, keel, {
      x: 0,
      z: -L * 0.02,
      top: -p.hullDepth * 0.6,
      bottom: -p.draft,
      chord: L * 0.16,
      thickness: L * 0.02,
    });
    // The bulb: what carries the lead on a modern fin.
    b.box(
      keel,
      [-L * 0.014, -p.draft, -L * 0.09],
      [L * 0.014, -p.draft + L * 0.022, L * 0.06],
      "foil",
    );
  }

  // « Safrans suspendus » on the carnet: on this boat the blades hang off the transoms, stock
  // and all, instead of disappearing under the hull. It is visible from the pontoon, so it is
  // visible here.
  const transomHung = f.transomRudders;
  const rudderZ = transomHung ? -L * 0.41 : -L * 0.39;
  const rudders = b.part("rudders", [
    inner,
    transomHung ? deck * 0.2 : -p.hullDepth - p.draft * 0.25,
    rudderZ,
  ]);
  for (const hull of p.hulls) {
    if (hull.scale !== 1) continue;
    addFoil(b, rudders, {
      x: hull.x,
      z: rudderZ,
      top: transomHung ? p.deck * 0.55 : -p.hullDepth * 0.45,
      bottom: -p.hullDepth - p.draft * 0.5,
      chord: L * 0.042,
      thickness: L * 0.007,
    });
  }

  /* ---- engines: one zone each, placed by their position ------------------------------- */
  for (const engine of shape.engines) {
    const x = engineX(engine.position, p);
    const outboard = engine.position === "outboard";
    const z = outboard ? -L * 0.47 : -L * 0.2;
    const top = outboard ? deck + L * 0.02 : -p.hullDepth * 0.5;
    const bottom = outboard ? -p.hullDepth * 0.9 : -p.hullDepth - L * 0.035;
    const part = b.part(engineZone(engine.id), [x, (top + bottom) / 2, z]);
    b.box(
      part,
      [x - L * 0.012, bottom, z - L * 0.018],
      [x + L * 0.012, top, z + L * 0.018],
      "foil",
    );
    // The propeller: a small disc on edge, so a saildrive is read as a drive and not as a fin.
    const blade = L * 0.022;
    b.face(
      part,
      [
        b.vertex(x - L * 0.002, bottom + blade * 0.3, z - blade),
        b.vertex(x + L * 0.002, bottom + blade * 1.3, z - blade * 0.3),
        b.vertex(x - L * 0.002, bottom + blade * 1.3, z + blade * 0.6),
        b.vertex(x + L * 0.002, bottom + blade * 0.3, z + blade * 0.3),
      ],
      "metal",
      0.8,
    );
  }

  return b.build();
}

function engineX(position: EnginePosition, plan: Plan): number {
  const outer = Math.max(...plan.hulls.map((hull) => hull.x));
  const inner = Math.min(...plan.hulls.map((hull) => hull.x));
  if (position === "port") return inner;
  if (position === "starboard") return outer;
  return 0;
}

/** The zones this mesh actually carries — what the routing is allowed to choose from. */
export function meshZones(mesh: BoatMesh): Set<ZoneKey> {
  return new Set(mesh.parts.map((part) => part.zone));
}
