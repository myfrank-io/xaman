/**
 * The blank file to fill in (E12-7).
 *
 * Someone whose data is not yet in a spreadsheet still should not have to guess the columns.
 * The template carries the exact headers the import recognises and one filled-in line as an
 * example, so the file comes back mapped without a single choice to make.
 */

import { toCsv } from "@/lib/export/csv";
import { type EntityDescriptor } from "@/lib/import/entities";

/**
 * Semicolon-separated with a byte order mark: that is what French Excel opens in columns
 * without asking anything. A comma-separated file lands in a single column here. Written by
 * the one CSV writer of the app (`toCsv`), which also neutralises formula injection — a
 * template is a file someone opens in Excel, so it gets the same guard as the exports.
 */
export function templateCsv(descriptor: EntityDescriptor): string {
  const sample = descriptor.fields.map((field) => field.sample ?? "");
  return toCsv(
    [sample],
    descriptor.fields.map((field, index) => ({
      header: field.label,
      value: (row: string[]) => row[index] ?? "",
    })),
  );
}

export function templateFileName(descriptor: EntityDescriptor): string {
  return `xaman-modele-${descriptor.key}.csv`;
}
