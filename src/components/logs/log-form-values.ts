import { numberToInput } from "@/components/forms/form-values";
import type { SupplierRead } from "@/lib/contacts/match";
import { formatCurrency } from "@/lib/format";
import type { InboxSuggestion } from "@/lib/schemas/inbox";
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
  /** Every system it touches, the principal first (D114). */
  categoryIds: string[];
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
 * Values the form opens on, whatever named them: the query string (`?item=`, `?category=`,
 * `?date=`, `?hours=<engine>:<h>`), resolved on the server so the form receives plain strings,
 * or the reading of the document the intervention starts from (D115).
 */
export type LogFormPrefill = {
  title?: string;
  categoryIds?: string[];
  performedAt?: string;
  hours?: { engineId: string; hours: string }[];
  checklistItemIds?: string[];
  contactId?: string;
  equipmentId?: string;
  /** Read on the document the intervention starts from (D115): cost, notes, provider. */
  cost?: string;
  notes?: string;
  /** The provider as the document spells it, when no contact of the boat matched (D116). */
  supplier?: SupplierRead;
  /**
   * Open the hours block at once: « + Ajouter les détails » from an hour-based point, or the
   * act started from an engine sheet. The fields stay empty and the title keeps the focus —
   * nothing steals the first keystroke.
   */
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

/**
 * `?category=<id>` — repeatable, and comma-separated inside one value, because an intervention
 * carries several systems since D114 and « Refaire » must bring them all back.
 */
export function parseCategoriesParam(value: string | string[] | undefined): string[] {
  const raw = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return [...new Set(raw.flatMap((entry) => entry.split(",")).map((id) => id.trim()))].filter(
    Boolean,
  );
}

export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * The document an intervention starts from (D115): it is already in the inbox — same upload,
 * same reading as a mail — and joins the intervention as its attachment once it is saved.
 */
export type LogFormDocument = {
  /** The `inbox_items` row: what « Valider » attaches once the intervention exists. */
  itemId: string;
  fileName: string;
  /** What the reading proposed to file it as: a purchase is worth saying out loud. */
  kind: "log" | "purchase";
};

/**
 * Whether the URL already says what the intervention is about. « + Ajouter les détails » from
 * the checklist, « Refaire » from a detail page and « Noter une intervention » from an engine
 * sheet all arrive knowing; only the bare « + » opens on the document (D115).
 */
export const PREFILL_PARAMS = [
  "item",
  "title",
  "category",
  "date",
  "hours",
  "contact",
  "equipment",
  "engine",
] as const;

export function hasPrefillParams(search: Record<string, string | string[] | undefined>): boolean {
  return PREFILL_PARAMS.some((key) => firstParam(search[key]) !== undefined);
}

/**
 * Ce que la lecture propose, dans la langue du formulaire. Ce que l'URL avait déjà dit gagne :
 * un paramètre est une intention explicite, une lecture est une proposition (D91).
 */
export function mergePrefill(
  prefill: LogFormPrefill,
  suggestion: InboxSuggestion | null,
  engines: LogFormEngine[],
): LogFormPrefill {
  if (!suggestion) return prefill;
  const known = new Set(engines.map((engine) => engine.id));
  const hours = suggestion.engineHours
    .filter((row) => known.has(row.engineId))
    .map((row) => ({ engineId: row.engineId, hours: numberToInput(row.hours) }));
  // The lines of the invoice under the notes, as the inbox card writes them: what the total is
  // made of is exactly what someone re-reads the intervention for.
  const lines = suggestion.lineItems
    .map((line) =>
      line.amount === null
        ? line.designation
        : `${line.designation} — ${formatCurrency(line.amount)}`,
    )
    .join("\n");
  const notes = [suggestion.notes, lines].filter(Boolean).join("\n\n");
  const supplier: SupplierRead = {
    ...suggestion.supplier,
    // Older readings carry the name alone; it is still enough to recognise a provider.
    name: suggestion.supplier.name ?? suggestion.supplierName,
  };

  return {
    ...prefill,
    title: prefill.title ?? suggestion.title,
    categoryIds: prefill.categoryIds ?? (suggestion.categoryId ? [suggestion.categoryId] : []),
    performedAt: prefill.performedAt ?? suggestion.date ?? undefined,
    cost:
      prefill.cost ?? (suggestion.amount === null ? undefined : numberToInput(suggestion.amount)),
    contactId: prefill.contactId ?? suggestion.contactId ?? undefined,
    notes: prefill.notes ?? (notes || undefined),
    hours: prefill.hours && prefill.hours.length > 0 ? prefill.hours : hours,
    supplier,
    expandHours: prefill.expandHours ?? hours.length > 0,
  };
}
