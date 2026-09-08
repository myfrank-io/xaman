import { subDays, subMonths, subYears } from "date-fns";

import { toDate, toDateString } from "@/lib/format";
import { daysAshore } from "@/lib/haul-outs";
import type { Database } from "@/types/database";

/**
 * Expenses tab (E5-5): period arithmetic, category totals and CSV. Pure module — the page
 * reads `expenses_by_category`, this file decides what the numbers mean. No pivot table
 * (audit §3.4): a total, a descending list of categories, one comparison.
 */

export const EXPENSE_SOURCES = ["log", "purchase", "haul_out"] as const;
export type ExpenseSource = (typeof EXPENSE_SOURCES)[number];

/**
 * « Toute la période » leads and is the default (D33): Dépenses is now the only money list,
 * and a rolling twelve-month window would silently hide the paper-logbook import.
 */
export const EXPENSE_PERIODS = ["all", "rolling12", "year", "custom"] as const;
export type ExpensePeriod = (typeof EXPENSE_PERIODS)[number];

/** Lower bound of « toute la période »: older than any boat this app will ever hold. */
export const EXPENSE_EPOCH = "1900-01-01";

/**
 * `?category=none` — the lines that carry no system at all. Every haul-out is one of them (the
 * view files them under a null category), so the bucket is never empty on a real boat, and
 * « Sans catégorie » had to be filterable like any other row of the breakdown. A UUID can never
 * collide with it.
 */
export const NO_CATEGORY = "none";

export type DateRange = { from: string; to: string };

