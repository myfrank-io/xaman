import { describe, expect, it } from "vitest";

import { normaliseSuggestion, type InboxContext, type InboxModelOutput } from "@/lib/inbox/prompt";
import {
  INBOX_BATCH_MAX,
  inboxBatchLineSchema,
  isCheckedByDefault,
  type InboxBatchLine,
} from "@/lib/schemas/inbox";

/**
 * Reading a boat document (E17-1, `docs/AUTOPILOT.md §2`).
 *
 * A delivery note, a quote or a survey report do not describe one line: they describe a boat. What
 * matters here is not that the model reads well — that is the model's job — but that **what comes
 * back is safe to put on a screen and, later, into somebody's carnet**: no reference the boat does
 * not have, no line without the date that justifies it, no line pre-checked on an authority the
 * document never gave.
 */
const CATEGORY = "11111111-1111-4111-8111-111111111111";
const POINT = "22222222-2222-4222-8222-222222222222";

const context: InboxContext = {
  boatName: "Xaman",
  boatType: "catamaran",
  today: "2026-09-14",
  categories: [{ id: CATEGORY, name: "Hydraulique & Circuits", externalRef: "plumbing_systems" }],
  engines: [],
  contacts: [],
  deadlineItems: [{ id: POINT, label: "Révision du radeau", category: "Sécurité" }],
  equipmentKinds: [
    {
      externalRef: "heater-forced-air",
      label: "Chauffage à air pulsé",
      categoryRef: "plumbing_systems",
    },
    { externalRef: "watermaker", label: "Dessalinisateur", categoryRef: "plumbing_systems" },
  ],
};

/** A reading with nothing in it, so each case only has to say what it is about. */
function output(over: Partial<InboxModelOutput> = {}): InboxModelOutput {
  return {
    documentType: "report",
    kind: "log",
    purchaseKind: "other",
    title: "Bon de livraison",
    date: "2026-01-31",
    amount: null,
    currency: null,
    supplierName: null,
    supplier: { name: null, company: null, phone: null, email: null, address: null },
    contactId: null,
    categoryId: null,
    engineHours: [],
    lineItems: [],
    notes: null,
    inventory: [],
    checklistItemId: null,
    validUntil: null,
    documentFamily: "delivery_note",
    batch: [],
    confidence: "high",
    warnings: [],
    ...over,
  };
}

/** One batch line with everything empty, so each case fills only what it tests. */
function line(over: Partial<InboxModelOutput["batch"][number]> = {}) {
  return {
    type: "equipment" as const,
    label: "Chauffage Wallas 30DT",
    documentDate: null,
    status: "fitted" as const,
    kindRef: "heater-forced-air",
    brand: "Wallas",
    model: "30DT",
    serial: null,
    quantity: 1,
    categoryRef: "plumbing_systems",
    ref: null,
    provider: { name: null, company: null, phone: null, email: null, address: null },
    identityField: null,
    identityValue: null,
    validUntil: null,
    checklistItemId: null,
    notes: null,
    ...over,
  };
}

