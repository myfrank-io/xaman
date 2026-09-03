/**
 * Minimal XML reader for the OOXML parts of an `.xlsx` (E12-5).
 *
 * Not a general XML parser and not trying to be: it walks tags and text of the well-formed,
 * machine-written parts Excel, LibreOffice and Numbers produce. Hand-written rather than
 * pulled from a library because the app must also run this in Node for its tests, where
 * `DOMParser` does not exist, and because a spreadsheet reader is not worth a dependency.
 */

export type XmlEvent =
  | { kind: "open"; name: string; attrs: Record<string, string>; selfClosing: boolean }
  | { kind: "close"; name: string }
  | { kind: "text"; text: string };

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

/** `&amp;`, `&#233;`, `&#xE9;` — everything Excel writes into a cell of text. */
export function decodeEntities(value: string): string {
  if (!value.includes("&")) return value;
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, body: string) => {
    if (body.startsWith("#x") || body.startsWith("#X")) {
      const code = Number.parseInt(body.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    if (body.startsWith("#")) {
      const code = Number.parseInt(body.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[body] ?? match;
  });
}

/**
 * Walks the document once, yielding open tags, close tags and text. Declarations, comments,
 * doctypes and processing instructions are skipped; CDATA is yielded as text.
 */
export function* xmlEvents(xml: string): Generator<XmlEvent> {
  let index = 0;
  while (index < xml.length) {
    const start = xml.indexOf("<", index);
    if (start < 0) {
      const tail = xml.slice(index);
      if (tail !== "") yield { kind: "text", text: decodeEntities(tail) };
      return;
    }
    if (start > index) {
      yield { kind: "text", text: decodeEntities(xml.slice(index, start)) };
    }

    // <!-- comment -->, <![CDATA[…]]>, <!DOCTYPE …>, <?xml …?>
    if (xml.startsWith("<!--", start)) {
      const end = xml.indexOf("-->", start + 4);
      index = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", start)) {
      const end = xml.indexOf("]]>", start + 9);
      const text = xml.slice(start + 9, end < 0 ? xml.length : end);
      if (text !== "") yield { kind: "text", text };
      index = end < 0 ? xml.length : end + 3;
      continue;
    }
    if (xml.startsWith("<?", start) || xml.startsWith("<!", start)) {
      const end = xml.indexOf(">", start + 2);
      index = end < 0 ? xml.length : end + 1;
      continue;
    }

    if (xml.startsWith("</", start)) {
      const end = xml.indexOf(">", start + 2);
      const name = xml.slice(start + 2, end < 0 ? xml.length : end).trim();
      yield { kind: "close", name: localName(name) };
      index = end < 0 ? xml.length : end + 1;
      continue;
    }

    const tag = readTag(xml, start);
    if (!tag) return;
    yield { kind: "open", name: tag.name, attrs: tag.attrs, selfClosing: tag.selfClosing };
    index = tag.end;
  }
}

/** `w:t` and `t` are the same element here: no namespace matters inside a spreadsheet part. */
function localName(name: string): string {
  const colon = name.indexOf(":");
  return colon < 0 ? name : name.slice(colon + 1);
}

function readTag(
  xml: string,
  start: number,
): { name: string; attrs: Record<string, string>; selfClosing: boolean; end: number } | null {
  let i = start + 1;
  const nameStart = i;
  while (i < xml.length && !/[\s/>]/.test(xml[i] as string)) i += 1;
  const name = localName(xml.slice(nameStart, i));
  const attrs: Record<string, string> = {};

  while (i < xml.length) {
    while (i < xml.length && /\s/.test(xml[i] as string)) i += 1;
    if (i >= xml.length) break;
    if (xml[i] === ">") return { name, attrs, selfClosing: false, end: i + 1 };
    if (xml[i] === "/" && xml[i + 1] === ">") {
      return { name, attrs, selfClosing: true, end: i + 2 };
    }

    const attrStart = i;
    while (i < xml.length && !/[\s=/>]/.test(xml[i] as string)) i += 1;
    const attrName = localName(xml.slice(attrStart, i));
    while (i < xml.length && /\s/.test(xml[i] as string)) i += 1;
    if (xml[i] !== "=") {
      // A bare attribute (`disabled`): no value, keep walking rather than losing the tag.
      if (attrName !== "") attrs[attrName] = "";
      continue;
    }
    i += 1;
    while (i < xml.length && /\s/.test(xml[i] as string)) i += 1;
    const quote = xml[i];
    if (quote === '"' || quote === "'") {
      const end = xml.indexOf(quote, i + 1);
      const value = xml.slice(i + 1, end < 0 ? xml.length : end);
      attrs[attrName] = decodeEntities(value);
      i = end < 0 ? xml.length : end + 1;
    } else {
      const valueStart = i;
      while (i < xml.length && !/[\s/>]/.test(xml[i] as string)) i += 1;
      attrs[attrName] = decodeEntities(xml.slice(valueStart, i));
    }
  }
  return { name, attrs, selfClosing: false, end: xml.length };
}
