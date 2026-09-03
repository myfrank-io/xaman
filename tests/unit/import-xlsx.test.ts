import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import {
  isLegacyExcelFile,
  isSpreadsheetFile,
  readWorkbook,
  serialToFrenchDate,
} from "@/lib/import/xlsx";
import { ZipError } from "@/lib/import/zip";

/**
 * A real `.xlsx` is built here rather than committed as a binary fixture: the reader is
 * hand-written, so the test has to prove it against bytes a spreadsheet would actually
 * produce — the ZIP container, the shared string table, the style-driven dates.
 *
 * Entries are written STORED (method 0) by default and DEFLATED (method 8) on demand, so
 * both branches of the reader are covered — including the one that hands the bytes to
 * `DecompressionStream`, which is what a workbook saved by Excel actually contains.
 * `unzip -t` accepts what this writer produces: the CRCs and the offsets are real.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Writes a ZIP: local headers, payloads, central directory, end record. */
function zip(files: Record<string, string>, options: { deflate?: boolean } = {}): ArrayBuffer {
  const encoder = new TextEncoder();
  const method = options.deflate ? 8 : 0;
  const entries = Object.entries(files).map(([name, content]) => {
    const plain = encoder.encode(content);
    return {
      name: encoder.encode(name),
      crc: crc32(plain),
      size: plain.length,
      data: options.deflate ? new Uint8Array(deflateRawSync(plain)) : plain,
    };
  });

  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const header = new Uint8Array(30 + entry.name.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true); // version needed
    view.setUint16(6, 0, true); // flags
    view.setUint16(8, method, true);
    view.setUint16(10, 0, true); // time
    view.setUint16(12, 0x21, true); // date: 1980-01-01
    view.setUint32(14, entry.crc, true);
    view.setUint32(18, entry.data.length, true);
    view.setUint32(22, entry.size, true);
    view.setUint16(26, entry.name.length, true);
    view.setUint16(28, 0, true); // extra
    header.set(entry.name, 30);
    local.push(header, entry.data);

    const directory = new Uint8Array(46 + entry.name.length);
    const dv = new DataView(directory.buffer);
    dv.setUint32(0, 0x02014b50, true);
    dv.setUint16(4, 20, true); // version made by
    dv.setUint16(6, 20, true); // version needed
    dv.setUint16(8, 0, true);
    dv.setUint16(10, method, true);
    dv.setUint16(12, 0, true);
    dv.setUint16(14, 0x21, true);
    dv.setUint32(16, entry.crc, true);
    dv.setUint32(20, entry.data.length, true);
    dv.setUint32(24, entry.size, true);
    dv.setUint16(28, entry.name.length, true);
    dv.setUint16(30, 0, true); // extra
    dv.setUint16(32, 0, true); // comment
    dv.setUint16(34, 0, true); // disk
    dv.setUint16(36, 0, true); // internal attrs
    dv.setUint32(38, 0, true); // external attrs
    dv.setUint32(42, offset, true);
    directory.set(entry.name, 46);
    central.push(directory);

    offset += header.length + entry.data.length;
  }

  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, entries.length, true);
  ev.setUint16(10, entries.length, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);

  const parts = [...local, ...central, end];
  const total = parts.reduce((size, part) => size + part.length, 0);
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of parts) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out.buffer;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
</Types>`;

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Stock" sheetId="1" r:id="rId1"/>
    <sheet name="Contacts" sheetId="2" r:id="rId2"/>
  </sheets>
</workbook>`;

const RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
</Relationships>`;

/** Entry 4 is written as two runs with a phonetic guide, the way Excel stores rich text. */
const SHARED_STRINGS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="8" uniqueCount="8">
  <si><t>Inventaire du bord</t></si>
  <si><t>D&#233;signation</t></si>
  <si><t>Quantit&#233;</t></si>
  <si><t>Install&#233; le</t></si>
  <si><r><t>Filtre </t></r><r><t>&#224; huile</t></r><rPh sb="0" eb="1"><t>ignor&#233;</t></rPh></si>
  <si><t>Nom</t></si>
  <si><t>Sp&#233;cialit&#233;</t></si>
  <si><t>Chantier</t></si>
</sst>`;

/** Style 1 = custom `dd/mm/yyyy`, style 2 = built-in date format 14, style 0 = general. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="2">
    <numFmt numFmtId="165" formatCode="dd/mm/yyyy"/>
    <numFmt numFmtId="166" formatCode="#,##0.00 &quot;&#8364;&quot;"/>
  </numFmts>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="4">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
    <xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
  </cellXfs>
</styleSheet>`;

/**
 * A1 carries a title alone above the real header; row 4 has no cell in column B; the last
 * column is a date, once through a custom format and once through a built-in one.
 */
const SHEET1 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>0</v></c></row>
    <row r="2"><c r="A2" t="s"><v>1</v></c><c r="B2" t="s"><v>2</v></c><c r="C2" t="s"><v>3</v></c></row>
    <row r="3"><c r="A3" t="s"><v>4</v></c><c r="B3"><v>2</v></c><c r="C3" s="1"><v>45678</v></c></row>
    <row r="4"><c r="A4" t="inlineStr"><is><t>Joint de vidange</t></is></c><c r="C4" s="2"><v>45000</v></c></row>
    <row r="5"><c r="A5" t="s"><v>4</v></c><c r="B5" s="3"><v>12.5</v></c><c r="C5" t="e"><v>#N/A</v></c></row>
  </sheetData>
