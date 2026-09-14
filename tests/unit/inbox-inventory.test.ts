import { describe, expect, it } from "vitest";

import { confidentItems, isConfidentItem } from "../../src/components/inbox/inbox-draft";
import { cellSpecs, descriptorOf } from "../../src/lib/import/entities";
import { inventoryToTable, specsText } from "../../src/lib/inbox/inventory";
import { inventoryLineSchema, parseSuggestion } from "../../src/lib/schemas/inbox";

const CATEGORIES = [
  { id: "cat-sails", name: "Voiles & Gréement" },
  { id: "cat-energy", name: "Énergie" },
];

function line(over: Partial<Record<string, unknown>> = {}) {
  return inventoryLineSchema.parse({
    name: "Grand-voile (GV)",
    brand: "Incidence",
    model: null,
    serial: null,
    quantity: 1,
    categoryId: "cat-sails",
    installedAt: "2019-05-01",
    specs: [
      { key: "surface_m2", value: "88" },
      { key: "tissu", value: "Hydranet" },
    ],
    ...over,
  });
}

describe("la colonne des caractéristiques", () => {
  it("est déclarée par l'import des équipements", () => {
    const fields = descriptorOf("equipment").fields.map((field) => field.key);
    expect(fields).toContain("specs");
  });

  it("lit les paires comme le document les écrit", () => {
    expect(cellSpecs("surface_m2: 88 ; tissu: Hydranet")).toEqual({
      surface_m2: "88",
      tissu: "Hydranet",
    });
    // Un `=` vaut un `:`, et une ligne vaut un `;`.
    expect(cellSpecs("puissance_w = 990\nemplacement: Sur bossoirs")).toEqual({
      puissance_w: "990",
      emplacement: "Sur bossoirs",
    });
  });

  it("plie les clés sur la forme du carnet", () => {
    expect(cellSpecs("Surface m2: 88")).toEqual({ surface_m2: "88" });
    expect(cellSpecs("  CAPACITÉ AH : 210 ")).toEqual({ capacit_ah: "210" });
  });

  it("laisse tomber une demi-paire, et ne garde que la première d'un doublon", () => {
    expect(cellSpecs("surface_m2")).toEqual({});
    expect(cellSpecs("tissu:")).toEqual({});
    expect(cellSpecs(":88")).toEqual({});
    expect(cellSpecs("tissu: Hydranet ; tissu: Dacron")).toEqual({ tissu: "Hydranet" });
    expect(cellSpecs(undefined)).toEqual({});
  });

  it("s'arrête à vingt paires", () => {
    const many = Array.from({ length: 30 }, (_, i) => `k${i}: ${i}`).join(" ; ");
    expect(Object.keys(cellSpecs(many))).toHaveLength(20);
  });
});

describe("un document lu comme un inventaire", () => {
  it("arrive dans la table que l'import sait déjà lire", () => {
    const table = inventoryToTable([line()], CATEGORIES);
    const [header, row] = table.split("\n");
    const labels = descriptorOf("equipment").fields.map((field) => field.label);
    expect(header?.split("\t")).toEqual(labels);
    expect(row?.split("\t")).toEqual([
      "Grand-voile (GV)",
      "Voiles & Gréement",
      "Incidence",
      "",
      "",
      "1",
      "2019-05-01",
      "surface_m2: 88 ; tissu: Hydranet",
      "",
    ]);
  });

  it("fait l'aller-retour : ce que la table écrit, la colonne le relit", () => {
    const written = specsText(line().specs);
    expect(cellSpecs(written)).toEqual({ surface_m2: "88", tissu: "Hydranet" });
  });

  it("ne laisse pas une valeur casser la table", () => {
    const table = inventoryToTable(
      [line({ name: "Voile\tavec\ttabulations", brand: "Deux\nlignes" })],
      CATEGORIES,
    );
    expect(table.split("\n")).toHaveLength(2);
    expect(table.split("\n")[1]?.split("\t")[0]).toBe("Voile avec tabulations");
  });

  it("laisse la case vide quand le système n'est pas celui du bateau", () => {
    const table = inventoryToTable([line({ categoryId: "cat-inconnue" })], CATEGORIES);
    expect(table.split("\n")[1]?.split("\t")[1]).toBe("");
  });

  it("relit une suggestion écrite avant l'inventaire sans se plaindre", () => {
    const before = {
      documentType: "receipt",
      kind: "purchase",
      purchaseKind: "part",
      title: "Filtre",
      date: "2026-01-02",
      amount: 12,
      currency: "EUR",
      supplierName: null,
      contactId: null,
      categoryId: null,
      engineHours: [],
      lineItems: [],
      notes: null,
      confidence: "high",
      warnings: [],
    };
    expect(parseSuggestion(before)?.inventory).toEqual([]);
  });
});

describe("un inventaire ne se range pas tout seul", () => {
  const item = {
    id: "00000000-0000-4000-8000-000000009007",
    status: "ready",
    error: null,
    suggestion: parseSuggestion({
      documentType: "other",
      kind: "inventory",
      purchaseKind: "service",
      title: "Inventaire de livraison",
      date: "2026-09-01",
      amount: null,
      currency: null,
      supplierName: "Chantier Naval de la Ciotat",
      supplier: {
        name: "Chantier Naval de la Ciotat",
        company: null,
        phone: null,
        email: null,
        address: null,
      },
      contactId: null,
      // Renseignée : c'est le cas qui compte. Sans elle, le schéma refuserait déjà la ligne, et
      // la garde passerait inaperçue jusqu'au jour où le modèle propose une catégorie.
      categoryId: "00000000-0000-4000-8000-0000000000c8",
      engineHours: [],
      lineItems: [],
      notes: null,
      checklistItemId: null,
      validUntil: null,
      confidence: "high",
      inventory: [line()],
      warnings: [],
    }),
  } as unknown as Parameters<typeof isConfidentItem>[0];

  it("reste hors de « Tout valider »", () => {
    const options = { boatId: "00000000-0000-4000-8000-000000000001", engineIds: [] };
    expect(isConfidentItem(item, options)).toBe(false);
    expect(confidentItems([item], options)).toEqual([]);
  });
});
