import type { ZoneKey } from "@/lib/boat-3d/zones";

/**
 * A very small 3D scene: a mesh of flat faces, an orbiting camera, and a painter that sorts
 * back to front. Two hundred faces at sixty frames a second — a library would cost half a
 * megabyte on a 4G connection at the pontoon to do exactly this (règle 10).
 *
 * Axes, in metres: **x** to starboard, **y** up, **z** toward the bow.
 */
export type Vec3 = readonly [number, number, number];

/**
 * What a face is made of. A boat is not one colour in fifteen shades of grey: it is white
 * topsides, a copper bottom, a black boot stripe, cream cloth, carbon spars and dark glass.
 * Giving each face a material rather than a lightness is what stops the drawing looking like an
 * untextured CAD viewport.
 */
export type Material =
  | "hull"
  | "bottom"
  | "boot"
  | "deck"
  | "sole"
  | "roof"
  | "glass"
  | "sail"
  | "carbon"
  | "solar"
  | "tramp"
  | "metal"
  | "foil";

export type MeshFace = {
  /** Index into `parts`: what this face belongs to, and therefore which zone it selects. */
  part: number;
  /** Indices into the vertex buffer, wound around the face. */
  indices: readonly number[];
  material: Material;
  /**
   * Local darkening, 0.55 to 1: the cheap ambient occlusion that keeps the underside of a box
   * from reading as bright as its lid even when the light says otherwise.
   */
  shade: number;
};

export type MeshPart = {
  zone: ZoneKey;
  /** Where the zone's pin is planted, in model space. */
  anchor: Vec3;
};

export type BoatMesh = {
  /** x, y, z triples, already centred on the origin. */
  vertices: Float32Array;
  faces: readonly MeshFace[];
  parts: readonly MeshPart[];
  /** Radius of the bounding sphere: what the camera frames. */
  radius: number;
  /**
   * Half-beam and half-length of what the boat covers on the water. The bounding sphere is
   * dominated by the mast — taller than the hull is long — and a single radius would be its
   * diagonal, so anything lying flat (the water it floats on) is measured here instead.
   */
  footprint: { x: number; z: number };
};

/** Builds a mesh face by face. Vertices are shared by index; nothing is de-duplicated. */
export class MeshBuilder {
  private readonly xyz: number[] = [];
  private readonly faceList: MeshFace[] = [];
  private readonly partList: MeshPart[] = [];

  part(zone: ZoneKey, anchor: Vec3): number {
    this.partList.push({ zone, anchor });
    return this.partList.length - 1;
  }

  vertex(x: number, y: number, z: number): number {
    this.xyz.push(x, y, z);
    return this.xyz.length / 3 - 1;
  }

  point(v: Vec3): number {
    return this.vertex(v[0], v[1], v[2]);
  }

  face(part: number, indices: readonly number[], material: Material, shade = 1): void {
    this.faceList.push({ part, indices, material, shade });
  }

  quad(
    part: number,
    a: number,
    b: number,
    c: number,
    d: number,
    material: Material,
    shade = 1,
  ): void {
    this.face(part, [a, b, c, d], material, shade);
  }

  /** A rectangular box, axis-aligned, six faces. The workhorse of beams, pods and legs. */
  box(part: number, min: Vec3, max: Vec3, material: Material): void {
    const [x0, y0, z0] = min;
    const [x1, y1, z1] = max;
    const aftBottomPort = this.vertex(x0, y0, z0);
    const aftBottomStb = this.vertex(x1, y0, z0);
    const aftTopStb = this.vertex(x1, y1, z0);
    const aftTopPort = this.vertex(x0, y1, z0);
    const fwdBottomPort = this.vertex(x0, y0, z1);
    const fwdBottomStb = this.vertex(x1, y0, z1);
    const fwdTopStb = this.vertex(x1, y1, z1);
    const fwdTopPort = this.vertex(x0, y1, z1);
    this.quad(part, aftBottomPort, aftBottomStb, aftTopStb, aftTopPort, material, 0.9);
    this.quad(part, fwdBottomStb, fwdBottomPort, fwdTopPort, fwdTopStb, material, 0.9);
    this.quad(part, fwdBottomPort, aftBottomPort, aftTopPort, fwdTopPort, material, 0.84);
    this.quad(part, aftBottomStb, fwdBottomStb, fwdTopStb, aftTopStb, material, 0.84);
    this.quad(part, aftTopPort, aftTopStb, fwdTopStb, fwdTopPort, material, 1);
    this.quad(part, fwdBottomPort, fwdBottomStb, aftBottomStb, aftBottomPort, material, 0.62);
  }

