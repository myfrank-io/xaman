import { describe, expect, it } from "vitest";

import { planBatch, tallyBatch, type Carnet } from "@/lib/inbox/batch-plan";
import { inboxBatchLineSchema, type InboxBatchLine } from "@/lib/schemas/inbox";

/**
 * What a read document would do to the carnet (E17-2, D113).
 *
 * The decision these cases guard: **le carnet fait foi**. Xaman's own order sheet is the specimen —
 * dated January 2023, boat delivered a year later, five items changed in between. A document can
 * be read perfectly and still be out of date, so a line that contradicts the carnet is shown
 * beside it and arrives **unchecked**. Getting this wrong does not lose a line; it silently
 * rewrites somebody's boat from a paper that was already stale when it arrived.
 */
const line = (over: Partial<InboxBatchLine> = {}): InboxBatchLine =>
  inboxBatchLineSchema.parse({
    type: "equipment",
    label: "Chauffage Wallas 30DT",
    status: "fitted",
    kindRef: "heater-forced-air",
    brand: "Wallas",
    ...over,
  });

const EMPTY: Carnet = { equipment: [], contacts: [], identity: {} };

const carnet = (over: Partial<Carnet> = {}): Carnet => ({ ...EMPTY, ...over });

const heater = (over: Partial<Carnet["equipment"][number]> = {}) => ({
  id: "eq-1",
  name: "Chauffage",
  kindRef: "heater-forced-air",
  brand: "Wallas",
  model: null,
  serial: null,
  quantity: 1,
  ...over,
});

describe("matching a line against the carnet", () => {
  it("proposes what the boat does not have", () => {
    const [row] = planBatch([line()], EMPTY);
    expect(row?.outcome.kind).toBe("create");
    expect(row?.checked, "the document vouches for it and it adds something").toBe(true);
  });

  /**
   * D113 and `AUTOPILOT.md §2.3` rule 5: by family, never by label. Matched on their labels these
   * two would make a second heater instead of one recognisable appliance.
   */
  it("recognises the same appliance under another name", () => {
    const [row] = planBatch(
      [line({ label: "Chauffage fuel à air pulsé" })],
      carnet({ equipment: [heater({ name: "Chauffage Wallas 30DT" })] }),
    );
    expect(row?.outcome.kind).toBe("same");
  });

  it("uses a serial number when both sides carry one, whatever the family says", () => {
    const [row] = planBatch(
      [line({ serial: "W-4412", kindRef: "watermaker" })],
      carnet({ equipment: [heater({ serial: "w 4412" })] }),
    );
    expect(row?.outcome.kind).toBe("same");
  });

  it("does not guess between two of the same family", () => {
    const [row] = planBatch(
      [line({ brand: null })],
      carnet({
        equipment: [heater({ id: "eq-1", brand: null }), heater({ id: "eq-2", brand: null })],
      }),
    );
    // Two heaters aboard and nothing to tell them apart: a new line is honest, a guess is not.
    expect(row?.outcome.kind).toBe("create");
  });

  it("says nothing about a line with no family and no serial", () => {
    const [row] = planBatch([line({ kindRef: null })], carnet({ equipment: [heater()] }));
    expect(row?.outcome.kind).toBe("create");
  });
});

describe("when the document and the carnet disagree", () => {
  /** The heart of D113: shown side by side, and **not** ticked. */
  it("shows the difference and leaves it unchecked", () => {
    const [row] = planBatch(
      [line({ model: "30DT" })],
      carnet({ equipment: [heater({ model: "24GB" })] }),
    );
    expect(row?.outcome.kind).toBe("contradiction");
    if (row?.outcome.kind === "contradiction") {
      expect(row.outcome.divergences).toEqual([
        { field: "model", carnet: "24GB", document: "30DT" },
      ]);
      expect(row.outcome.targetId).toBe("eq-1");
    }
    expect(row?.checked, "a contradiction is never ticked").toBe(false);
  });

  /** Rule 6: « 2 » means one heater per hull, and a carnet holding one is missing half of them. */
  it("counts a quantity the carnet disagrees with as a difference", () => {
    const [row] = planBatch(
      [line({ quantity: 2 })],
      carnet({ equipment: [heater({ quantity: 1 })] }),
    );
    expect(row?.outcome.kind).toBe("contradiction");
    if (row?.outcome.kind === "contradiction") {
      expect(row.outcome.divergences).toContainEqual({
        field: "quantity",
        carnet: "1",
        document: "2",
      });
    }
  });

  /** A blank is not a disagreement — it is the one thing an old document is still good for. */
  it("offers to fill what the carnet never recorded", () => {
    const [row] = planBatch(
      [line({ model: "30DT", serial: "W-4412" })],
      carnet({ equipment: [heater({ model: null, serial: null })] }),
    );
    expect(row?.outcome.kind).toBe("fill");
    if (row?.outcome.kind === "fill") expect(row.outcome.fields).toEqual(["model", "serial"]);
    expect(row?.checked, "filling a blank is worth doing").toBe(true);
  });

  it("asks for nothing when the carnet already agrees", () => {
    const [row] = planBatch(
      [line({ model: "30DT" })],
      carnet({ equipment: [heater({ model: "30DT" })] }),
    );
    expect(row?.outcome.kind).toBe("same");
    expect(row?.checked, "ticking it would ask for a decision about nothing").toBe(false);
  });
});

