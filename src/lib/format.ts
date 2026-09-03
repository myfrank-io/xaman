import { format, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

// Dates are stored as `yyyy-MM-dd` strings (Postgres `date`). All display formatting goes through here.

export const DATE_FORMAT = "dd/MM/yyyy";

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = typeof value === "string" ? parseISO(value) : value;
  return isValid(date) ? date : null;
}

/** 03/09/2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, DATE_FORMAT, { locale: fr }) : "—";
}

/** 28/08 — short date for dense chips where the year is noise */
export function formatDayMonth(value: string | Date | null | undefined): string {
  const date = toDate(value);
  return date ? format(date, "dd/MM", { locale: fr }) : "—";
}

/** yyyy-MM-dd, for `date` columns and <input type="date"> */
export function toDateString(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function todayString(): string {
  return toDateString(new Date());
}

const currencyFormatter = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });

export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined || amount === "") return "—";
  const n = typeof amount === "string" ? Number(amount) : amount;
  return Number.isFinite(n) ? currencyFormatter.format(n) : "—";
}

const hoursFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 1 234,5 h */
export function formatHours(hours: number | string | null | undefined): string {
  if (hours === null || hours === undefined || hours === "") return "—";
  const n = typeof hours === "string" ? Number(hours) : hours;
  return Number.isFinite(n) ? `${hoursFormatter.format(n)} h` : "—";
}

const numberFormatter = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 });

export function formatNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = typeof value === "string" ? Number(value) : value;
  return Number.isFinite(n) ? numberFormatter.format(n) : "—";
}

/** 0.4 → 40 % */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) return "—";
  return `${Math.round(ratio * 100)} %`;
}

/**
 * « 1 234,5 » / « 1234.5 » / « 1 234,5 h » → 1234.5. Empty input → null,
 * so a blank cost stays « unknown » and never becomes 0 (ux-flows §4.2).
 * UI-side counterpart of `parseDecimal()` in `src/lib/numbers.ts`, which the
 * zod schemas use: that one distinguishes « empty » (null) from « not a
 * number » (undefined); this one is lenient and always returns null.
 */