  /**
   * Skins two parallel rows of vertices with quads — a strake of a hull, a panel of a sail, a
   * segment of a spar. Every lofted surface of the model goes through here.
   */
  strip(
    part: number,
    a: readonly number[],
    c: readonly number[],
    material: Material,
    shade = 1,
  ): void {
    const count = Math.min(a.length, c.length) - 1;
    for (let i = 0; i < count; i += 1) {
      const a0 = a[i];
      const a1 = a[i + 1];
      const c0 = c[i];
      const c1 = c[i + 1];
      if (a0 === undefined || a1 === undefined || c0 === undefined || c1 === undefined) continue;
      this.quad(part, a0, a1, c1, c0, material, shade);
    }
  }

  build(): BoatMesh {
    const vertices = new Float32Array(this.xyz);
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i] ?? 0;
      const y = vertices[i + 1] ?? 0;
      const z = vertices[i + 2] ?? 0;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const cz = (minZ + maxZ) / 2;
    let radius = 1e-3;
    let footX = 1e-3;
    let footZ = 1e-3;

    for (let i = 0; i < vertices.length; i += 3) {
      const x = (vertices[i] ?? 0) - cx;
      const y = (vertices[i + 1] ?? 0) - cy;
      const z = (vertices[i + 2] ?? 0) - cz;
      vertices[i] = x;
      vertices[i + 1] = y;
      vertices[i + 2] = z;
      radius = Math.max(radius, Math.hypot(x, y, z));
      // Only what floats. The model is built around its own waterline — keels below zero,
      // decks above — so the test is that plain, and it does not drift with the height of a rig.
      if (y + cy <= 0) {
        footX = Math.max(footX, Math.abs(x));
        footZ = Math.max(footZ, Math.abs(z));
      }
    }
    const parts = this.partList.map((part) => ({
      zone: part.zone,
      anchor: [part.anchor[0] - cx, part.anchor[1] - cy, part.anchor[2] - cz] as Vec3,
    }));
    return { vertices, faces: this.faceList, parts, radius, footprint: { x: footX, z: footZ } };
  }
}

export type Camera = {
  /** Rotation around the mast, in radians: this is what turns on its own. */
  yaw: number;
  /** How far above the waterline the eye sits, in radians. */
  pitch: number;
  /** Viewport, in CSS pixels. */
  width: number;
  height: number;
  /** Framing, from `fitCamera`. */
  fit: Fit;
};

/**
 * How the boat is framed. A bounding sphere would be wrong here: a rig is three times as tall
 * as a hull is long, so a sphere framing leaves the boat a stamp in the middle of the canvas.
 * `fitCamera` instead turns the boat right round once, measures the worst projected extent, and
 * picks the focal length and the centre from that — so the boat is as large as it can be **and**
 * never grows out of the frame as it turns.
 */
export type Fit = { focal: number; offsetX: number; offsetY: number };

/** Angles sampled for the framing: every ten degrees is well under a pixel of error. */
const FIT_SAMPLES = 36;