export type ExpenseRow = {
  source: string | null;
  /** Only for a purchase line: fuel, gas, part… Absent everywhere else. */
  purchaseKind?: string | null;
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

/** The filters of the money list as they travel in the URL (ux-flows §1.2). */
export type ExpenseFilterState = {
  period: ExpensePeriod;
  range: DateRange;
  sources: ExpenseSource[];
  kind: string | null;
  categoryId: string | null;
};

/**
 * Those filters, written as a query string. One function for the two places that navigate —
 * the filter panel and the category breakdown, which is a filter of its own now — because a
 * second copy is how `from`/`to` end up dropped on a custom period in one of them only.
 *
 * What is implicit is never written: the default period, the full source list, and the sources
 * a kind already implies (a kind only exists on a purchase).
 */
export function expenseFilterQuery(state: ExpenseFilterState): Record<string, string | undefined> {
  return {
    period: state.period === "all" ? undefined : state.period,
    from: state.period === "custom" ? state.range.from : undefined,
    to: state.period === "custom" ? state.range.to : undefined,
    source:
      state.kind || state.sources.length === EXPENSE_SOURCES.length
        ? undefined
        : state.sources.join(","),
    kind: state.kind ?? undefined,
    category: state.categoryId ?? undefined,
  };
}

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
  if (period === "all") return { from: EXPENSE_EPOCH, to };
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
  // « Toute la période » has no previous period: the caller shows « — » instead.
  if (period === "all") return range;
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

/**
 * What a line of the money list hides (D80). Tapping a line unrolls this under it instead of
 * throwing the reader at the other end of the app: the answer to « c'est quoi, cette ligne ? »
 * is read where the question is asked, and one more tap opens the intervention itself.
 */
export type ExpenseEngineHours = { label: string; hours: number };

export type LogStatus = Database["public"]["Enums"]["log_status"];

export type ExpenseDetail =
  | {
      source: "log";
      status: LogStatus;
      contactName: string | null;
      equipmentName: string | null;
      notes: string | null;
      engineHours: ExpenseEngineHours[];
      completionsCount: number;
      purchasesCount: number;
      attachmentsCount: number;
      needsReview: boolean;
      haulOutId: string | null;
    }
  | {
      source: "purchase";
      designation: string;
      supplier: string | null;
      bottleType: string | null;
      notes: string | null;
      needsReview: boolean;
      /** The intervention this purchase paid for, when it carries one. */
      logId: string | null;
      logTitle: string | null;
    }
  | {
      source: "haul_out";
      yard: string | null;
      startedAt: string;
      endedAt: string | null;
      daysAshore: number;
      works: string | null;
      logsCount: number;
      logsTotal: number;
    };

/** One line of the merged list, identified across the three tables it can come from. */
export function expenseKey(source: string | null, entityId: string | null): string {
  return `${source ?? ""}:${entityId ?? ""}`;
}

/** The columns of `maintenance_logs_view` the recap needs, engine hours already parsed. */
export type LogDetailRow = {
  id: string | null;
  status: LogStatus | null;
  contact_name: string | null;
  equipment_name: string | null;
  notes: string | null;
  completions_count: number | null;
  purchases_count: number | null;
  attachments_count: number | null;
  needs_review: boolean | null;
  haul_out_id: string | null;
  engineHours: ExpenseEngineHours[];
};

export type PurchaseDetailRow = {
  id: string;
  designation: string | null;
  bottle_type: string | null;
  notes: string | null;
  needs_review: boolean | null;
  supplier_contact_id: string | null;
  supplier_name: string | null;
  maintenance_log_id: string | null;
};

export type HaulOutDetailRow = {
  id: string;
  yard_name: string | null;
  yard_contact_id: string | null;
  started_at: string;
  ended_at: string | null;
  works: string | null;
};

/**
 * The recap of every line of the page, keyed by `expenseKey`. Pure: the page reads the rows,
 * this decides what they say. Three things it does that a mapping would not — a haul-out
 * carries the interventions of its period (count and total, the figure wanted at resale), a
 * supplier or a yard is either a contact of the boat or a free-text name, and a purchase names
 * the intervention it paid for.
 */
export function buildExpenseDetails({
  logs = [],
  purchases = [],
  haulOuts = [],
  haulOutLogs = [],
  contactNames = new Map<string, string>(),
  logTitles = new Map<string, string>(),
  today,
}: {
  logs?: readonly LogDetailRow[];
  purchases?: readonly PurchaseDetailRow[];
  haulOuts?: readonly HaulOutDetailRow[];
  /** Interventions attached to the haul-outs above: `{ haul_out_id, cost }` rows. */
  haulOutLogs?: readonly { haul_out_id: string | null; cost: number | null }[];
  contactNames?: ReadonlyMap<string, string>;
  logTitles?: ReadonlyMap<string, string>;
  today?: string | Date;
}): Map<string, ExpenseDetail> {
  const details = new Map<string, ExpenseDetail>();

  for (const log of logs) {
    if (!log.id) continue;
    details.set(expenseKey("log", log.id), {
      source: "log",
      status: log.status ?? "done",
      contactName: log.contact_name,
      equipmentName: log.equipment_name,
      notes: log.notes,
      engineHours: log.engineHours,
      completionsCount: log.completions_count ?? 0,
      purchasesCount: log.purchases_count ?? 0,
      attachmentsCount: log.attachments_count ?? 0,
      needsReview: log.needs_review ?? false,
      haulOutId: log.haul_out_id,
    });
  }

  for (const purchase of purchases) {
    const logId = purchase.maintenance_log_id;
    details.set(expenseKey("purchase", purchase.id), {
      source: "purchase",
      designation: purchase.designation ?? "",
      // The directory wins over the free-text name: a contact that was renamed stays right here.
      supplier: purchase.supplier_contact_id
        ? (contactNames.get(purchase.supplier_contact_id) ?? purchase.supplier_name)
        : purchase.supplier_name,
      bottleType: purchase.bottle_type,
      notes: purchase.notes,
      needsReview: purchase.needs_review ?? false,
      logId,
      logTitle: logId ? (logTitles.get(logId) ?? null) : null,
    });
  }

  const linked = new Map<string, { count: number; total: number }>();
  for (const row of haulOutLogs) {
    if (!row.haul_out_id) continue;
    const current = linked.get(row.haul_out_id) ?? { count: 0, total: 0 };
    current.count += 1;
    current.total += row.cost ?? 0;
    linked.set(row.haul_out_id, current);
  }

  for (const haulOut of haulOuts) {
    const logs = linked.get(haulOut.id);
    details.set(expenseKey("haul_out", haulOut.id), {
      source: "haul_out",
      yard: haulOut.yard_contact_id
        ? (contactNames.get(haulOut.yard_contact_id) ?? haulOut.yard_name)
        : haulOut.yard_name,
      startedAt: haulOut.started_at,
      endedAt: haulOut.ended_at,
      daysAshore: daysAshore(haulOut.started_at, haulOut.ended_at, today),
      works: haulOut.works,
      logsCount: logs?.count ?? 0,
      logsTotal: logs?.total ?? 0,
    });
  }

  return details;
}
