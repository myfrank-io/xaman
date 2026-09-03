/**
 * Table parsing for the import engine (E12-1).
 *
 * Everything a person can hand us — a `.csv` exported by a bank, a `.tsv`, or the cells they
 * copied straight out of Excel — is delimited text. This module turns that into headers and
 * rows and nothing else: no mapping, no validation, no knowledge of the app's entities.
 *
 * Written by hand rather than pulled from a library: the rules that matter (quotes, embedded
 * separators, CRLF, the BOM Excel writes) fit in eighty lines and are covered by tests.
 */

export type ParsedTable = {
  headers: string[];
  /** One entry per data row, aligned on `headers` (missing cells are ""). */
  rows: string[][];
  delimiter: string;
};

const DELIMITERS = [",", ";", "\t", "|"] as const;

/**
 * The separator is whichever candidate yields the same, largest column count on the first
 * lines. French Excel writes `;`, the anglophone world `,`, a copy-paste is tab-separated.
 */
export function sniffDelimiter(text: string): string {
  const lines = text
    .split(/\r?\n/)
    .filter((line) => line.trim() !== "")
    .slice(0, 5);
  if (lines.length === 0) return ",";
  let best = ",";
  let bestScore = 0;
  for (const delimiter of DELIMITERS) {
    const counts = lines.map((line) => splitLine(line, delimiter).length);
    const first = counts[0] ?? 1;
    if (first < 2) continue;
    const consistent = counts.every((count) => count === first);
    const score = (consistent ? 100 : 0) + first;
    if (score > bestScore) {
      bestScore = score;
      best = delimiter;
    }
  }
  return best;
}

/** One line, honouring `"quoted, cells"` and `""` as an escaped quote. */
function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === delimiter) {
      cells.push(cell);
      cell = "";
    } else cell += char;
  }
  cells.push(cell);
  return cells;
}

/**
 * Splits on newlines that are **not** inside quotes — a note typed on two lines inside a cell
 * belongs to that cell, it does not open a new row.
 */
function splitRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') {
      current += char;
      if (quoted && text[i + 1] === '"') {
        // "" inside a quoted cell is one escaped quote, not the end of the cell
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (!quoted && (char === "\n" || char === "\r")) {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      records.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  if (current !== "") records.push(current);
  return records;
}

/** Excel writes a UTF-8 BOM; left in place it would hide inside the first header. */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

export function parseTable(input: string, forcedDelimiter?: string): ParsedTable {
  const text = stripBom(input).trim();
  if (text === "") return { headers: [], rows: [], delimiter: forcedDelimiter ?? "," };
  const delimiter = forcedDelimiter ?? sniffDelimiter(text);
  const records = splitRecords(text).filter((record) => record.trim() !== "");
  const [head, ...rest] = records;
  const headers = splitLine(head ?? "", delimiter).map((cell) => cell.trim());
  const rows = rest.map((record) => {
    const cells = splitLine(record, delimiter).map((cell) => cell.trim());
    // Align on the header: a short row is padded, a long one keeps its extra cells out.
    return headers.map((_, index) => cells[index] ?? "");
  });
  return { headers, rows, delimiter };
}