export function fitCamera(
  mesh: BoatMesh,
  o: { pitch: number; width: number; height: number; fill: number },
): Fit {
  const eye = mesh.radius * EYE_DISTANCE;
  const sinPitch = Math.sin(o.pitch);
  const cosPitch = Math.cos(o.pitch);
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let a = 0; a < FIT_SAMPLES; a += 1) {
    const yaw = (a / FIT_SAMPLES) * Math.PI * 2;
    const sinYaw = Math.sin(yaw);
    const cosYaw = Math.cos(yaw);
    for (let v = 0; v < mesh.vertices.length; v += 3) {
      const x = mesh.vertices[v] ?? 0;
      const y = mesh.vertices[v + 1] ?? 0;
      const z = mesh.vertices[v + 2] ?? 0;
      const rx = x * cosYaw + z * sinYaw;
      const rz = -x * sinYaw + z * cosYaw;
      const ry = y * cosPitch - rz * sinPitch;
      const rzz = y * sinPitch + rz * cosPitch;
      const depth = Math.max(eye - rzz, 0.05);
      const u = rx / depth;
      const w = ry / depth;
      if (u < minU) minU = u;
      if (u > maxU) maxU = u;
      if (w < minV) minV = w;
      if (w > maxV) maxV = w;
    }
  }
  const spanU = Math.max(maxU - minU, 1e-6);
  const spanV = Math.max(maxV - minV, 1e-6);
  const focal = Math.min((o.width * o.fill) / spanU, (o.height * o.fill) / spanV);
  return {
    focal,
    offsetX: (-(minU + maxU) / 2) * focal,
    offsetY: ((minV + maxV) / 2) * focal,
  };
}

/**
 * A studio light, in **camera** space: fixed to the eye rather than to the boat, so the shading
 * stays readable all the way round instead of flattening every half turn.
 */
const LIGHT: Vec3 = [-0.38, 0.78, 0.5];
const LIGHT_LENGTH = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2]);

/** How far the eye sits from the centre, in radii: enough perspective to read, never a fisheye. */
const EYE_DISTANCE = 3.4;

/**
 * Holds the buffers a frame needs so nothing is allocated inside the animation loop: on an iPad
 * the garbage collector is the difference between a boat that turns and a boat that stutters.
 */
export class Projector {
  /** Screen x, screen y and distance from the eye, per vertex. */
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly depth: Float32Array;
  /** Camera-space coordinates, kept for the lighting. */
  private readonly cx: Float32Array;
  private readonly cy: Float32Array;
  private readonly cz: Float32Array;
  /** Faces, far to near. */
  readonly order: Int32Array;
  /** 0 to 1 per face, the light on it. */
  readonly shade: Float32Array;
  /** Sort key per face: its mean distance from the eye. */
  private readonly key: Float32Array;

  constructor(private readonly mesh: BoatMesh) {
    const count = mesh.vertices.length / 3;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.depth = new Float32Array(count);
    this.cx = new Float32Array(count);
    this.cy = new Float32Array(count);
    this.cz = new Float32Array(count);
    this.order = new Int32Array(mesh.faces.length);
    this.shade = new Float32Array(mesh.faces.length);
    this.key = new Float32Array(mesh.faces.length);
  }

  /** Projects one point on its own — the pins use it, and nothing else. */
  projectPoint(v: Vec3, camera: Camera): { x: number; y: number; depth: number } {
    const { sinYaw, cosYaw, sinPitch, cosPitch, focal, eye, halfW, halfH } = frame(
      this.mesh,
      camera,
    );
    const rx = v[0] * cosYaw + v[2] * sinYaw;
    const rz = -v[0] * sinYaw + v[2] * cosYaw;
    const ry = v[1] * cosPitch - rz * sinPitch;
    const rzz = v[1] * sinPitch + rz * cosPitch;
    const depth = eye - rzz;
    const scale = focal / Math.max(depth, 0.05);
    return { x: halfW + rx * scale, y: halfH - ry * scale, depth };
  }

