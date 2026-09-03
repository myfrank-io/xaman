/**
 * The little bit of ZIP needed to open an `.xlsx` (E12-5).
 *
 * An Excel workbook is a ZIP of XML parts. Reading the central directory and inflating an
 * entry is about a hundred lines, and the browser already ships the decompressor
 * (`DecompressionStream`, Safari 16.4+, Node 18+) — so no dependency is added to send a
 * spreadsheet up from an iPad. Only what a spreadsheet uses is supported: stored and
 * deflated entries, no encryption, no ZIP64, no multi-part archive.
 */

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;
const LOCAL_SIGNATURE = 0x04034b50;
const EOCD_MIN_SIZE = 22;
/** The end-of-central-directory record may be followed by a comment of at most 64 KiB. */
const EOCD_MAX_SCAN = 0xffff + EOCD_MIN_SIZE;

export class ZipError extends Error {}

type Entry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

export type ZipArchive = {
  names: string[];
  has: (name: string) => boolean;
  /** Inflates one entry and decodes it as UTF-8. Missing entry → null. */
  text: (name: string) => Promise<string | null>;
};

export async function openZip(buffer: ArrayBuffer): Promise<ZipArchive> {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const entries = readCentralDirectory(view, bytes);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));

  return {
    names: entries.map((entry) => entry.name),
    has: (name) => byName.has(name),
    text: async (name) => {
      const entry = byName.get(name);
      if (!entry) return null;
      const data = await readEntry(view, bytes, entry);
      return new TextDecoder("utf-8").decode(data);
    },
  };
}

function readCentralDirectory(view: DataView, bytes: Uint8Array): Entry[] {
  const eocd = findEocd(view, bytes.length);
  if (eocd < 0) throw new ZipError("not_a_zip");

  const count = view.getUint16(eocd + 10, true);
  const directoryOffset = view.getUint32(eocd + 16, true);
  if (directoryOffset === 0xffffffff || count === 0xffff) throw new ZipError("zip64_unsupported");

  const entries: Entry[] = [];
  let cursor = directoryOffset;
  for (let i = 0; i < count; i += 1) {
    if (cursor + 46 > bytes.length) throw new ZipError("truncated");
    if (view.getUint32(cursor, true) !== CENTRAL_SIGNATURE) throw new ZipError("truncated");
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder("utf-8").decode(
      bytes.subarray(cursor + 46, cursor + 46 + nameLength),
    );
    entries.push({ name, method, compressedSize, uncompressedSize, localHeaderOffset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function findEocd(view: DataView, size: number): number {
  const limit = Math.max(0, size - EOCD_MAX_SCAN);
  for (let i = size - EOCD_MIN_SIZE; i >= limit; i -= 1) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  return -1;
}

async function readEntry(view: DataView, bytes: Uint8Array, entry: Entry): Promise<Uint8Array> {
  const header = entry.localHeaderOffset;
  if (header + 30 > bytes.length) throw new ZipError("truncated");
  if (view.getUint32(header, true) !== LOCAL_SIGNATURE) throw new ZipError("truncated");
  // The local header repeats the name and carries its own extra field, usually a different
  // length from the one in the central directory — always read it here, never assume.
  const nameLength = view.getUint16(header + 26, true);
  const extraLength = view.getUint16(header + 28, true);
  const start = header + 30 + nameLength + extraLength;
  const raw = bytes.subarray(start, start + entry.compressedSize);

  if (entry.method === 0) return raw;
  if (entry.method !== 8) throw new ZipError("unsupported_compression");
  return inflateRaw(raw);
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === "undefined") throw new ZipError("no_decompressor");
  const stream = new Blob([data as unknown as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
