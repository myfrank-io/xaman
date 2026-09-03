/**
 * Reading a contact card file (E12-6).
 *
 * « Partager le contact » on an iPhone, « Exporter les contacts » on Android and the address
 * book of a Mac all produce a `.vcf`. That is how the yard, the sailmaker and the engine
 * mechanic are already stored — asking someone to retype them into a spreadsheet first would
 * miss the point of the import.
 *
 * The file becomes the same table the CSV path produces, with the headers of the contacts
 * descriptor, so mapping, preview and writing are shared with every other import.
 */

import { type ParsedTable } from "@/lib/import/parse";

/** Column order of the produced table; matches the labels of the contacts descriptor. */
export const CONTACT_HEADERS = [
  "Nom",
  "Spécialité",
  "Société",
  "Téléphone",
  "E-mail",
  "Adresse",
  "Notes",
];

export function isContactCardFile(name: string): boolean {
  return /\.(vcf|vcard)$/i.test(name);
}

type Line = { name: string; params: Record<string, string>; value: string };

export function parseContactCards(input: string): ParsedTable {
  const cards = splitCards(unfold(stripBom(input)));
  const rows = cards.map(toRow).filter((row) => (row[0] ?? "") !== "");
  return { headers: CONTACT_HEADERS, rows, delimiter: "\t" };
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * A long value is written over several lines, the continuations starting with a space or a
 * tab. Joined back before anything else, or a phone number arrives cut in two.
 */
function unfold(text: string): string[] {
  const lines: string[] = [];
  for (const raw of text.split(/\r\n|\r|\n/)) {
    if (/^[ \t]/.test(raw) && lines.length > 0) {
      lines[lines.length - 1] = (lines[lines.length - 1] ?? "") + raw.slice(1);
    } else lines.push(raw);
  }
  return lines;
}

function splitCards(lines: string[]): Line[][] {
  const cards: Line[][] = [];
  let current: Line[] | null = null;
  for (const raw of lines) {
    const line = parseLine(raw);
    if (!line) continue;
    if (line.name === "BEGIN") {
      current = [];
      continue;
    }
    if (line.name === "END") {
      if (current && current.length > 0) cards.push(current);
      current = null;
      continue;
    }
    if (current) current.push(line);
  }
  // A file that lost its BEGIN/END markers is still a card if it carries a name.
  if (current && current.length > 0) cards.push(current);
  return cards;
}

/** `item1.TEL;TYPE=CELL;ENCODING=QUOTED-PRINTABLE:+33...` */
function parseLine(raw: string): Line | null {
  const trimmed = raw.trim();
  if (trimmed === "") return null;
  const colon = indexOfUnquoted(trimmed, ":");
  if (colon < 0) return null;

  const head = trimmed.slice(0, colon);
  let value = trimmed.slice(colon + 1);
  const parts = splitUnescaped(head, ";");
  const rawName = parts[0] ?? "";
  // Apple groups its lines: « item1.TEL » is a TEL.
  const dot = rawName.lastIndexOf(".");
  const name = (dot < 0 ? rawName : rawName.slice(dot + 1)).toUpperCase();

  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const equals = part.indexOf("=");
    if (equals < 0)
      params.TYPE = `${params.TYPE ?? ""}${params.TYPE ? "," : ""}${part.toUpperCase()}`;
    else {
      const key = part.slice(0, equals).toUpperCase();
      const existing = params[key];
      const next = part.slice(equals + 1).replace(/^"|"$/g, "");
      params[key] = existing ? `${existing},${next}` : next;
    }
  }

  if ((params.ENCODING ?? "").toUpperCase().includes("QUOTED-PRINTABLE")) {
    value = decodeQuotedPrintable(value);
  }
  return { name, params, value };
}

/** vCard 2.1 from an older Android: « Herv=C3=A9 » is « Hervé ». */
function decodeQuotedPrintable(value: string): string {
  const joined = value.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < joined.length; i += 1) {
    if (joined[i] === "=" && /^[0-9a-fA-F]{2}$/.test(joined.slice(i + 1, i + 3))) {
      bytes.push(Number.parseInt(joined.slice(i + 1, i + 3), 16));
      i += 2;
    } else bytes.push(joined.charCodeAt(i) & 0xff);
  }
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}