  /** One frame: transform every vertex, light every face, sort far to near. */
  run(camera: Camera): void {
    const { vertices, faces } = this.mesh;
    const { sinYaw, cosYaw, sinPitch, cosPitch, focal, eye, halfW, halfH } = frame(
      this.mesh,
      camera,
    );
    for (let i = 0, v = 0; v < vertices.length; i += 1, v += 3) {
      const x = vertices[v] ?? 0;
      const y = vertices[v + 1] ?? 0;
      const z = vertices[v + 2] ?? 0;
      const rx = x * cosYaw + z * sinYaw;
      const rz = -x * sinYaw + z * cosYaw;
      const ry = y * cosPitch - rz * sinPitch;
      const rzz = y * sinPitch + rz * cosPitch;
      const depth = eye - rzz;
      const scale = focal / Math.max(depth, 0.05);
      this.cx[i] = rx;
      this.cy[i] = ry;
      this.cz[i] = rzz;
      this.depth[i] = depth;
      this.x[i] = halfW + rx * scale;
      this.y[i] = halfH - ry * scale;
    }

    for (let f = 0; f < faces.length; f += 1) {
      const face = faces[f];
      this.order[f] = f;
      if (!face) continue;
      const indices = face.indices;
      let sum = 0;
      for (const index of indices) sum += this.depth[index] ?? 0;
      this.key[f] = sum / Math.max(indices.length, 1);
      this.shade[f] = this.light(indices);
    }
    // `sort` on a typed array takes a comparator; far first, so the painter covers it.
    const key = this.key;
    this.order.sort((a, b) => (key[b] ?? 0) - (key[a] ?? 0));
  }

  /**
   * The light on a face, from the normal of its first corner in camera space. The sign is
   * dropped: a sail and a trampoline are seen from both sides, and a hull never shows its
   * inside.
   */
  private light(indices: readonly number[]): number {
    const a = indices[0];
    const b = indices[1];
    const c = indices[2];
    if (a === undefined || b === undefined || c === undefined) return 0.82;
    const ux = (this.cx[b] ?? 0) - (this.cx[a] ?? 0);
    const uy = (this.cy[b] ?? 0) - (this.cy[a] ?? 0);
    const uz = (this.cz[b] ?? 0) - (this.cz[a] ?? 0);
    const vx = (this.cx[c] ?? 0) - (this.cx[a] ?? 0);
    const vy = (this.cy[c] ?? 0) - (this.cy[a] ?? 0);
    const vz = (this.cz[c] ?? 0) - (this.cz[a] ?? 0);
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const length = Math.hypot(nx, ny, nz) * LIGHT_LENGTH;
    if (length < 1e-6) return 0.82;
    const dot = Math.abs((nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]) / length);
    return 0.62 + 0.38 * dot;
  }

  /** The face under a point, nearest first — what a tap on the canvas selects. */
  hit(px: number, py: number): number | null {
    const { faces } = this.mesh;
    for (let i = this.order.length - 1; i >= 0; i -= 1) {
      const f = this.order[i];
      const face = f === undefined ? undefined : faces[f];
      if (face && f !== undefined && this.contains(face.indices, px, py)) return f;
    }
    return null;
  }

  private contains(indices: readonly number[], px: number, py: number): boolean {
    let inside = false;
    for (let i = 0, j = indices.length - 1; i < indices.length; j = i, i += 1) {
      const ii = indices[i] ?? 0;
      const jj = indices[j] ?? 0;
      const xi = this.x[ii] ?? 0;
      const yi = this.y[ii] ?? 0;
      const xj = this.x[jj] ?? 0;
      const yj = this.y[jj] ?? 0;
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
}

function frame(mesh: BoatMesh, camera: Camera) {
  return {
    sinYaw: Math.sin(camera.yaw),
    cosYaw: Math.cos(camera.yaw),
    sinPitch: Math.sin(camera.pitch),
    cosPitch: Math.cos(camera.pitch),
    focal: camera.fit.focal,
    eye: mesh.radius * EYE_DISTANCE,
    halfW: camera.width / 2 + camera.fit.offsetX,
    halfH: camera.height / 2 + camera.fit.offsetY,
  };
}
