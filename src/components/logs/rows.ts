import type { LogStatus } from "@/components/common/StatusBadge";
import type { Database } from "@/types/database";

/** One row of `maintenance_logs_view`, as the journal list and the detail need it. */
export type LogRow = {
  id: string;
  title: string;
  performedAt: string;
  status: LogStatus;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  contactName: string | null;
  cost: number | null;
  needsReview: boolean;
  engineHours: LogEngineHours[];
  updatedAt: string;
};

export type LogEngineHours = { engineId: string; label: string; hours: number };

export type LogViewRow = Database["public"]["Views"]["maintenance_logs_view"]["Row"];

/** `engine_hours` is a JSON array built by the view: [{engine_id, label, hours}]. */
export function parseEngineHours(value: LogViewRow["engine_hours"]): LogEngineHours[] {
  if (!Array.isArray(value)) return [];
  const out: LogEngineHours[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const engineId = typeof row.engine_id === "string" ? row.engine_id : null;
    const hours = typeof row.hours === "number" ? row.hours : Number(row.hours);
    if (!engineId || !Number.isFinite(hours)) continue;
    out.push({ engineId, label: typeof row.label === "string" ? row.label : "", hours });
  }
  return out;
}

/** The columns the list actually selects (a partial projection of the view). */
export type LogListSelection = Pick<
  LogViewRow,
  | "id"
  | "title"
  | "category_id"
  | "category_name"
  | "category_color"
  | "status"
  | "performed_at"
  | "cost"
  | "contact_name"
  | "needs_review"
  | "engine_hours"
  | "updated_at"
>;

export function toLogRow(row: LogListSelection): LogRow {
  return {
    id: row.id ?? "",
    title: row.title ?? "",
    performedAt: row.performed_at ?? "",
    status: (row.status ?? "done") as LogStatus,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
    contactName: row.contact_name,
    cost: row.cost,
    needsReview: row.needs_review ?? false,
    engineHours: parseEngineHours(row.engine_hours),
    updatedAt: row.updated_at ?? "",
  };
}

/**
 * « Moteur SB » → « SB » for the dense right column of the list, where two engines and their
 * counters must fit. Language-neutral: the last word of a multi-word label.
 */
export function shortEngineLabel(label: string): string {
  const parts = label.trim().split(/\s+/);
  return parts.length > 1 ? (parts[parts.length - 1] ?? label) : label;
}
