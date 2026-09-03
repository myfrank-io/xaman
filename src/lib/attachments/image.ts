import { ATTACHMENT_MAX_BYTES, isImage } from "@/lib/schemas/attachments";

/**
 * A boat's connection is a phone hotspot at anchor and a modern phone photo is 4 Mo. Every
 * photograph is re-encoded in the browser before it leaves the iPad; nothing is ever uploaded
 * untouched without a reason (E10-1). No library: a canvas does it.
 */

/** Long edge of the stored photograph. 2000 px still prints an A4 detail of a fitting. */
export const MAX_EDGE = 2000;

/** Visually lossless enough for an invoice photographed on a cockpit table. */
export const JPEG_QUALITY = 0.82;

/** Under this, re-encoding a small screenshot would cost more than it saves. */
export const KEEP_ORIGINAL_MAX_BYTES = 400 * 1024;

export type ResizePlan = {
  /** false = upload the file as it is (PDF, or an image already small enough). */
  reencode: boolean;
  width: number;
  height: number;
};

/**
 * Pure decision, unit-tested: what to do with a file of these dimensions and weight.
 * `width` / `height` are 0 for anything that is not an image.
 */
export function planResize(input: {
  mimeType: string;
  bytes: number;
  width: number;
  height: number;
}): ResizePlan {
  const { mimeType, bytes, width, height } = input;
  if (!isImage(mimeType) || width <= 0 || height <= 0) {
    return { reencode: false, width, height };
  }
  const longEdge = Math.max(width, height);
  // Already small on both counts: the original is the better file.
  if (longEdge <= MAX_EDGE && bytes <= KEEP_ORIGINAL_MAX_BYTES) {
    return { reencode: false, width, height };
  }
  const ratio = longEdge > MAX_EDGE ? MAX_EDGE / longEdge : 1;
  return {
    reencode: true,
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export type PreparedFile = {
  blob: Blob;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

/** « facture.HEIC » → « facture.jpg » once re-encoded, so the name matches the bytes. */
function jpegName(fileName: string): string {
  return fileName.replace(/\.[a-z0-9]{1,8}$/i, "") + ".jpg";
}

async function decode(file: File): Promise<{ width: number; height: number; source: ImageBitmap }> {
  const source = await createImageBitmap(file);
  return { width: source.width, height: source.height, source };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

/**
 * Browser only. Returns what should actually be uploaded: the original for a PDF or a small
 * image, a JPEG capped at {@link MAX_EDGE} otherwise. A decode failure (an exotic HEIC Safari
 * refuses to paint) falls back to the original rather than losing the document — the 10 Mo
 * ceiling is then checked by the caller.
 */
export async function prepareForUpload(file: File): Promise<PreparedFile> {
  const original: PreparedFile = {
    blob: file,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
  };
  if (!isImage(original.mimeType)) return original;

  let decoded: Awaited<ReturnType<typeof decode>> | null = null;
  try {
    decoded = await decode(file);
    const plan = planResize({
      mimeType: original.mimeType,
      bytes: file.size,
      width: decoded.width,
      height: decoded.height,
    });
    if (!plan.reencode) return original;

    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.drawImage(decoded.source, 0, 0, plan.width, plan.height);

    const blob = await toBlob(canvas, JPEG_QUALITY);
    // A re-encode that gains nothing is not worth the loss of the original bytes.
    if (!blob || blob.size >= file.size) return original;
    return {
      blob,
      fileName: jpegName(file.name),
      mimeType: "image/jpeg",
      sizeBytes: blob.size,
    };
  } catch {
    return original;
  } finally {
    decoded?.source.close();
  }
}

/** « 2,4 Mo », « 812 ko » — the weight shown next to a document chip. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ko`;
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(bytes / (1024 * 1024))} Mo`;
}

/**
 * A photograph is re-encoded before it is weighed, so the picked file may be far heavier than
 * the 10 Mo the bucket accepts. Past this ceiling an iPad decodes it at the risk of the tab:
 * refuse it, and say so.
 */
export const MAX_PICKED_IMAGE_BYTES = 40 * 1024 * 1024;

/** Reason a file is refused before any byte is decoded, or null when it is acceptable. */
export function rejectionReason(file: {
  type: string;
  size: number;
}): "tooLarge" | "unsupported" | null {
  const type = file.type || "";
  if (type !== "application/pdf" && !type.startsWith("image/")) return "unsupported";
  // A PDF is uploaded as it is: its own weight is the one that counts.
  const ceiling = type === "application/pdf" ? ATTACHMENT_MAX_BYTES : MAX_PICKED_IMAGE_BYTES;
  return file.size > ceiling ? "tooLarge" : null;
}

/** After preparation: a photograph that is still too heavy is refused, never sent to fail. */
export function isTooLargeToStore(sizeBytes: number): boolean {
  return sizeBytes > ATTACHMENT_MAX_BYTES;
}
