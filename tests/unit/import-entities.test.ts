import { describe, expect, it } from "vitest";

import {
  cellDate,
  cellNumber,
  cellText,
  descriptorOf,
  isImportEntity,
} from "@/lib/import/entities";
import { guessMapping } from "@/lib/import/mapping";

describe("cellText", () => {
  it("treats an empty cell, a dash and n/a as nothing", () => {
    expect(cellText("", 10)).toBeNull();
    expect(cellText("   ", 10)).toBeNull();
    expect(cellText("-", 10)).toBeNull();
    expect(cellText("N/A", 10)).toBeNull();
    expect(cellText(undefined, 10)).toBeNull();
  });

  it("trims and truncates to the column length", () => {
    expect(cellText("  Chantier  ", 20)).toBe("Chantier");
    expect(cellText("abcdefghij", 4)).toBe("abcd");
  });
});

describe("cellNumber", () => {
  it("reads the French comma and thin spaces", () => {
    expect(cellNumber("1 256,5")).toBe(1256.5);
    expect(cellNumber("12")).toBe(12);
    expect(cellNumber("0")).toBe(0);
  });

  it("returns null for an empty or unreadable cell", () => {
    expect(cellNumber("")).toBeNull();
    expect(cellNumber("deux")).toBeNull();
    expect(cellNumber(undefined)).toBeNull();
  });
});

describe("cellDate", () => {
  it("reads the French and ISO spellings", () => {
    expect(cellDate("12/03/2026")).toBe("2026-03-12");
    expect(cellDate("1.3.2026")).toBe("2026-03-01");
    expect(cellDate("12-03-26")).toBe("2026-03-12");
    expect(cellDate("2026-03-12")).toBe("2026-03-12");
  });

  it("refuses a date that does not exist or cannot be read", () => {
    expect(cellDate("31/02/2026")).toBeNull();
    expect(cellDate("le 12 mars")).toBeNull();
    expect(cellDate("2026-13-01")).toBeNull();
    expect(cellDate("")).toBeNull();
  });
});

describe("descriptors", () => {
  it("knows the three importable lists", () => {
    expect(isImportEntity("contacts")).toBe(true);
    expect(isImportEntity("parts")).toBe(true);
    expect(isImportEntity("boats")).toBe(false);
  });

  it("marks a name as required everywhere, so a nameless row is refused", () => {
    for (const entity of ["contacts", "equipment", "parts"] as const) {
      const descriptor = descriptorOf(entity);
      expect(descriptor.fields.find((field) => field.key === "name")?.required).toBe(true);
    }
  });

  it("maps the headers a person actually types", () => {
    const contacts = descriptorOf("contacts");
    expect(guessMapping(["Nom", "Métier", "Tél", "Mail"], contacts.fields)).toMatchObject({
      name: 0,
      specialty: 1,
      phone: 2,
      email: 3,
    });
    const parts = descriptorOf("parts");
    expect(guessMapping(["Désignation", "Réf", "Stock", "Stock mini"], parts.fields)).toMatchObject(
      {
        name: 0,
        reference: 1,
        quantity: 2,
        minQuantity: 3,
      },
    );
  });

  it("keys a line on its name so a re-import updates instead of duplicating", () => {
    const contacts = descriptorOf("contacts");
    expect(contacts.naturalKey({ name: "Chantier du Levant" })).toBe(
      contacts.naturalKey({ name: "  chantier du levant " }),
    );
  });
});