describe("what a boat document proposes", () => {
  it("keeps the family it recognised, and the lines it read", () => {
    const suggestion = normaliseSuggestion(output({ batch: [line()] }), context);
    expect(suggestion?.documentFamily).toBe("delivery_note");
    expect(suggestion?.batch).toHaveLength(1);
    expect(suggestion?.batch[0]?.kindRef).toBe("heater-forced-air");
    expect(suggestion?.batch[0]?.brand).toBe("Wallas");
  });

  /** `AUTOPILOT.md §2.3` rule 2: the date that justifies a line travels with the line. */
  it("carries the document's date onto a line that has none of its own", () => {
    const suggestion = normaliseSuggestion(
      output({ date: "2026-01-31", batch: [line(), line({ documentDate: "2025-11-02" })] }),
      context,
    );
    expect(suggestion?.batch[0]?.documentDate).toBe("2026-01-31");
    // A survey report dates its reserves one by one; that date wins over the document's.
    expect(suggestion?.batch[1]?.documentDate).toBe("2025-11-02");
  });

  it("leaves a line dateless when the document itself has no date", () => {
    const suggestion = normaliseSuggestion(output({ date: null, batch: [line()] }), context);
    expect(suggestion?.batch[0]?.documentDate).toBeNull();
  });

  /** A reference the boat does not have would point at nothing on the screen. */
  it("drops a family and a system the boat was never given", () => {
    const suggestion = normaliseSuggestion(
      output({ batch: [line({ kindRef: "inventé", categoryRef: "inventé" })] }),
      context,
    );
    expect(suggestion?.batch[0]?.kindRef).toBeNull();
    expect(suggestion?.batch[0]?.categoryRef).toBeNull();
    // The line survives: it still names something real, it is simply unfiled.
    expect(suggestion?.batch[0]?.label).toBe("Chauffage Wallas 30DT");
  });

  it("only accepts a checklist point the boat actually carries", () => {
    const ok = normaliseSuggestion(
      output({
        batch: [
          line({
            type: "deadline",
            validUntil: "2029-09-04",
            checklistItemId: POINT,
            kindRef: null,
          }),
        ],
      }),
      context,
    );
    expect(ok?.batch[0]?.checklistItemId).toBe(POINT);

    const invented = normaliseSuggestion(
      output({
        batch: [
          line({
            type: "deadline",
            validUntil: "2029-09-04",
            checklistItemId: "33333333-3333-4333-8333-333333333333",
            kindRef: null,
          }),
        ],
      }),
      context,
    );
    expect(invented?.batch[0]?.checklistItemId).toBeNull();
  });

  /** Rule 6: « 2 » on a heater's line means two appliances, one per hull. */
  it("respects a quantity, and never lets one fall below one", () => {
    const quantityOf = (quantity: number | null) =>
      normaliseSuggestion(output({ batch: [line({ quantity })] }), context)?.batch[0]?.quantity;

    expect(quantityOf(2), "deux appareils").toBe(2);
    // A quantity read off a page can come back as a decimal; a boat carries whole heaters.
    expect(quantityOf(2.9), "2,9 appareils").toBe(2);
    // Nothing readable is one thing, not zero things: the line names something that exists.
    for (const bad of [0, -3, null]) {
      expect(quantityOf(bad), `quantité ${bad}`).toBe(1);
    }
  });

  /** Rule 8: the yard's reference is kept so a part can be ordered, never shown as a name. */
  it("keeps the yard's own reference beside the label, not inside it", () => {
    const suggestion = normaliseSuggestion(output({ batch: [line({ ref: "GREM19" })] }), context);
    expect(suggestion?.batch[0]?.ref).toBe("GREM19");
    expect(suggestion?.batch[0]?.label).not.toContain("GREM19");
  });

  /** An empty row on the « ce que j'ai lu » screen is worse than one line fewer. */
  it("drops a line that does not say what its own sort requires", () => {
    const suggestion = normaliseSuggestion(
      output({
        batch: [
          // a deadline with no expiry is a label, not a deadline
          line({ type: "deadline", validUntil: null, kindRef: null }),
          // an identity line that says neither which field nor what it says
          line({ type: "identity", identityField: null, identityValue: null, kindRef: null }),
          // a provider nobody named
          line({ type: "provider", kindRef: null }),
          // and one good line, to prove the rest of the batch survives
          line(),
        ],
      }),
      context,
    );
    expect(suggestion?.batch).toHaveLength(1);
    expect(suggestion?.batch[0]?.type).toBe("equipment");
  });

  it("keeps a provider line when the document names one", () => {
    const suggestion = normaliseSuggestion(
      output({
        batch: [
          line({
            type: "provider",
            label: "Marsaudon Composites",
            kindRef: null,
            categoryRef: null,
            provider: {
              name: "Marsaudon Composites",
              company: null,
              phone: "02 97 00 00 00",
              email: null,
              // A letterhead is several lines; a screen is not a letterhead.
              address: "ZA de Kerpont\n56850 Caudan",
            },
          }),
        ],
      }),
      context,
    );
    expect(suggestion?.batch[0]?.provider?.name).toBe("Marsaudon Composites");
    expect(suggestion?.batch[0]?.provider?.address).toBe("ZA de Kerpont, 56850 Caudan");
  });

  it("never returns more lines than a screen can hold", () => {
    const many = Array.from({ length: INBOX_BATCH_MAX + 20 }, (_, i) =>
      line({ label: `Ligne ${i + 1}` }),
    );
    const suggestion = normaliseSuggestion(output({ batch: many }), context);
    expect(suggestion?.batch).toHaveLength(INBOX_BATCH_MAX);
  });

  /** An ordinary invoice is one line; the batch is for documents that describe a boat. */
  it("leaves the batch empty on a document that is a single line", () => {
    const suggestion = normaliseSuggestion(
      output({ documentFamily: "maintenance_invoice", kind: "log", batch: [] }),
      context,
    );
    expect(suggestion?.batch).toEqual([]);
    expect(suggestion?.documentFamily).toBe("maintenance_invoice");
  });
});

describe("which lines arrive checked", () => {
  const withStatus = (status: InboxBatchLine["status"]): InboxBatchLine =>
    inboxBatchLineSchema.parse({ type: "equipment", label: "Winch", status });

  /**
   * `AUTOPILOT.md §2.3` rule 4: read the status column, and check only what the document
   * vouches for. A quote's options and a struck-out line are shown, not written.
   */
  it("checks what the document vouches for, and nothing else", () => {
    expect(isCheckedByDefault(withStatus("fitted")), "monté").toBe(true);
    expect(isCheckedByDefault(withStatus("retained")), "retenu").toBe(true);
    expect(isCheckedByDefault(withStatus("optional")), "option").toBe(false);
    expect(isCheckedByDefault(withStatus("cancelled")), "barré").toBe(false);
    expect(isCheckedByDefault(withStatus("removed")), "déposé").toBe(false);
    // The commonest case, and the one that matters most: a status nobody could read is not a
    // reason to write a line into someone's carnet.
    expect(isCheckedByDefault(withStatus("unknown")), "sans statut").toBe(false);
  });

  it("treats a line with no status at all as unknown", () => {
    const parsed = inboxBatchLineSchema.parse({ type: "equipment", label: "Winch" });
    expect(parsed.status).toBe("unknown");
    expect(isCheckedByDefault(parsed)).toBe(false);
  });
});
