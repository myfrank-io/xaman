import { describe, expect, it } from "vitest";

import { parseTable, sniffDelimiter } from "@/lib/import/parse";
import {
  applyDefaults,
  applyMapping,
  guessMapping,
  missingRequired,
  normaliseHeader,
  type FieldDescriptor,
} from "@/lib/import/mapping";

describe("sniffDelimiter", () => {
  it("recognises the separator of a French Excel export", () => {
    expect(sniffDelimiter("Nom;Téléphone\nChantier;0102")).toBe(";");
  });

  it("recognises a comma file and a tab paste", () => {
    expect(sniffDelimiter("Nom,Téléphone\nChantier,0102")).toBe(",");
    expect(sniffDelimiter("Nom\tTéléphone\nChantier\t0102")).toBe("\t");
  });

  it("falls back to the comma on a single column", () => {
    expect(sniffDelimiter("Nom\nChantier")).toBe(",");
  });
});

describe("parseTable", () => {
  it("reads headers and rows and pads a short row", () => {
    const table = parseTable(
      "Nom;Spécialité;Téléphone\nChantier Bleu;Chantier;0102\nVoilerie;Voilier",
    );
    expect(table.headers).toEqual(["Nom", "Spécialité", "Téléphone"]);
    expect(table.rows).toEqual([
      ["Chantier Bleu", "Chantier", "0102"],
      ["Voilerie", "Voilier", ""],
    ]);
  });

  it("keeps a separator and a newline inside a quoted cell", () => {
    const table = parseTable('Nom,Notes\n"Chantier, Bleu","Ligne 1\nLigne 2"');
    expect(table.rows[0]).toEqual(["Chantier, Bleu", "Ligne 1\nLigne 2"]);
  });

  it("reads an escaped quote", () => {
    const table = parseTable('Nom\n"Le ""Bleu"""');
    expect(table.rows[0]).toEqual(['Le "Bleu"']);
  });

  it("strips the byte order mark Excel writes and ignores blank lines", () => {
    const table = parseTable("﻿Nom;Ville\n\nChantier;Hyères\n\n");
    expect(table.headers).toEqual(["Nom", "Ville"]);
    expect(table.rows).toEqual([["Chantier", "Hyères"]]);
  });

  it("returns nothing for an empty paste", () => {
    expect(parseTable("   ")).toEqual({ headers: [], rows: [], delimiter: "," });
  });

  it("handles CRLF line endings", () => {
    const table = parseTable("Nom;Ville\r\nChantier;Hyères\r\n");
    expect(table.rows).toEqual([["Chantier", "Hyères"]]);
  });
});

const FIELDS: FieldDescriptor[] = [
  { key: "name", label: "Nom", required: true, aliases: ["intitulé"] },
  { key: "specialty", label: "Spécialité", required: true, allowDefault: true },
  { key: "phone", label: "Téléphone", aliases: ["tel", "mobile"] },
  { key: "email", label: "E-mail", aliases: ["mail", "courriel"] },
];

describe("guessMapping", () => {
  it("ignores case, accents and punctuation", () => {
    const mapping = guessMapping(["NOM", "specialite", "Tél.", "E-Mail"], FIELDS);
    expect(mapping).toEqual({ name: 0, specialty: 1, phone: 2, email: 3 });
  });

  it("matches a header that starts with the field name", () => {
    const mapping = guessMapping(["Nom du contact", "Spécialité principale"], FIELDS);
    expect(mapping.name).toBe(0);
    expect(mapping.specialty).toBe(1);
  });

  it("uses an alias and never takes the same column twice", () => {
    const mapping = guessMapping(["Intitulé", "Mobile"], FIELDS);
    expect(mapping).toEqual({ name: 0, specialty: null, phone: 1, email: null });
  });

  it("leaves a field unmapped when no column matches", () => {
    expect(guessMapping(["Colonne A", "Colonne B"], FIELDS).name).toBeNull();
  });
});

describe("applyMapping and missingRequired", () => {
  it("builds the field values of a row", () => {
    const mapping = guessMapping(["Nom", "Spécialité", "Tel"], FIELDS);
    expect(applyMapping(["Chantier Bleu", "Chantier", "0102"], FIELDS, mapping)).toEqual({
      name: "Chantier Bleu",
      specialty: "Chantier",
      phone: "0102",
      email: "",
    });
  });

  it("names the required fields still unmapped", () => {
    expect(missingRequired(FIELDS, guessMapping(["Nom"], FIELDS), {})).toEqual(["Spécialité"]);
    expect(missingRequired(FIELDS, guessMapping(["Nom", "Spécialité"], FIELDS), {})).toEqual([]);
  });

  it("stops naming a required field once a value is chosen for the whole file", () => {
    const mapping = guessMapping(["Nom"], FIELDS);
    expect(missingRequired(FIELDS, mapping, { specialty: "Chantier" })).toEqual([]);
    // Blanks are not a value: they must not unlock the import.
    expect(missingRequired(FIELDS, mapping, { specialty: "   " })).toEqual(["Spécialité"]);
    // A field the descriptor does not open to a default is never satisfied this way.
    expect(missingRequired(FIELDS, guessMapping(["Spécialité"], FIELDS), { name: "X" })).toEqual([
      "Nom",
    ]);
  });
});

describe("applyDefaults", () => {
  it("fills only the blanks, and only where the descriptor allows it", () => {
    const values = { name: "Chantier Bleu", specialty: "", phone: "", email: "" };
    expect(applyDefaults(values, FIELDS, { specialty: "Chantier", phone: "0102" })).toEqual({
      name: "Chantier Bleu",
      specialty: "Chantier",
      // phone has no allowDefault: the value chosen for the file is ignored
      phone: "",
      email: "",
    });
  });

  it("never overwrites a cell the file already carries", () => {
    const values = { name: "Voilerie", specialty: "Voilier", phone: "", email: "" };
    expect(applyDefaults(values, FIELDS, { specialty: "Chantier" }).specialty).toBe("Voilier");
    // A cell holding only spaces is empty, and a default made of spaces is no default.
    expect(
      applyDefaults({ ...values, specialty: "  " }, FIELDS, { specialty: "Chantier" }).specialty,
    ).toBe("Chantier");
    expect(applyDefaults({ ...values, specialty: "" }, FIELDS, { specialty: " " }).specialty).toBe(
      "",
    );
  });
});

describe("normaliseHeader", () => {
  it("folds accents, case and punctuation", () => {
    expect(normaliseHeader("Quantité (en stock)")).toBe("quantiteenstock");
    expect(normaliseHeader("  N° de série ")).toBe("ndeserie");
  });
});
