/**
 * The blank file to fill in (E12-7).
 *
 * Someone whose data is not yet in a spreadsheet still should not have to guess the columns.
 * The template carries the exact headers the import recognises and one filled-in line as an
 * example, so the file comes back mapped without a single choice to make.
 */

import { type EntityDescriptor } from "@/lib/import/entities";

/** A cell containing the separator, a quote or a newline has to be quoted. */
function csvCell(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

/**
 * Semicolon-separated with a byte order mark: that is what French Excel opens in columns
 * without asking anything. A comma-separated file lands in a single column here.
 */
export function templateCsv(descriptor: EntityDescriptor): string {
  const headers = descriptor.fields.map((field) => field.label);
  const sample = descriptor.fields.map((field) => field.sample ?? "");
  const body = [headers, sample].map((cells) => cells.map(csvCell).join(";")).join("\r\n");
  return `﻿${body}\r\n`;
}

export function templateFileName(descriptor: EntityDescriptor): string {
  return `xaman-modele-${descriptor.key}.csv`;
}
