// Parsing of numbers typed by hand on an iPad keyboard (CLAUDE.md rule 13): "1 256,5" → 1256.5.
// null = empty field, undefined = not a number (zod then reports the field).
export function parseDecimal(value: unknown): number | null | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") return undefined;
  const cleaned = value.replace(/[\s  ]/g, "").replace(",", ".");
  if (cleaned === "") return null;
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return undefined;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function roundTo(value: number, scale: number): number {
  const factor = 10 ** scale;
  return Math.round(value * factor) / factor;
}

// Calendar date as stored in the database (yyyy-MM-dd), in the device's local time zone.
export function toIsoDate(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, days: number): string {
  const [y = 0, m = 1, d = 1] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return toIsoDate(date);
}
