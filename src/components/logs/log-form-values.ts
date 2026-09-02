import type { LogStatusValue } from "@/lib/schemas/logs";

/** One active engine of the boat, with its last known reading (help text « dernier : … »). */
export type LogFormEngine = {
  id: string;
  label: string;
  lastHours: number | null;
  lastDate: string | null;
};

export type LogFormChoice = { id: string; label: string };

/** The intervention being edited, as the form needs it. */
export type LogFormValues = {
  id: string;
  title: string;
  categoryId: string | null;
  status: LogStatusValue;
  performedAt: string;
  cost: number | null;
  contactId: string | null;
  equipmentId: string | null;
  haulOutId: string | null;
  notes: string | null;
  /** Readings already carried by this intervention. */
  engineHours: { engineId: string; hours: number }[];
  /** Checklist points already ticked by this intervention. */
  checklistItemIds: string[];
  updatedAt: string;
};

/**
 * Values read from the query string (`?item=`, `?category=`, `?date=`, `?hours=<engine>:<h>`),
 * resolved on the server so the form receives plain strings.
 */
export type LogFormPrefill = {
  title?: string;
  categoryId?: string;
  performedAt?: string;
  hours?: { engineId: string; hours: string }[];
  checklistItemIds?: string[];
  contactId?: string;
  equipmentId?: string;
  /** « + Ajouter les détails » from an hour-based point: open the hours block at once. */
  expandHours?: boolean;
};

/** `?hours=<engineId>:<hours>` — repeatable, one pair per engine. */
export function parseHoursParam(
  value: string | string[] | undefined,
): { engineId: string; hours: string }[] {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const out: { engineId: string; hours: string }[] = [];
  for (const entry of raw) {
    for (const pair of entry.split(",")) {
      const [engineId, hours] = pair.split(":");
      if (engineId && hours) out.push({ engineId, hours });
    }
  }
  return out;
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}
