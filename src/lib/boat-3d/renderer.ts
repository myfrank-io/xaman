import type { BoatMesh, Camera, Material, Projector } from "@/lib/boat-3d/scene";

/**
 * Painting the projected scene on a canvas. Everything a frame needs is precomputed here: at
 * sixty frames a second, building six hundred colour strings per frame is what turns a boat that
 * turns into a boat that stutters on an iPad.
 */
export const MATERIALS = [
  "hull",
  "bottom",
  "boot",
  "deck",
  "sole",
  "roof",
  "glass",
  "sail",
  "carbon",
  "solar",
  "tramp",
  "metal",
  "foil",
] as const satisfies readonly Material[];

/** One CSS custom property per material, plus the water and the selection. */
export type Palette = Record<Material, string> & {
  /** The shadow the boat sits on. */
  sea: string;
  /** The selected zone. */
  pick: string;
  /** The ground behind the boat: lighter under it, deeper at the edges. */
  backdrop: string;
  backdropEdge: string;
};

/** Steps of the light ramp. Sixteen is past what an eye separates on a gradient. */
const STEPS = 16;
/** How far below full light the ambient occlusion is allowed to push a face. */
const DEEPEST = 0.34;

/**
 * How much of the light each material actually shows. Cloth is translucent — the shaded side of
 * a sail is lit through it, so a sail that goes as dark as a hull side reads as cardboard.
 * Glass and solar are near-black already and have nowhere to go.
 */
const CONTRAST: Record<Material, number> = {
  hull: 0.4,
  bottom: 0.46,
  boot: 0.4,
  deck: 0.44,
  sole: 0.46,
  roof: 0.4,
  glass: 0.3,
  sail: 0.16,
  carbon: 0.46,
  solar: 0.28,
  tramp: 0.24,
  metal: 0.44,
  foil: 0.46,
};

export type Ramp = {
  /** `material -> STEPS` colours, darkest first. */
  base: Record<Material, readonly string[]>;
  selected: Record<Material, readonly string[]>;
  /** A lighter wash under the pointer: the mouse equivalent of a finger hovering. */
  hovered: Record<Material, readonly string[]>;
  sea: string;
  seaFaded: string;
  seaClear: string;
  pick: string;
  backdrop: string;
  backdropEdge: string;
};

type Rgb = readonly [number, number, number];

const FALLBACK: Rgb = [200, 205, 212];

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

function ramp(colour: Rgb, contrast: number, pick: Rgb | null, mix = 0.66): string[] {
  const out: string[] = [];
  for (let i = 0; i < STEPS; i += 1) {
    const light = 1 - contrast + (contrast * i) / (STEPS - 1);
    const channels = [0, 1, 2].map((c) => {
      const base = (colour[c] ?? 0) * light;
      // The chosen zone keeps its own shading and takes the pick's hue over it.
      return Math.round(
        Math.min(255, pick ? base * (1 - mix) + (pick[c] ?? 0) * light * (mix + 0.06) : base),
      );
    });
    out.push(`rgb(${channels[0] ?? 0},${channels[1] ?? 0},${channels[2] ?? 0})`);
  }
  return out;
}

export function buildRamp(palette: Palette): Ramp {
  const pick = parseColour(palette.pick, [27, 94, 150]);
  const base = {} as Record<Material, readonly string[]>;
  const selected = {} as Record<Material, readonly string[]>;
  const hovered = {} as Record<Material, readonly string[]>;
  for (const material of MATERIALS) {
    const colour = parseColour(palette[material]);
    const contrast = CONTRAST[material];
    base[material] = ramp(colour, contrast, null);
    selected[material] = ramp(colour, contrast, pick);
    hovered[material] = ramp(colour, contrast, pick, 0.19);
  }
  const [r, g, b] = parseColour(palette.sea, [214, 224, 234]);
  return {
    base,
    selected,
    hovered,
    sea: `rgba(${r},${g},${b},0.8)`,
    seaFaded: `rgba(${r},${g},${b},0.4)`,
    seaClear: `rgba(${r},${g},${b},0)`,
    pick: palette.pick,
    backdrop: palette.backdrop,
    backdropEdge: palette.backdropEdge,
  };
}

/** Where a face lands on its material's ramp: the light it caught, times its own occlusion. */
function step(light: number, shade: number): number {
  const value = (light * shade - DEEPEST) / (1 - DEEPEST);
  return Math.min(STEPS - 1, Math.max(0, Math.round(value * (STEPS - 1))));
}

/** How many segments the water is drawn from. */
const SEA_SEGMENTS = 28;

export function drawScene(
  ctx: CanvasRenderingContext2D,
  mesh: BoatMesh,
  projector: Projector,
  camera: Camera,
  o: { ramp: Ramp; selected: number | null; hovered: number | null },
): void {
  ctx.clearRect(0, 0, camera.width, camera.height);

  // A studio ground: light where the boat is, deeper at the edges. A white hull on the app's own
  // off-white surface has nothing to be white against — this is what gives it an edge.
  const groundX = camera.width / 2;
  const groundY = camera.height * 0.46;
  const ground = ctx.createRadialGradient(
    groundX,
    groundY,
    0,
    groundX,
    groundY,
    Math.max(camera.width, camera.height) * 0.72,
  );
  ground.addColorStop(0, o.ramp.backdrop);
  ground.addColorStop(1, o.ramp.backdropEdge);
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, camera.width, camera.height);

  // The water, drawn first so the whole boat sits on it. Scenery, never a target — nothing here
  // is clickable, the mesh alone answers a tap. An ellipse the shape of the boat rather than a
  // disc the size of its diagonal, faded at the rim so it reads as shadow and not as a puddle.
  const halfBeam = mesh.footprint.x * 1.45;
  const halfLength = mesh.footprint.z * 1.12;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  ctx.beginPath();
  for (let i = 0; i < SEA_SEGMENTS; i += 1) {
    const a = (i / SEA_SEGMENTS) * Math.PI * 2;
    const point = projector.projectPoint(
      [Math.cos(a) * halfBeam, 0, Math.sin(a) * halfLength],
      camera,
    );
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }
  ctx.closePath();
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const spread = Math.max((maxX - minX) / 2, 1);
  const shadow = ctx.createRadialGradient(cx, cy, spread * 0.12, cx, cy, spread);
  shadow.addColorStop(0, o.ramp.sea);
  shadow.addColorStop(0.6, o.ramp.seaFaded);
  shadow.addColorStop(1, o.ramp.seaClear);
  ctx.fillStyle = shadow;
  ctx.fill();

  const { faces } = mesh;
  ctx.lineWidth = 1;
  ctx.lineJoin = "round";
  for (const f of projector.order) {
    const face = faces[f];
    if (!face) continue;
    const table =
      o.selected !== null && face.part === o.selected
        ? o.ramp.selected
        : o.hovered !== null && face.part === o.hovered
          ? o.ramp.hovered
          : o.ramp.base;
    const colour = table[face.material][step(projector.shade[f] ?? 0.82, face.shade)];
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
    ctx.fill();
    ctx.stroke();
  }
}