describe("the status still decides, whatever the carnet says", () => {
  /** E17-1: only what the document vouches for arrives ticked, even when it would create. */
  it("leaves an option and a struck-out line unchecked", () => {
    const planned = planBatch(
      [line({ status: "optional" }), line({ status: "cancelled" }), line({ status: "unknown" })],
      EMPTY,
    );
    for (const row of planned) {
      expect(row.outcome.kind, row.line.status).toBe("create");
      expect(row.checked, row.line.status).toBe(false);
    }
  });

  it("ticks what a delivery note says is aboard, and what a quote says was retained", () => {
    const planned = planBatch([line({ status: "fitted" }), line({ status: "retained" })], EMPTY);
    expect(planned.every((row) => row.checked)).toBe(true);
  });
});

describe("providers and identity", () => {
  const provider = (over: Record<string, string | null> = {}) =>
    line({
      type: "provider",
      label: "Marsaudon Composites",
      kindRef: null,
      brand: null,
      provider: {
        name: "Marsaudon Composites",
        company: null,
        phone: null,
        email: null,
        address: null,
        ...over,
      },
    });

  it("recognises a provider by e-mail before anything else", () => {
    const [row] = planBatch(
      [provider({ name: "MARSAUDON", email: "contact@marsaudon.fr" })],
      carnet({
        contacts: [
          {
            id: "c-1",
            name: "Marsaudon Composites",
            company: null,
            email: "Contact@Marsaudon.FR",
            phone: null,
          },
        ],
      }),
    );
    expect(row?.outcome.kind).toBe("same");
  });

  it("recognises one by phone whatever the spacing", () => {
    const [row] = planBatch(
      [provider({ phone: "02 97 00 00 00" })],
      carnet({
        contacts: [
          { id: "c-1", name: "Autre nom", company: null, email: null, phone: "+33297000000" },
        ],
      }),
    );
    // Same digits, so the same provider — the fiche simply spells its name differently.
    expect(row?.outcome.kind).toBe("same");
  });

  it("shows a provider's contradiction rather than overwriting a fiche", () => {
    const [row] = planBatch(
      [provider({ email: "ancien@marsaudon.fr" })],
      carnet({
        contacts: [
          {
            id: "c-1",
            name: "Marsaudon Composites",
            company: null,
            email: "contact@marsaudon.fr",
            phone: null,
          },
        ],
      }),
    );
    expect(row?.outcome.kind).toBe("contradiction");
    expect(row?.checked).toBe(false);
  });

  it("fills an identity the boat never recorded, and never overwrites one it holds", () => {
    const hull = (value: string) =>
      line({
        type: "identity",
        label: "N° de coque",
        kindRef: null,
        brand: null,
        identityField: "hullNumber",
        identityValue: value,
      });

    const [blank] = planBatch([hull("ORC50-25")], EMPTY);
    expect(blank?.outcome.kind).toBe("create");
    expect(blank?.checked).toBe(true);

    const [held] = planBatch([hull("ORC50-25")], carnet({ identity: { hullNumber: "ORC50-25" } }));
    expect(held?.outcome.kind).toBe("same");

    const [other] = planBatch([hull("ORC50-25")], carnet({ identity: { hullNumber: "ORC50-12" } }));
    expect(other?.outcome.kind).toBe("contradiction");
    expect(other?.checked).toBe(false);
  });
});

describe("what the screen counts above the list", () => {
  it("tallies the batch the way the report will (E12-1)", () => {
    const planned = planBatch(
      [
        line({ label: "Neuf" }),
        line({ label: "Déjà là", model: "30DT" }),
        line({ label: "Contredit", model: "30DT" }),
        line({ label: "Option", status: "optional" }),
      ],
      carnet({
        equipment: [
          heater({ id: "eq-1", brand: "Wallas", model: "30DT" }),
          heater({ id: "eq-2", brand: "Webasto", model: "24GB" }),
        ],
      }),
    );
    const tally = tallyBatch(planned);
    expect(tally.create + tally.fill + tally.same + tally.contradiction).toBe(4);
    // Whatever the split, what is ticked never exceeds what is worth doing.
    expect(tally.checked).toBeLessThanOrEqual(tally.create + tally.fill);
  });
});
