import { subDays, subMonths, subYears } from "date-fns";

import { toDate, toDateString } from "@/lib/format";

/**
 * Expenses tab (E5-5): period arithmetic, category totals and CSV. Pure module — the page
 * reads `expenses_by_category`, this file decides what the numbers mean. No pivot table
 * (audit §3.4): a total, a descending list of categories, one comparison.
 */

export const EXPENSE_SOURCES = ["log", "purchase", "haul_out"] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

export const EXPENSE_PERIODS = ["rolling12", "year", "custom"] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];

export type DateRange = { from: string; to: string };

export type ExpenseRow = {
  source: string | null;
  entityId: string | null;
  label: string | null;
  amount: number | null;
  date: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
};

export type CategoryTotal = {
  id: string;
  name: string;
  color: string;
  amount: number;
  count: number;
};

export function isExpensePeriod(value: string | undefined): value is ExpensePeriod {
  return EXPENSE_PERIODS.includes(value as ExpensePeriod);
}

export function isExpenseSource(value: string): value is ExpenseSource {
  return EXPENSE_SOURCES.includes(value as ExpenseSource);
}

/** `?source=log,purchase` → the selected sources; anything unparsable means « all ». */
export function parseSources(value: string | undefined): ExpenseSource[] {
  if (!value) return [...EXPENSE_SOURCES];
  const picked = value
    .split(",")
    .map((part) => part.trim())
    .filter(isExpenseSource);
  return picked.length > 0 ? picked : [...EXPENSE_SOURCES];
}

/**
 * The period as two inclusive `yyyy-MM-dd` bounds. Twelve rolling months by default:
 * a calendar year means nothing for a Mediterranean season (0004_tracking.sql §13).
 */
export function resolveRange(
  period: ExpensePeriod,
  custom: Partial<DateRange>,
  today: string | Date = new Date(),
): DateRange {
  const reference = toDate(today) ?? new Date();
  const to = toDateString(reference);
  if (period === "year") {
    const year = reference.getFullYear();
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  if (period === "custom") {
    const from = custom.from ?? toDateString(subMonths(reference, 12));
    const end = custom.to ?? to;
    // A backwards range is a mis-tap, not an error worth a dialog: swap the two bounds.
    return from <= end ? { from, to: end } : { from: end, to: from };
  }
  return { from: toDateString(subMonths(reference, 12)), to };
}

/** Same length, shifted one step back — « N-1 » in the comparison line. */
export function previousRange(period: ExpensePeriod, range: DateRange): DateRange {
  if (period === "year") {
    const from = toDate(range.from);
    const year = (from?.getFullYear() ?? new Date().getFullYear()) - 1;
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }
  const from = toDate(range.from);
  const to = toDate(range.to);
  if (!from || !to) return range;
  if (period === "rolling12") {
    return { from: toDateString(subYears(from, 1)), to: toDateString(subYears(to, 1)) };
  }
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  return { from: toDateString(subDays(from, days)), to: toDateString(subDays(to, days)) };
}

export function totalAmount(rows: readonly ExpenseRow[]): number {
  return rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);
}

/**
 * One line per category, largest first. Rows without a category are gathered under
 * `fallbackName` with a neutral colour: a category colour never travels alone (rule 12).
 */
export function groupByCategory(
  rows: readonly ExpenseRow[],
  fallbackName: string,
  fallbackColor: string,
): CategoryTotal[] {
  const totals = new Map<string, CategoryTotal>();
  for (const row of rows) {
    const id = row.categoryId ?? "";
    const current = totals.get(id) ?? {
      id,
      name: row.categoryName ?? fallbackName,
      color: row.categoryColor ?? fallbackColor,
      amount: 0,
      count: 0,
    };
    current.amount += row.amount ?? 0;
    current.count += 1;
    totals.set(id, current);
  }
  return [...totals.values()].sort(
    (a, b) => b.amount - a.amount || a.name.localeCompare(b.name, "fr"),
  );
}

/** null when the previous period holds nothing: « +∞ % » says less than « aucune dépense ». */
export function variation(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return (current - previous) / previous;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[";\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export type CsvLabels = {
  headers: [string, string, string, string, string];
  source: Record<ExpenseSource, string>;
  uncategorized: string;
};

/**
 * `;` separator and a BOM: that is what Excel FR opens without a dialog. Amounts keep the
 * French comma so a French spreadsheet reads them as numbers.
 */
export function buildExpensesCsv(rows: readonly ExpenseRow[], labels: CsvLabels): string {
  const lines = [labels.headers.map(csvCell).join(";")];
  for (const row of rows) {
    const source = isExpenseSource(row.source ?? "")
      ? labels.source[row.source as ExpenseSource]
      : (row.source ?? "");
    lines.push(
      [
        csvCell(row.date),
        csvCell(source),
        csvCell(row.label),
        csvCell(row.categoryName ?? labels.uncategorized),
        csvCell(
          row.amount === null || row.amount === undefined
            ? ""
            : row.amount.toFixed(2).replace(".", ","),
        ),
      ].join(";"),
    );
  }
  return `﻿${lines.join("\r\n")}\r\n`;
}
