/**
 * Reading an Excel workbook (E12-5).
 *
 * The rule of the project is that everywhere data is stored, it must be possible to import it
 * — and on a boat the data is in an `.xlsx`. This turns one into the same headers-and-rows
 * table the CSV path produces, so mapping, preview and writing are shared.
 *
 * Handled because a real workbook has them: several sheets, shared strings, dates stored as
 * serial numbers, a title typed above the header row, empty leading columns. Not handled,
 * on purpose: formulas (their last computed value is read), charts, merged-cell geometry,
 * and the `.xls` binary format of Excel 97.
 */

import { type ParsedTable } from "@/lib/import/parse";
import { xmlEvents } from "@/lib/import/xml";
import { openZip, ZipError, type ZipArchive } from "@/lib/import/zip";

export { ZipError };

export type Sheet = {
  name: string;
  table: ParsedTable;
};

/** A workbook that would freeze an iPad is refused with a message, not left to hang. */
export const XLSX_MAX_CELLS = 200_000;

export function isSpreadsheetFile(name: string): boolean {
  return /\.(xlsx|xlsm)$/i.test(name);
}

/** True for the old binary Excel format, which cannot be read and needs its own message. */
export function isLegacyExcelFile(name: string): boolean {
  return /\.xls$/i.test(name);
}

export async function readWorkbook(buffer: ArrayBuffer): Promise<Sheet[]> {
  const zip = await openZip(buffer);
  if (!zip.names.some((name) => name.startsWith("xl/"))) throw new ZipError("not_a_workbook");

  const [sharedStrings, styles, workbook] = await Promise.all([
    zip.text("xl/sharedStrings.xml").then((xml) => (xml ? readSharedStrings(xml) : [])),
    zip.text("xl/styles.xml").then((xml) => (xml ? readDateStyles(xml) : new Set<number>())),
    zip.text("xl/workbook.xml"),
  ]);

  const { sheets, date1904 } = workbook
    ? readWorkbookIndex(workbook)
    : { sheets: [], date1904: false };
  const targets = await readRelationships(zip);

  const found: Sheet[] = [];
  for (const sheet of sheets) {
    const path = resolveSheetPath(sheet.relationshipId, targets, zip, found.length);
    if (!path) continue;
    const xml = await zip.text(path);
    if (xml === null) continue;
    found.push({ name: sheet.name, table: readSheet(xml, sharedStrings, styles, date1904) });
  }

  if (found.length === 0) throw new ZipError("no_sheet");
  return found;
}

// ---------------------------------------------------------------------------- workbook index

type SheetRef = { name: string; relationshipId: string; hidden: boolean };

function readWorkbookIndex(xml: string): { sheets: SheetRef[]; date1904: boolean } {
  const sheets: SheetRef[] = [];
  let date1904 = false;
  for (const event of xmlEvents(xml)) {
    if (event.kind !== "open") continue;
    if (event.name === "workbookPr") {
      const flag = event.attrs.date1904 ?? "";
      date1904 = flag === "1" || flag === "true";
    }
    if (event.name === "sheet") {
      sheets.push({
        name: event.attrs.name ?? "",
        relationshipId: event.attrs.id ?? "",
        hidden: (event.attrs.state ?? "") !== "" && event.attrs.state !== "visible",
      });
    }
  }
  // A hidden sheet is hidden for a reason; it is only used when the workbook has nothing else.
  const visible = sheets.filter((sheet) => !sheet.hidden);
  return { sheets: visible.length > 0 ? visible : sheets, date1904 };
}

async function readRelationships(zip: ZipArchive): Promise<Map<string, string>> {
  const xml = await zip.text("xl/_rels/workbook.xml.rels");
  const targets = new Map<string, string>();
  if (!xml) return targets;
  for (const event of xmlEvents(xml)) {
    if (event.kind === "open" && event.name === "Relationship") {
      const id = event.attrs.Id ?? "";
      const target = event.attrs.Target ?? "";
      if (id !== "" && target !== "") targets.set(id, normalisePath(target));
    }
  }
  return targets;
}

