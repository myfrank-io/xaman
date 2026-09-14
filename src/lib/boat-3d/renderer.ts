import type { BoatMesh, Camera, Projector } from "@/lib/boat-3d/scene";

/**
 * Painting the projected scene on a canvas. Everything a frame needs is precomputed here: at
 * sixty frames a second, building three hundred colour strings per frame is what turns a boat
 * that turns into a boat that stutters on an iPad.
 */
export type Palette = {
  /** The darkest end of the ramp — bottom paint, shadowed panels. */
  hull: string;
  /** The lightest end — topsides, sails, deck in full light. */
  light: string;
  /** The disc the boat floats on. */
  sea: string;
  /** The selected zone. */
  pick: string;
};

/** Steps of the colour ramp on each axis. Sixteen is past what an eye separates on a gradient. */
const STEPS = 16;

export type Ramp = {
  base: readonly string[];
  selected: readonly string[];
  sea: string;
  pick: string;
};

type Rgb = readonly [number, number, number];

const FALLBACK: Rgb = [30, 58, 95];

export function parseColour(value: string, fallback: Rgb = FALLBACK): Rgb {
  const text = value.trim();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex?.[1]) {
    const digits = hex[1];
    const full =
      digits.length === 3
        ? digits
            .split("")
            .map((d) => d + d)
            .join("")
        : digits;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(text);
  const parts = rgb?.[1]?.split(/[\s,/]+/).filter(Boolean) ?? [];
  if (parts.length >= 3) {
    const [r, g, b] = parts;
    return [Number(r) || 0, Number(g) || 0, Number(b) || 0];
  }
  return fallback;
}

function ramp(from: Rgb, to: Rgb, pick: Rgb | null): string[] {
  const out: string[] = [];
  for (let t = 0; t < STEPS; t += 1) {
    const tone = t / (STEPS - 1);
    for (let s = 0; s < STEPS; s += 1) {
      // The light never goes below 0.46: an unlit face of a white boat is grey, not black.
      const shade = 0.46 + (0.54 * s) / (STEPS - 1);
      const channels = [0, 1, 2].map((i) => {
        const base = ((from[i] ?? 0) + ((to[i] ?? 0) - (from[i] ?? 0)) * tone) * shade;
        return Math.round(pick ? base * 0.42 + (pick[i] ?? 0) * 0.58 * shade : base);
      });
      out.push(`rgb(${channels[0]},${channels[1]},${channels[2]})`);
    }
  }
  return out;
}

export function buildRamp(palette: Palette): Ramp {
  const hull = parseColour(palette.hull);
  const light = parseColour(palette.light, [255, 255, 255]);
  const pick = parseColour(palette.pick, [27, 94, 150]);
  return {
    base: ramp(hull, light, null),
    selected: ramp(hull, light, pick),
    sea: palette.sea,
    pick: palette.pick,
  };
}

function index(tone: number, shade: number): number {
  const t = Math.min(STEPS - 1, Math.max(0, Math.round(tone * (STEPS - 1))));
  const s = Math.min(STEPS - 1, Math.max(0, Math.round(((shade - 0.46) / 0.54) * (STEPS - 1))));
  return t * STEPS + s;
}

/** How many segments the water disc is drawn from. */
const SEA_SEGMENTS = 28;

export function drawScene(
  ctx: CanvasRenderingContext2D,
  mesh: BoatMesh,
  projector: Projector,
  camera: Camera,
  o: { ramp: Ramp; selected: number | null },
): void {
  ctx.clearRect(0, 0, camera.width, camera.height);

  // The water, drawn first so the whole boat sits on it. It is scenery, never a target —
  // nothing here is clickable, the mesh alone answers a tap. An ellipse the shape of the boat
  // rather than a disc the size of its diagonal, which would read as a puddle around it.
  const halfBeam = mesh.footprint.x * 1.38;
  const halfLength = mesh.footprint.z * 1.1;
  ctx.beginPath();
  for (let i = 0; i < SEA_SEGMENTS; i += 1) {
    const a = (i / SEA_SEGMENTS) * Math.PI * 2;
    const point = projector.projectPoint(
      [Math.cos(a) * halfBeam, 0, Math.sin(a) * halfLength],
      camera,
    );
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
  ctx.fillStyle = o.ramp.sea;
  ctx.fill();

  const { faces } = mesh;
  for (const f of projector.order) {
    const face = faces[f];
    if (!face) continue;
    const colour = (
      o.selected !== null && face.part === o.selected ? o.ramp.selected : o.ramp.base
    )[index(face.tone, projector.shade[f] ?? 0.7)];
    if (!colour) continue;
    ctx.beginPath();
    let first = true;
    for (const i of face.indices) {
      const x = projector.x[i] ?? 0;
      const y = projector.y[i] ?? 0;
      if (first) {
        ctx.moveTo(x, y);
        first = false;
      } else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colour;
    // Stroked in its own colour: adjacent quads share an edge, and without it the antialiasing
    // leaves a hairline of background between every pair of them.
    ctx.strokeStyle = colour;
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
  }
}
