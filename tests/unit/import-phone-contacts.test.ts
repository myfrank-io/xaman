import { describe, expect, it } from "vitest";

import { contactsToTable } from "@/lib/import/phone-contacts";
import { CONTACT_HEADERS } from "@/lib/import/vcard";

/**
 * The Contact Picker hands back lists, and every one of them may be empty, hold empty strings,
 * or hold something that is not a string at all. This is the only place those cards become
 * rows, and it runs on a phone we cannot drive from CI — so it is tested here rather than
 * discovered on the pontoon.
 */
describe("contacts picked from the phone", () => {
  it("produces the same table a .vcf produces", () => {
    const table = contactsToTable([
      { name: ["Chantier Naval du Guip"], tel: ["02 98 00 00 00"], email: ["contact@guip.fr"] },
    ]);
    expect(table.headers).toEqual(CONTACT_HEADERS);
    expect(table.delimiter).toBe("\t");
    expect(table.rows).toEqual([
      ["Chantier Naval du Guip", "", "", "02 98 00 00 00", "contact@guip.fr", "", ""],
    ]);
  });

  it("keeps the first usable value of each list and tolerates the empty ones", () => {
    const table = contactsToTable([
      { name: ["", "  ", "Yann Le Goff"], tel: ["", "06 00 00 00 01"], email: [] },
    ]);
    expect(table.rows).toEqual([["Yann Le Goff", "", "", "06 00 00 00 01", "", "", ""]]);
  });

  it("drops a card with no name: the name is what tells one provider from another", () => {
    const table = contactsToTable([
      { tel: ["06 00 00 00 02"] },
      { name: ["   "], tel: ["06 00 00 00 03"] },
      { name: ["Léa Bernard"] },
    ]);
    expect(table.rows).toEqual([["Léa Bernard", "", "", "", "", "", ""]]);
  });

  it("survives a browser that returns something other than strings", () => {
    const table = contactsToTable([
      { name: [42 as unknown as string, "Marc Petit"], tel: [null as unknown as string] },
    ]);
    expect(table.rows).toEqual([["Marc Petit", "", "", "", "", "", ""]]);
  });

  it("returns an empty table when nothing was picked", () => {
    expect(contactsToTable([]).rows).toEqual([]);
  });

  it("gives every row exactly as many cells as there are headers", () => {
    const table = contactsToTable([{ name: ["A"] }, { name: ["B"], tel: ["1"] }]);
    for (const row of table.rows) expect(row).toHaveLength(CONTACT_HEADERS.length);
  });
});