/** `worksheets/sheet1.xml` and `/xl/worksheets/sheet1.xml` both mean the same part. */
function normalisePath(target: string): string {
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target}`;
  return path.replace(/\/\.\//g, "/");
}

function resolveSheetPath(
  relationshipId: string,
  targets: Map<string, string>,
  zip: ZipArchive,
  index: number,
): string | null {
  const mapped = targets.get(relationshipId);
  if (mapped && zip.has(mapped)) return mapped;
  // Numbers and a few exporters skip the relationship part; the conventional name still works.
  const guess = `xl/worksheets/sheet${index + 1}.xml`;
  return zip.has(guess) ? guess : null;
}

// --------------------------------------------------------------------------- shared strings

/** `<si>` entries, runs (`<r><t>`) joined, phonetic guides (`<rPh>`) left out. */
function readSharedStrings(xml: string): string[] {
  const strings: string[] = [];
  let current: string | null = null;
  let inText = false;
  let skipDepth = 0;

  for (const event of xmlEvents(xml)) {
    if (event.kind === "open") {
      if (skipDepth > 0) {
        if (!event.selfClosing) skipDepth += 1;
        continue;
      }
      if (event.name === "rPh" || event.name === "phoneticPr") {
        if (!event.selfClosing) skipDepth = 1;
        continue;
      }
      if (event.name === "si") current = "";
      else if (event.name === "t") inText = true;
    } else if (event.kind === "close") {
      if (skipDepth > 0) {
        skipDepth -= 1;
        continue;
      }
      if (event.name === "t") inText = false;
      else if (event.name === "si") {
        strings.push(current ?? "");
        current = null;
      }
    } else if (event.kind === "text" && inText && current !== null) {
      current += event.text;
    }
  }
  return strings;
}

// ----------------------------------------------------------------------------- date styles

/** Built-in number formats that mean a date or a date-time (ECMA-376 §18.8.30). */
const BUILT_IN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47]);

/**
 * Style indexes whose number format is a date. Without this a « Installé le » column arrives
 * as 45678 and every line is refused for an unreadable date.
 */
function readDateStyles(xml: string): Set<number> {
  const customDateFormats = new Set<number>();
  const dateStyles = new Set<number>();
  let inCellXfs = false;
  let styleIndex = 0;

  for (const event of xmlEvents(xml)) {
    if (event.kind === "close" && event.name === "cellXfs") inCellXfs = false;
    if (event.kind !== "open") continue;
    if (event.name === "cellXfs") {
      inCellXfs = true;
      styleIndex = 0;
      continue;
    }
    if (event.name === "numFmt") {
      const id = Number(event.attrs.numFmtId ?? "");
      if (Number.isFinite(id) && isDateFormatCode(event.attrs.formatCode ?? "")) {
        customDateFormats.add(id);
      }
      continue;
    }
    if (inCellXfs && event.name === "xf") {
      const id = Number(event.attrs.numFmtId ?? "0");
      if (BUILT_IN_DATE_FORMATS.has(id) || customDateFormats.has(id)) dateStyles.add(styleIndex);
      styleIndex += 1;
    }
  }
  return dateStyles;
}

/** `dd/mm/yyyy` is a date, `#,##0.00 "€"` is not — the literals are stripped before looking. */
function isDateFormatCode(code: string): boolean {
  const withoutLiterals = code
    .replace(/"[^"]*"/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\\./g, "");
  return /[yd]/i.test(withoutLiterals);
}

// --------------------------------------------------------------------------------- one sheet

type RawCell = { column: number; value: string };

