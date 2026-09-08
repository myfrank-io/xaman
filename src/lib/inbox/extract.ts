import path from "node:path";

/**
 * The text of a document, without a model (D92).
 *
 * A PDF has, most of the time, its own text layer — an invoice printed to PDF by the yard's
 * software — and pdf.js reads it as it is, line by line. A photo goes through Tesseract, the
 * open-source OCR, with the French model shipped in the repository (`tessdata/`): nothing is
 * downloaded at run time, nothing is sent anywhere, and the reading costs what a serverless
 * second costs.
 *
 * Both run in Node only: this module is imported by `analyse.ts` and by nothing the browser
 * sees. The packages stay outside the Next bundle (`serverExternalPackages`) so their workers
 * and their wasm resolve from `node_modules` as they expect to.
 */
export type ExtractedText = {
  text: string;
  /** Mean OCR confidence 0–100 on an image; null for a PDF text layer. */
  ocrConfidence: number | null;
};

/** Where the French OCR model lives, traced into the serverless bundle by `next.config.ts`. */
export const TESSDATA_DIR = path.join(process.cwd(), "src", "lib", "inbox", "tessdata");

export const OCR_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/bmp"] as const;

export function isExtractable(mimeType: string): boolean {
  return (
    mimeType === "application/pdf" || (OCR_IMAGE_TYPES as readonly string[]).includes(mimeType)
  );
}

export async function extractText(bytes: Buffer, mimeType: string): Promise<ExtractedText> {
  if (mimeType === "application/pdf") return { text: await pdfText(bytes), ocrConfidence: null };
  return imageText(bytes);
}

/** The text layer of every page, lines rebuilt from the glyph positions pdf.js hands back. */
async function pdfText(bytes: Buffer): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true,
  });
  try {
    const doc = await task.promise;
    const pages: string[] = [];
    const pageCount = Math.min(doc.numPages, 10);
    for (let i = 1; i <= pageCount; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const lines: string[] = [];
      let current = "";
      let lastY: number | null = null;
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = Math.round(item.transform[5] ?? 0);
        if (lastY !== null && Math.abs(y - lastY) > 2) {
          lines.push(current);
          current = "";
        }
        current +=
          current && !current.endsWith(" ") && !item.str.startsWith(" ")
            ? ` ${item.str}`
            : item.str;
        lastY = y;
        if (item.hasEOL) {
          lines.push(current);
          current = "";
          lastY = null;
        }
      }
      if (current) lines.push(current);
      pages.push(lines.join("\n"));
      page.cleanup();
    }
    return pages.join("\n\n");
  } finally {
    await task.destroy();
  }
}

/** What Tesseract reads on a photo, French model, one worker per document. */
async function imageText(bytes: Buffer): Promise<ExtractedText> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("fra", 1, {
    langPath: TESSDATA_DIR,
    gzip: true,
    cacheMethod: "none",
    logger: () => {},
    errorHandler: (error) => console.error("inbox: ocr worker", error),
  });
  try {
    const { data } = await worker.recognize(bytes);
    return { text: data.text, ocrConfidence: data.confidence };
  } finally {
    await worker.terminate();
  }
}
