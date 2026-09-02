// CSV for French spreadsheets: `;` separator, CRLF, UTF-8 BOM so Excel reads the accents,
// every field quoted when it needs to be (E9-2). No dependency.
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | null | undefined;
};

const SEPARATOR = ";";
const BOM = "﻿";

export function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "number" ? String(value).replace(".", ",") : value;
  // A leading =, +, -, @ would be executed as a formula by spreadsheet apps.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[";\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines = [columns.map((column) => csvField(column.header)).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(columns.map((column) => csvField(column.value(row))).join(SEPARATOR));
  }
  return BOM + lines.join("\r\n") + "\r\n";
}