function indexOfUnquoted(text: string, needle: string): number {
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === '"') quoted = !quoted;
    else if (!quoted && char === needle) return i;
  }
  return -1;
}

/** Splits on a separator that is not escaped by a backslash. */
function splitUnescaped(text: string, separator: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (char === "\\" && i + 1 < text.length) {
      current += char + text[i + 1];
      i += 1;
    } else if (char === separator) {
      parts.push(current);
      current = "";
    } else current += char;
  }
  parts.push(current);
  return parts;
}

/** `\n` is a real newline, `\,` a comma, `\\` a backslash. */
function unescape(value: string): string {
  return value.replace(/\\([nN,;\\])/g, (_, char: string) =>
    char === "n" || char === "N" ? "\n" : char,
  );
}

function field(card: Line[], name: string): Line | undefined {
  return card.find((line) => line.name === name);
}

/** Prefers the card's own preference, then a mobile, then whatever is there. */
function preferred(card: Line[], name: string, wanted: string[]): string {
  const candidates = card.filter((line) => line.name === name && line.value.trim() !== "");
  if (candidates.length === 0) return "";
  const typed = (line: Line) => (line.params.TYPE ?? "").toUpperCase();
  const pref = candidates.find((line) => typed(line).includes("PREF") || "PREF" in line.params);
  if (pref) return unescape(pref.value).trim();
  for (const type of wanted) {
    const match = candidates.find((line) => typed(line).includes(type));
    if (match) return unescape(match.value).trim();
  }
  return unescape(candidates[0]?.value ?? "").trim();
}

function displayName(card: Line[]): string {
  const fn = field(card, "FN");
  if (fn && fn.value.trim() !== "") return unescape(fn.value).trim();
  const n = field(card, "N");
  if (!n) return "";
  // N is family;given;middle;prefix;suffix — read as « Prénom Nom ».
  const [family = "", given = ""] = splitUnescaped(n.value, ";").map((part) =>
    unescape(part).trim(),
  );
  return [given, family].filter(Boolean).join(" ");
}

function address(card: Line[]): string {
  const adr = card.find(
    (line) => line.name === "ADR" && line.value.replace(/;/g, "").trim() !== "",
  );
  if (!adr) return "";
  // ADR is pobox;extended;street;locality;region;postcode;country.
  const parts = splitUnescaped(adr.value, ";").map((part) => unescape(part).trim());
  const [, extended = "", street = "", locality = "", region = "", postcode = "", country = ""] =
    parts;
  const streetLine = [street, extended].filter(Boolean).join(" ");
  const cityLine = [postcode, locality].filter(Boolean).join(" ");
  return [streetLine, cityLine, region, country].filter(Boolean).join(", ");
}

/**
 * What the card says the person does: their job title, their role, or the label the phone
 * files them under. Empty on most cards — the import screen offers a default value for that.
 */
function specialty(card: Line[]): string {
  const title = field(card, "TITLE")?.value ?? field(card, "ROLE")?.value ?? "";
  if (title.trim() !== "") return unescape(title).trim();
  const categories = field(card, "CATEGORIES")?.value ?? "";
  const first = splitUnescaped(categories, ",")[0] ?? "";
  return unescape(first).trim();
}

function notes(card: Line[]): string {
  const note = unescape(field(card, "NOTE")?.value ?? "").trim();
  const url = unescape(field(card, "URL")?.value ?? "").trim();
  return [note, url].filter(Boolean).join("\n");
}

function toRow(card: Line[]): string[] {
  const organisation = splitUnescaped(field(card, "ORG")?.value ?? "", ";")
    .map((part) => unescape(part).trim())
    .filter(Boolean)
    .join(" — ");
  return [
    displayName(card),
    specialty(card),
    organisation,
    preferred(card, "TEL", ["CELL", "MOBILE", "WORK", "VOICE"]),
    preferred(card, "EMAIL", ["WORK", "INTERNET"]),
    address(card),
    notes(card),
  ];
}