</worksheet>`;

const SHEET2 = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1"><c r="A1" t="s"><v>5</v></c><c r="B1" t="s"><v>6</v></c></row>
    <row r="2"><c r="A2" t="str"><v>Chantier du Levant</v></c><c r="B2" t="s"><v>7</v></c></row>
  </sheetData>
</worksheet>`;

const PARTS: Record<string, string> = {
  "[Content_Types].xml": CONTENT_TYPES,
  "xl/workbook.xml": WORKBOOK,
  "xl/_rels/workbook.xml.rels": RELS,
  "xl/sharedStrings.xml": SHARED_STRINGS,
  "xl/styles.xml": STYLES,
  "xl/worksheets/sheet1.xml": SHEET1,
  "xl/worksheets/sheet2.xml": SHEET2,
};

function workbook(options?: { deflate?: boolean }): ArrayBuffer {
  return zip(PARTS, options);
}

describe("isSpreadsheetFile / isLegacyExcelFile", () => {
  it("recognises the formats that can and cannot be read", () => {
    expect(isSpreadsheetFile("Stock du bord.xlsx")).toBe(true);
    expect(isSpreadsheetFile("STOCK.XLSM")).toBe(true);
    expect(isSpreadsheetFile("stock.csv")).toBe(false);
    expect(isSpreadsheetFile("stock.xls")).toBe(false);
    expect(isLegacyExcelFile("stock.xls")).toBe(true);
    expect(isLegacyExcelFile("stock.xlsx")).toBe(false);
  });
});

describe("serialToFrenchDate", () => {
  it("counts days from 1899-12-30", () => {
    expect(serialToFrenchDate(45678)).toBe("21/01/2025");
    expect(serialToFrenchDate(45292)).toBe("01/01/2024");
    // The 1904 workbooks of the old Macs are 1462 days behind.
    expect(serialToFrenchDate(45678 - 1462, true)).toBe("21/01/2025");
  });

  it("leaves an impossible serial alone rather than inventing a date", () => {
    expect(serialToFrenchDate(0)).toBe("0");
    expect(serialToFrenchDate(-5)).toBe("-5");
  });
});

describe("readWorkbook", () => {
  it("reads shared strings, dates, numbers and sparse rows of the first sheet", async () => {
    const sheets = await readWorkbook(workbook());
    const stock = sheets[0];

    expect(stock?.name).toBe("Stock");
    // The lone title in A1 is dropped: the header is the first line that fills the table.
    expect(stock?.table.headers).toEqual(["Désignation", "Quantité", "Installé le"]);
    expect(stock?.table.rows).toEqual([
      // runs joined, phonetic guide left out; custom dd/mm/yyyy style read as a date
      ["Filtre à huile", "2", "21/01/2025"],
      // no cell in column B: the row is padded, not shifted; built-in format 14 is a date too
      ["Joint de vidange", "", "15/03/2023"],
      // a currency format is not a date, and #N/A is the absence of a value
      ["Filtre à huile", "12.5", ""],
    ]);
  });

  it("returns every sheet with its name", async () => {
    const sheets = await readWorkbook(workbook());
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Stock", "Contacts"]);
    expect(sheets[1]?.table.headers).toEqual(["Nom", "Spécialité"]);
    expect(sheets[1]?.table.rows).toEqual([["Chantier du Levant", "Chantier"]]);
  });

  it("reads a deflated workbook, the way Excel actually saves one", async () => {
    const sheets = await readWorkbook(workbook({ deflate: true }));
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Stock", "Contacts"]);
    expect(sheets[0]?.table.headers).toEqual(["Désignation", "Quantité", "Installé le"]);
    expect(sheets[0]?.table.rows[0]).toEqual(["Filtre à huile", "2", "21/01/2025"]);
  });

  it("falls back to the conventional sheet path when the relationships are missing", async () => {
    const withoutRels = Object.fromEntries(
      Object.entries(PARTS).filter(([name]) => !name.includes("_rels")),
    );
    const sheets = await readWorkbook(zip(withoutRels));
    expect(sheets.map((sheet) => sheet.name)).toEqual(["Stock", "Contacts"]);
  });

  it("refuses a file that is not a ZIP with a code the screen can translate", async () => {
    const notAZip = new TextEncoder().encode("Nom;Spécialité\nChantier;Chantier").buffer;
    await expect(readWorkbook(notAZip as ArrayBuffer)).rejects.toThrow(ZipError);
    await expect(readWorkbook(notAZip as ArrayBuffer)).rejects.toThrow("not_a_zip");
  });

  it("refuses a ZIP that is not a workbook", async () => {
    const other = zip({ "photos/pont.txt": "rien à voir" });
    await expect(readWorkbook(other)).rejects.toThrow("not_a_workbook");
  });

  it("refuses a workbook whose sheets are all missing", async () => {
    const empty = zip({
      "[Content_Types].xml": CONTENT_TYPES,
      "xl/workbook.xml": WORKBOOK,
      "xl/_rels/workbook.xml.rels": RELS,
    });
    await expect(readWorkbook(empty)).rejects.toThrow("no_sheet");
  });
});
