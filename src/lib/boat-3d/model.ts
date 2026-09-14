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
 * Stations of a hull, bow-fine and full aft, as fractions: `t` runs from the transom (0) to the
 * stem (1), the rest scales the half-beam at the waterline, the depth of the canoe body, the
 * half-beam at deck level and the sheer height.
 */
type Station = {
  /** 0 at the transom, 1 at the stem. */
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

const STATIONS: readonly Station[] = [
  { t: 0.0, width: 0.74, keel: 0.46, deck: 0.68, sheer: 0.88 },
  { t: 0.08, width: 0.9, keel: 0.76, deck: 0.82, sheer: 0.87 },
  { t: 0.22, width: 0.99, keel: 0.93, deck: 0.89, sheer: 0.87 },
  { t: 0.4, width: 1.0, keel: 1.0, deck: 0.9, sheer: 0.9 },
  { t: 0.58, width: 0.93, keel: 0.97, deck: 0.85, sheer: 0.95 },
  { t: 0.74, width: 0.74, keel: 0.84, deck: 0.68, sheer: 1.02 },
  { t: 0.86, width: 0.5, keel: 0.63, deck: 0.46, sheer: 1.1 },
  { t: 0.95, width: 0.24, keel: 0.35, deck: 0.22, sheer: 1.18 },
  { t: 1.0, width: 0.04, keel: 0.08, deck: 0.04, sheer: 1.26 },
];

/** How many sections a hull is lofted from: thirteen reads as a curve and costs sixty faces. */
const SECTIONS = 13;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(a: Vec3, b: Vec3, t: number): Vec3 {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

function station(t: number): Omit<Station, "t"> {
  const u = clamp(t, 0, 1);
  let previous = STATIONS[0] ?? { t: 0, width: 1, keel: 1, deck: 1, sheer: 1 };
  for (const next of STATIONS) {
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
      appendage: "daggerboards",
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
    appendage: sail ? "keel" : "none",
    tubes: shape.type === "rib",
  };
}

/** One lofted hull: five strakes between each pair of sections, plus a transom. */
function addHull(
  b: MeshBuilder,
  part: number,
  o: { x: number; halfBeam: number; depth: number; deck: number; length: number },
): void {
  // Bottom dark, topsides white, deck between: the waterline is drawn by the tones, not a line.
  const TONES = [0.34, 0.95, 0.7, 0.95, 0.34];
  let previous: number[] | null = null;
  let transom: number[] | null = null;
  for (let i = 0; i < SECTIONS; i += 1) {
    const t = i / (SECTIONS - 1);
    const s = station(t);
    const z = -o.length / 2 + t * o.length;
    const width = o.halfBeam * s.width;
    const deckWidth = o.halfBeam * s.deck;
    const keelY = -o.depth * s.keel;
    const sheerY = o.deck * s.sheer;
    const bilgeY = keelY + (sheerY - keelY) * 0.34;
    // Around the section, and back to the keel: the ring the strakes are skinned between.
    const ring = [
      b.vertex(o.x, keelY, z),
      b.vertex(o.x - width, bilgeY, z),
      b.vertex(o.x - deckWidth, sheerY, z),
      b.vertex(o.x + deckWidth, sheerY, z),
      b.vertex(o.x + width, bilgeY, z),
    ];
    const closed = [...ring, ring[0] ?? 0];
    if (previous) {
      for (let k = 0; k < TONES.length; k += 1) {
        b.strip(part, previous.slice(k, k + 2), closed.slice(k, k + 2), TONES[k] ?? 0.7);
      }
    } else {
      transom = ring;
    }
    previous = closed;
  }
  if (transom) b.face(part, transom, 0.52);
}

/** A triangular sail, cambered so it reads as cloth rather than as a cardboard cut-out. */
function addSail(
  b: MeshBuilder,
  part: number,
  o: { tack: Vec3; head: Vec3; clew: Vec3; camber: number },
): void {
  const span = 5;
  const chord = 3;
  let previous: number[] | null = null;
  for (let i = 0; i <= span; i += 1) {
    const u = i / span;
    const luff = mix(o.tack, o.head, u);
    const leech = mix(o.clew, o.head, u);
    const row: number[] = [];
    for (let j = 0; j <= chord; j += 1) {
      const v = j / chord;
      const point = mix(luff, leech, v);
      const belly = o.camber * Math.sin(Math.PI * v) * Math.sin(Math.PI * Math.pow(u, 0.8));
      row.push(b.vertex(point[0] + belly, point[1], point[2]));
    }
    if (previous) b.strip(part, previous, row, 0.98);
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
    if (previous) b.strip(part, previous, closed, 0.74);
    previous = closed;
    top = ring;
  }
  b.face(part, top, 0.9);
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
  b.strip(part, [...top, top[0] ?? 0], [...bottom, bottom[0] ?? 0], 0.56);
  b.face(part, bottom, 0.38);
}

/**
 * Builds the whole boat. Order matters only for readability — the painter sorts the faces every
 * frame, so nothing here depends on being added first.
 */
export function buildBoatMesh(shape: BoatShape): BoatMesh {
  const p = planFor(shape);
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
    });
  }
  if (p.bridgedeck) {
    // The nacelle: a raised floor between the hulls, clear of the water, ending at the forebeam.
    const bottom = deck * 0.34;
    const aft = -L * 0.45;
    const forward = L * 0.28;
    b.box(hulls, [inner, bottom, aft], [outer, deck, forward], 0.72);
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
        0.88,
      );
    }
  }

  /* ---- superstructure ------------------------------------------------------------------ */
  const roofHeight = L * (p.bridgedeck ? 0.072 : 0.06);
  const roofHalf = halfDeck * (p.bridgedeck ? 0.72 : 0.78);
  const roofTop = deck + roofHeight;
  const coachroof = b.part("coachroof", [0, roofTop + L * 0.015, -L * 0.04]);
  b.box(coachroof, [-roofHalf, deck, -L * 0.22], [roofHalf, roofTop, L * 0.1], 0.86);
  // Window band: the same part, a darker tone. It is what makes the box a deckhouse.
  for (const side of [-1, 1]) {
    const x = side * roofHalf * 1.005;
    b.quad(
      coachroof,
      b.vertex(x, deck + roofHeight * 0.42, -L * 0.19),
      b.vertex(x, deck + roofHeight * 0.42, L * 0.07),
      b.vertex(x, deck + roofHeight * 0.78, L * 0.06),
      b.vertex(x, deck + roofHeight * 0.78, -L * 0.18),
      0.12,
    );
  }
  // Solar panels lie on the roof: flat plates, a shade darker than the deck they sit on.
  for (const side of [-1, 1]) {
    b.quad(
      coachroof,
      b.vertex(side * roofHalf * 0.16, roofTop + 0.02, -L * 0.19),
      b.vertex(side * roofHalf * 0.9, roofTop + 0.02, -L * 0.19),
      b.vertex(side * roofHalf * 0.9, roofTop + 0.02, L * 0.02),
      b.vertex(side * roofHalf * 0.16, roofTop + 0.02, L * 0.02),
      0.2,
    );
  }

  const cockpit = b.part("cockpit", [0, deck + L * 0.03, -L * 0.33]);
  const cockpitAft = p.bridgedeck ? -L * 0.44 : -L * 0.42;
  b.quad(
    cockpit,
    b.vertex(-roofHalf, deck + 0.02, cockpitAft),
    b.vertex(roofHalf, deck + 0.02, cockpitAft),
    b.vertex(roofHalf, deck + 0.02, -L * 0.22),
    b.vertex(-roofHalf, deck + 0.02, -L * 0.22),
    0.64,
  );
  // Helm station to starboard, and the cockpit table on the centreline.
  b.box(
    cockpit,
    [roofHalf * 0.42, deck, -L * 0.3],
    [roofHalf * 0.86, deck + L * 0.035, -L * 0.24],
    0.8,
  );
  b.box(
    cockpit,
    [-roofHalf * 0.5, deck, -L * 0.4],
    [roofHalf * 0.2, deck + L * 0.022, -L * 0.32],
    0.76,
  );

  // The liferaft: the one piece of safety gear that is a place aboard rather than a locker.
  const safety = b.part("safety", [roofHalf * 0.8, deck + L * 0.05, -L * 0.2]);
  b.box(
    safety,
    [roofHalf * 0.5, deck + 0.02, -L * 0.21],
    [roofHalf * 0.95, deck + L * 0.032, -L * 0.15],
    0.54,
  );

  // Systems live below: their handle on deck is the engine-room hatch, on the port side.
  const systems = b.part("systems", [inner, deck + 0.05, -L * 0.12]);
  b.quad(
    systems,
    b.vertex(inner - p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.18),
    b.vertex(inner + p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.18),
    b.vertex(inner + p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.06),
    b.vertex(inner - p.hullHalfBeam * 0.5, deck + 0.03, -L * 0.06),
    0.42,
  );

  /* ---- foredeck: beam, trampoline, bowsprit ------------------------------------------- */
  if (p.bridgedeck) {
    const beamZ = L * 0.3;
    const crossbeam = b.part("crossbeam", [0, deck + L * 0.012, beamZ]);
    b.box(
      crossbeam,
      [inner, deck - L * 0.01, beamZ - L * 0.02],
      [outer, deck + L * 0.025, beamZ + L * 0.02],
      0.6,
    );

    // The trampoline is drawn as strips: a filled panel would read as a deck, and it is a net.
    const tramp = b.part("trampoline", [0, deck, L * 0.38]);
    const strips = 6;
    for (let i = 0; i < strips; i += 1) {
      const a = inner + ((outer - inner) * i) / strips;
      const w = ((outer - inner) / strips) * 0.62;
      b.quad(
        tramp,
        b.vertex(a, deck, beamZ + L * 0.02),
        b.vertex(a + w, deck, beamZ + L * 0.02),
        b.vertex(a + w * 0.7, deck + L * 0.01, L * 0.46),
        b.vertex(a + w * 0.1, deck + L * 0.01, L * 0.46),
        0.5,
      );
    }
  }

  const bowZ = L * (p.bridgedeck ? 0.47 : 0.46);
  const bow = b.part("bow", [0, deck + L * 0.02, bowZ + L * 0.04]);
  b.box(
    bow,
    [-L * 0.012, deck + L * 0.005, bowZ],
    [L * 0.012, deck + L * 0.03, bowZ + L * 0.1],
    0.82,
  );
  // Windlass and anchor, at the tip: the pair everyone looks for first on a foredeck.
  b.box(bow, [-L * 0.02, deck, bowZ - L * 0.04], [L * 0.02, deck + L * 0.022, bowZ], 0.66);
  b.box(
    bow,
    [-L * 0.018, deck - L * 0.015, bowZ + L * 0.09],
    [L * 0.018, deck + L * 0.012, bowZ + L * 0.12],
    0.4,
  );

  /* ---- rig ----------------------------------------------------------------------------- */
  if (p.rig) {
    const mastZ = L * (p.bridgedeck ? 0.08 : 0.06);
    const mastBase = p.bridgedeck ? roofTop : deck;
    const mastTop = mastBase + L * 1.22;
    const mast = b.part("mast", [0, mastBase + (mastTop - mastBase) * 0.55, mastZ]);
    addSpar(b, mast, {
      x: 0,
      z: mastZ,
      y0: mastBase,
      y1: mastTop,
      halfX: L * 0.009,
      halfZ: L * 0.016,
      taper: 0.55,
    });

    const boomY = mastBase + L * 0.075;
    const boomAft = mastZ - L * 0.42;
    const mainsail = b.part("mainsail", [
      L * 0.03,
      mastBase + (mastTop - mastBase) * 0.4,
      mastZ - L * 0.16,
    ]);
    b.box(
      mainsail,
      [-L * 0.008, boomY - L * 0.012, boomAft],
      [L * 0.008, boomY + L * 0.012, mastZ],
      0.7,
    );
    addSail(b, mainsail, {
      tack: [0, boomY + L * 0.014, mastZ - L * 0.01],
      head: [0, mastTop - L * 0.02, mastZ - L * 0.005],
      clew: [0, boomY + L * 0.02, boomAft + L * 0.01],
      camber: L * 0.035,
    });

    const headsail = b.part("headsail", [
      L * 0.02,
      mastBase + (mastTop - mastBase) * 0.38,
      L * 0.26,
    ]);
    addSail(b, headsail, {
      tack: [0, deck + L * 0.03, bowZ + L * 0.09],
      head: [0, mastBase + (mastTop - mastBase) * 0.95, mastZ + L * 0.01],
      clew: [0, deck + L * 0.09, mastZ + L * 0.08],
      camber: L * 0.03,
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
      0.44,
    );
  }

  const rudders = b.part("rudders", [inner, -p.hullDepth - p.draft * 0.25, -L * 0.39]);
  for (const hull of p.hulls) {
    if (hull.scale !== 1) continue;
    addFoil(b, rudders, {
      x: hull.x,
      z: -L * 0.39,
      top: -p.hullDepth * 0.45,
      bottom: -p.hullDepth - p.draft * 0.55,
      chord: L * 0.045,
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
    b.box(part, [x - L * 0.012, bottom, z - L * 0.018], [x + L * 0.012, top, z + L * 0.018], 0.5);
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
      0.36,
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
