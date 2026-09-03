import { describe, expect, it } from "vitest";

import { isContactCardFile, parseContactCards } from "@/lib/import/vcard";

/**
 * The cards below are the shapes real address books export: an Apple card that groups its
 * lines (`item1.TEL`), an Android vCard 2.1 with quoted-printable accents, a card with no
 * `FN` at all. Written with CRLF, which is what the format prescribes and what phones write.
 */
const HEADERS = ["Nom", "Spécialité", "Société", "Téléphone", "E-mail", "Adresse", "Notes"];

function card(...lines: string[]): string {
  return ["BEGIN:VCARD", ...lines, "END:VCARD"].join("\r\n");
}

const APPLE = card(
  "VERSION:3.0",
  "N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Lesaffre;Herv=C3=A9;;;",
  "FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:Herv=C3=A9 Lesaffre",
  "ORG:Chantier Naval du Guip;Atelier bois",
  "TITLE:Chantier",
  "item1.TEL;TYPE=CELL:+33 6 12 34 56 78",
  "TEL;TYPE=WORK:02 98 00 00 00",
  "EMAIL;TYPE=WORK:contact@leguip.fr",
  "ADR;TYPE=WORK:;;2 quai de la Douane;Brest;;29200;France",
  // Folded: the value was cut in two and the continuation marked by one leading space, so
  // the space of « révision annuelle » is written twice to survive the unfolding.
  "NOTE:Gréement et charpente\\, révision",
  "  annuelle",
);

const ANDROID = card(
  "VERSION:2.1",
  "N:Marin;Xavier;;;",
  "ORG:Voilerie du Ponant",
  "TEL;TYPE=WORK:04 94 00 00 00",
  "TEL;TYPE=CELL:06 11 22 33 44",
);

const NAMELESS = card("VERSION:3.0", "EMAIL:orphelin@example.com");

describe("isContactCardFile", () => {
  it("recognises the address-book exports and nothing else", () => {
    expect(isContactCardFile("Contacts.vcf")).toBe(true);
    expect(isContactCardFile("herve.VCARD")).toBe(true);
    expect(isContactCardFile("contacts.csv")).toBe(false);
    expect(isContactCardFile("contacts.xlsx")).toBe(false);
  });
});

describe("parseContactCards", () => {
  it("produces the headers of the contacts descriptor", () => {
    const table = parseContactCards(APPLE);
    expect(table.headers).toEqual(HEADERS);
    expect(table.delimiter).toBe("\t");
  });

  it("reads a card with folded lines, quoted-printable and an Apple group", () => {
    const table = parseContactCards(APPLE);
    expect(table.rows).toHaveLength(1);
    expect(table.rows[0]).toEqual([
      // quoted-printable decoded as UTF-8, not as latin-1
      "Hervé Lesaffre",
      // TITLE is what the person does
      "Chantier",
      // ORG is company;department
      "Chantier Naval du Guip — Atelier bois",
      // the grouped item1.TEL is a TEL, and TYPE=CELL wins over TYPE=WORK
      "+33 6 12 34 56 78",
      "contact@leguip.fr",
      // ADR is pobox;extended;street;locality;region;postcode;country
      "2 quai de la Douane, 29200 Brest, France",
      // the folded NOTE is one value again, and an escaped comma is a real comma
      "Gréement et charpente, révision annuelle",
    ]);
  });

  it("falls back to the structured name when the card carries no FN", () => {
    const table = parseContactCards(ANDROID);
    expect(table.rows[0]?.[0]).toBe("Xavier Marin");
    expect(table.rows[0]?.[2]).toBe("Voilerie du Ponant");
    // the mobile is preferred over the landline whatever the order in the file
    expect(table.rows[0]?.[3]).toBe("06 11 22 33 44");
    // nothing on the card says the trade: the screen offers a value for the whole file
    expect(table.rows[0]?.[1]).toBe("");
  });

  it("drops a card that has no name at all", () => {
    expect(parseContactCards(NAMELESS).rows).toEqual([]);
  });

  it("reads a file holding several cards, byte order mark included", () => {
    const table = parseContactCards(`﻿${[APPLE, ANDROID, NAMELESS].join("\r\n")}\r\n`);
    expect(table.rows.map((row) => row[0])).toEqual(["Hervé Lesaffre", "Xavier Marin"]);
  });

  it("returns an empty table for a file that is not a contact card", () => {
    expect(parseContactCards("Nom;Téléphone\nChantier;0102").rows).toEqual([]);
  });
});
