import { formatCurrency, todayString } from "@/lib/format";
import { parseDecimal } from "@/lib/numbers";
import type { InboxItem } from "@/lib/queries/inbox";
import { validateInboxItemSchema, type InboxKind, type InboxSuggestion } from "@/lib/schemas/inbox";
import type { VisiblePurchaseKind } from "@/lib/schemas/purchases";

/**
 * What a card holds between the reading and « Valider » — and how it decides whether the person
 * has to read a form at all.
 *
 * Kept out of the component so the rule that opens a card on one line rather than on eight fields
 * can be read, and tested, on its own.
 */

/** An engine of the boat, as the hour fields name it. */
export type InboxEngine = { id: string; label: string };

/** What the card holds, field by field, in the strings the touch inputs speak. */
export type InboxDraft = {
  kind: InboxKind;
  title: string;
  date: string;
  categoryId: string;
  amount: string;
  contactId: string | null;
  supplierName: string;
  purchaseKind: VisiblePurchaseKind;
  notes: string;
  hours: Record<string, string>;
};

/** What the card opens on: the suggestion, or the document alone when there is none. */
export function draftFrom(item: InboxItem, suggestion: InboxSuggestion | null): InboxDraft {
  const hours: Record<string, string> = {};
  for (const row of suggestion?.engineHours ?? []) hours[row.engineId] = String(row.hours);
  const lines = (suggestion?.lineItems ?? [])
    .map((line) =>
      line.amount === null
        ? line.designation
        : `${line.designation} — ${formatCurrency(line.amount)}`,
    )
    .join("\n");
  return {
    kind: suggestion?.kind ?? "log",
    title: suggestion?.title ?? item.fileName.replace(/\.[a-z0-9]{1,8}$/i, ""),
    date: suggestion?.date ?? todayString(),
    categoryId: suggestion?.categoryId ?? "",
    amount:
      suggestion?.amount === null || suggestion?.amount === undefined
        ? ""
        : String(suggestion.amount),
    contactId: suggestion?.contactId ?? null,
    supplierName: suggestion?.supplierName ?? "",
    purchaseKind: suggestion?.purchaseKind ?? "service",
    notes: [suggestion?.notes, lines].filter(Boolean).join("\n\n"),
    hours,
  };
}

/** What « Valider » sends, from what the card holds. The same shape for a tap and for a batch. */
export function toValidateInput(
  draft: InboxDraft,
  { boatId, itemId, engineIds }: { boatId: string; itemId: string; engineIds: string[] },
) {
  return {
    boatId,
    itemId,
    kind: draft.kind,
    title: draft.title,
    date: draft.date,
    categoryId: draft.categoryId,
    amount: draft.amount.trim() === "" ? null : parseDecimal(draft.amount),
    contactId: draft.contactId,
    supplierName: draft.supplierName,
    purchaseKind: draft.purchaseKind,
    notes: draft.notes,
    engineHours: engineIds.map((engineId) => ({
      engineId,
      hours:
        (draft.hours[engineId] ?? "").trim() === ""
          ? null
          : parseDecimal(draft.hours[engineId] ?? ""),
    })),
  };
}

/**
 * `local` is not a warning about this document: it is the standing sentence that an agent IA read
 * it and that the fields are to be checked (D94), posted on every card the local reader touched.
 * What earns a second look is the rest — a guessed total, an unlabelled date, a doubtful OCR
 * (D92) — so that is what « avec réserve » means here.
 */
const STANDING_WARNINGS: ReadonlySet<string> = new Set(["local"]);

export function documentWarnings(item: InboxItem): string[] {
  return (item.suggestion?.warnings ?? []).filter((warning) => !STANDING_WARNINGS.has(warning));
}

/**
 * A card that can be filed without opening the form: it was read, the reading says nothing to
 * check on this document in particular, and what it proposes is already a valid line. Anything
 * else — a warning, a failed reading, a missing system on an intervention — opens on the form,
 * because the warning is exactly what earns the second look (D92, D94).
 */
export function isConfidentItem(
  item: InboxItem,
  { boatId, engineIds }: { boatId: string; engineIds: string[] },
): boolean {
  if (item.status !== "ready") return false;
  if (item.error !== null) return false;
  const suggestion = item.suggestion;
  if (!suggestion) return false;
  if (suggestion.confidence === "low") return false;
  if (documentWarnings(item).length > 0) return false;
  const input = toValidateInput(draftFrom(item, suggestion), {
    boatId,
    itemId: item.id,
    engineIds,
  });
  return validateInboxItemSchema.safeParse(input).success;
}

/** The cards « Tout valider » would file, in the order they are shown. */
export function confidentItems(
  items: InboxItem[],
  options: { boatId: string; engineIds: string[] },
): InboxItem[] {
  return items.filter((item) => isConfidentItem(item, options));
}
