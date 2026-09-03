import { describe, expect, it } from "vitest";

import {
  cellPurchaseKind,
  descriptorOf,
  rejectionReason,
  type ImportRow,
} from "@/lib/import/entities";
import { guessMapping, applyMapping } from "@/lib/import/mapping";
import { parseTable } from "@/lib/import/parse";

/**
 * Importing the two dated lists (E12-4): the interventions, which are the boat's history, and
 * the purchases, which are what it cost. Both are recognised by wording AND date, so a
 * spreadsheet re-imported after a correction corrects instead of duplicating.
 */

const logs = descriptorOf("logs");
const purchases = descriptorOf("purchases");

function row(values: Partial<Record<string, string>>): ImportRow {
  return values as ImportRow;
}

describe("interventions: recognising a line already on the boat", () => {
  it("keeps two identical titles on different dates apart", () => {
    const june = logs.naturalKey(row({ name: "Vidange moteur", date: "14/06/2026" }));
    const october = logs.naturalKey(row({ name: "Vidange moteur", date: "02/10/2026" }));
    expect(june).not.toBe(october);
  });

  it("matches the same intervention however the title is cased or accented", () => {
    const a = logs.naturalKey(row({ name: "Vidange Moteur Bâbord", date: "14/06/2026" }));
    const b = logs.naturalKey(row({ name: "vidange moteur babord", date: "2026-06-14" }));
    expect(a).toBe(b);
  });

  it("prefers the file's own reference over the title and the date", () => {
    const first = logs.naturalKey(
      row({ name: "Vidange", date: "14/06/2026", reference: "F-2026-0142" }),
    );
    const renamed = logs.naturalKey(
      row({
        name: "Vidange complète des deux moteurs",
        date: "15/06/2026",
        reference: "F-2026-0142",
      }),
    );
    expect(renamed).toBe(first);
  });

  it("finds the row already in the database through the same key", () => {
    const fromFile = logs.naturalKey(row({ name: "Anodes de safran", date: "03/04/2026" }));
    const fromDatabase = logs.existingKey({
      id: "x",
      title: "Anodes de safran",
      performed_at: "2026-04-03",
      external_ref: null,
    });
    expect(fromDatabase).toBe(fromFile);
  });

  it("matches on the reference on both sides", () => {
    const fromFile = logs.naturalKey(
      row({ name: "Peu importe", date: "01/01/2026", reference: "AD-88213" }),
    );
    const fromDatabase = logs.existingKey({
      id: "x",
      title: "Autre libellé",
      performed_at: "2020-01-01",
      external_ref: "AD-88213",
    });
    expect(fromDatabase).toBe(fromFile);
  });
});

describe("interventions: what is refused", () => {
  it("refuses a line with no title", () => {
    expect(rejectionReason("logs", row({ name: "  ", date: "14/06/2026" }))).toBe(
      "import.errors.noName",
    );
  });

  it("refuses a line with no date: undated it has no place in the history", () => {
    expect(rejectionReason("logs", row({ name: "Vidange", date: "" }))).toBe(
      "import.errors.noDate",
    );
  });

  it("refuses an unreadable date", () => {
    expect(rejectionReason("logs", row({ name: "Vidange", date: "le 14 juin" }))).toBe(
      "import.errors.badDate",
    );
  });

  it("refuses an unreadable cost but accepts an empty one", () => {
    const base = { name: "Vidange", date: "14/06/2026" };
    expect(rejectionReason("logs", row({ ...base, cost: "gratuit" }))).toBe(
      "import.errors.badAmount",
    );
    expect(rejectionReason("logs", row({ ...base, cost: "" }))).toBeNull();
    expect(rejectionReason("logs", row({ ...base, cost: "1 348,50" }))).toBeNull();
  });

  // Migration 0004 removed `maintenance_logs.next_due_at` on purpose: a next due date belongs
  // to the checklist, not to a line of history. The import must not offer to fill it.
  it("does not offer a « prochaine échéance » column", () => {
    expect(logs.fields.map((field) => field.key)).not.toContain("nextDate");
  });
});

describe("purchases", () => {
  it("requires an amount: a purchase with no amount is not an expense", () => {
    expect(rejectionReason("purchases", row({ name: "Filtre", date: "02/06/2026" }))).toBe(
      "import.errors.noAmount",
    );
    expect(
      rejectionReason("purchases", row({ name: "Filtre", date: "02/06/2026", amount: "42,90" })),
    ).toBeNull();
  });

  it("reads the designation and the purchase date as its key", () => {
    const fromFile = purchases.naturalKey(row({ name: "Filtre à huile", date: "02/06/2026" }));
    const fromDatabase = purchases.existingKey({
      id: "x",
      designation: "Filtre à huile",
      purchased_at: "2026-06-02",
      external_ref: null,
    });
    expect(fromDatabase).toBe(fromFile);
  });

  it("files a type it can read, and « Autre » for one it cannot", () => {
    expect(cellPurchaseKind("Pièce")).toBe("part");
    expect(cellPurchaseKind("pieces detachees")).toBe("part");
    expect(cellPurchaseKind("Gaz")).toBe("gas");
    expect(cellPurchaseKind("Prestation")).toBe("service");
    expect(cellPurchaseKind("Consommable")).toBe("consumable");
    expect(cellPurchaseKind("")).toBe("other");
    expect(cellPurchaseKind("n'importe quoi")).toBe("other");
  });
});

describe("a real export lands on the right fields", () => {
  it("maps a bank-style purchase export without a single choice to make", () => {
    const table = parseTable(
      [
        "Date;Libellé;Montant;Fournisseur",
        "02/06/2026;Filtre à huile Volvo;42,90;Accastillage Diffusion",
        "14/06/2026;Gasoil 120 L;198,00;Port de Lorient",
      ].join("\r\n"),
    );
    const mapping = guessMapping(table.headers, purchases.fields);
    const mapped = table.rows.map((cells) => applyMapping(cells, purchases.fields, mapping));

    expect(table.delimiter).toBe(";");
    expect(mapped).toHaveLength(2);
    expect(mapped[0]).toMatchObject({
      name: "Filtre à huile Volvo",
      date: "02/06/2026",
      amount: "42,90",
      supplier: "Accastillage Diffusion",
    });
    expect(mapped.every((line) => rejectionReason("purchases", line) === null)).toBe(true);
  });

  it("maps an intervention sheet whose headers are worded differently", () => {
    const table = parseTable(
      ["Travaux\tRéalisée le\tPar\tPrix", "Contrôle du gréement\t12/03/2026\tVoilerie\t980"].join(
        "\n",
      ),
    );
    const mapping = guessMapping(table.headers, logs.fields);
    const [line] = table.rows.map((cells) => applyMapping(cells, logs.fields, mapping));

    expect(line).toMatchObject({
      name: "Contrôle du gréement",
      date: "12/03/2026",
      provider: "Voilerie",
      cost: "980",
    });
    expect(rejectionReason("logs", line ?? {})).toBeNull();
  });
});

describe("imported history is never taken on trust", () => {
  it("marks both dated lists for review, and the reference lists not", () => {
    expect(logs.needsReview).toBe(true);
    expect(purchases.needsReview).toBe(true);
    expect(descriptorOf("contacts").needsReview).toBeUndefined();
  });

  it("skips trashed rows when matching, so a deliberate deletion is not revived", () => {
    expect(logs.softDeleted).toBe(true);
    expect(purchases.softDeleted).toBe(true);
    expect(descriptorOf("equipment").softDeleted).toBeUndefined();
  });
});