function readSheet(
  xml: string,
  sharedStrings: string[],
  dateStyles: Set<number>,
  date1904: boolean,
): ParsedTable {
  const grid: RawCell[][] = [];
  let row: RawCell[] = [];
  let cells = 0;

  let column = 0;
  let type = "";
  let style = -1;
  let text: string | null = null;
  let inValue = false;
  let inInlineText = false;

  for (const event of xmlEvents(xml)) {
    if (event.kind === "open") {
      if (event.name === "row") {
        row = [];
        column = 0;
      } else if (event.name === "c") {
        cells += 1;
        if (cells > XLSX_MAX_CELLS) throw new ZipError("too_large");
        column = columnIndex(event.attrs.r ?? "", column);
        type = event.attrs.t ?? "n";
        const styleAttr = Number(event.attrs.s ?? "");
        style = Number.isFinite(styleAttr) ? styleAttr : -1;
        text = null;
        if (event.selfClosing) column += 1;
      } else if (event.name === "v") inValue = true;
      else if (event.name === "t") inInlineText = true;
    } else if (event.kind === "text") {
      if (inValue || inInlineText) text = (text ?? "") + event.text;
    } else {
      if (event.name === "v") inValue = false;
      else if (event.name === "t") inInlineText = false;
      else if (event.name === "c") {
        const value = cellValue(text, type, style, sharedStrings, dateStyles, date1904);
        if (value !== "") row.push({ column, value });
        column += 1;
      } else if (event.name === "row") {
        grid.push(row);
        row = [];
      }
    }
  }

  return toTable(grid);
}

/** `C7` → 2. Excel omits `r` on dense rows, and then the running position is the answer. */
function columnIndex(reference: string, fallback: number): number {
  const letters = /^([A-Z]+)/.exec(reference.toUpperCase());
  if (!letters?.[1]) return fallback;
  let index = 0;
  for (const letter of letters[1]) index = index * 26 + (letter.charCodeAt(0) - 64);
  return index - 1;
}

function cellValue(
  text: string | null,
  type: string,
  style: number,
  sharedStrings: string[],
  dateStyles: Set<number>,
  date1904: boolean,
): string {
  if (text === null) return "";
  if (type === "s") {
    const index = Number(text);
    return Number.isFinite(index) ? (sharedStrings[index] ?? "") : "";
  }
  if (type === "inlineStr" || type === "str") return text.trim();
  // #N/A, #REF!… is the absence of a value, not a value to import.
  if (type === "e") return "";
  if (type === "b") return text === "1" ? "oui" : "non";

  const value = Number(text);
  if (!Number.isFinite(value)) return text.trim();
  if (dateStyles.has(style)) return serialToFrenchDate(value, date1904);
  // Excel keeps 17 digits; 3.9999999999999996 is a 4 that has been through a division.
  return String(Number(value.toPrecision(12)));
}

/** Excel counts days from 1899-12-30 (1904-01-01 on the old Mac workbooks). */
export function serialToFrenchDate(serial: number, date1904 = false): string {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  if (days <= 0 || days > 2_958_465) return String(serial);
  const date = new Date(Date.UTC(1899, 11, 30) + days * 86_400_000);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/**
 * Sparse cells become a rectangle: empty leading columns and rows are dropped, a title typed
 * alone above the table is dropped too, and the first real line becomes the header.
 */
function toTable(grid: RawCell[][]): ParsedTable {
  const rows = grid.filter((row) => row.length > 0);
  if (rows.length === 0) return { headers: [], rows: [], delimiter: "\t" };

  const firstColumn = Math.min(...rows.map((row) => row[0]?.column ?? 0));
  const lastColumn = Math.max(...rows.map((row) => row[row.length - 1]?.column ?? 0));
  const width = lastColumn - firstColumn + 1;

  const dense = rows.map((row) => {
    const cells = new Array<string>(width).fill("");
    for (const cell of row) {
      const index = cell.column - firstColumn;
      if (index >= 0 && index < width) cells[index] = cell.value.trim();
    }
    return cells;
  });

  // « Inventaire du bord » alone in A1, then the real header underneath: the lone cell is a
  // title, not a one-column table — it is only dropped when the next line is wider.
  let start = 0;
  while (start + 1 < dense.length) {
    const filled = (dense[start] ?? []).filter((cell) => cell !== "").length;
    const next = (dense[start + 1] ?? []).filter((cell) => cell !== "").length;
    if (filled >= 2 || filled >= next) break;
    start += 1;
  }

  const [head, ...rest] = dense.slice(start);
  const headers = (head ?? []).map((cell) => cell.trim());
  return {
    headers,
    rows: rest.map((cells) => headers.map((_, index) => cells[index] ?? "")),
    delimiter: "\t",
  };
}
