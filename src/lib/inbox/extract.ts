/**
 * The text of a document, without a model (D92).
 *
 * A PDF has, most of the time, its own text layer — an invoice printed to PDF by the yard's
 * software — and pdf.js reads it as it is, line by line. A photo goes through Tesseract, the
 * open-source OCR, with the French model served from the project's own Storage: nothing is sent
 * anywhere, and the reading costs what a serverless second costs.
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

/**
 * Where the French model is read from: the public `ocr-assets` bucket of the project's Storage,
 * not the deployment (D139). It is 600 Ko of open-source language data, it changes once a year,
 * and it was copied into two serverless functions on every single deployment.
 *
 * `langPath` may be a URL in Node — tesseract.js tells a URL from a path with `is-url`, fetches
 * `<langPath>/fra.traineddata.gz` and gunzips it. `scripts/push-ocr-assets.mjs` puts it there
 * from the copy kept in the repository, which stays the source of truth.
 *
 * `INBOX_TESSDATA_PATH` overrides it with a **directory**, which tesseract.js reads from the file
 * system instead: that is how the reading test (`tests/unit/inbox-local-reading.test.ts`) stays
 * hermetic and offline, on the very copy the script uploads. Unset in the app.
 */
// Read at call time, not at module load: the env of a serverless instance is complete by then,
// and a test may point it elsewhere after importing this module.
const tessdataSource = () =>
  process.env.INBOX_TESSDATA_PATH ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/ocr-assets`;

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
    langPath: tessdataSource(),
    gzip: true,
    // The unpacked model is kept in the only directory a serverless runtime may write to, so a
    // warm instance reads its 600 Ko from disk instead of fetching them again.
    cachePath: "/tmp",
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
