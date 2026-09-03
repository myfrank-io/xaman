/**
 * Attachments (E10-1): the pure decisions taken before a byte leaves the iPad — what to
 * re-encode, what to refuse, where the object goes — and the shared zod schema.
 * The canvas work itself is browser-only and is not unit-tested; `planResize` is what carries
 * the reasoning.
 */
import { describe, expect, it } from "vitest";

import {
  formatBytes,
  isTooLargeToStore,
  JPEG_QUALITY,
  MAX_EDGE,
  MAX_PICKED_IMAGE_BYTES,
  planResize,
  rejectionReason,
} from "@/lib/attachments/image";
import {
  ATTACHMENT_MAX_BYTES,
  attachmentExtension,
  attachmentStoragePath,
  isImage,
  isPdf,
  saveAttachmentSchema,
} from "@/lib/schemas/attachments";

const MB = 1024 * 1024;

describe("planResize", () => {
  it("caps the long edge of a phone photograph at 2000 px, keeping the ratio", () => {
    const plan = planResize({ mimeType: "image/jpeg", bytes: 4 * MB, width: 4032, height: 3024 });
    expect(plan.reencode).toBe(true);
    expect(Math.max(plan.width, plan.height)).toBe(MAX_EDGE);
    // 4:3 in, 4:3 out — a squashed invoice is unreadable.
    expect(plan.width / plan.height).toBeCloseTo(4032 / 3024, 3);
  });

  it("works the same on a portrait photograph", () => {
    const plan = planResize({ mimeType: "image/jpeg", bytes: 6 * MB, width: 3024, height: 4032 });
    expect(plan.height).toBe(MAX_EDGE);
    expect(plan.width).toBe(1500);
  });

  it("leaves a small image alone: re-encoding it would only lose detail", () => {
    expect(
      planResize({ mimeType: "image/png", bytes: 90 * 1024, width: 800, height: 600 }).reencode,
    ).toBe(false);
  });

  it("re-encodes a heavy image even when its dimensions are already small", () => {
    // A 1200 px PNG screenshot of an invoice can still weigh 3 Mo.
    const plan = planResize({ mimeType: "image/png", bytes: 3 * MB, width: 1200, height: 900 });
    expect(plan.reencode).toBe(true);
    expect(plan).toMatchObject({ width: 1200, height: 900 });
  });

  it("never touches a PDF, nor an image whose size could not be read", () => {
    expect(
      planResize({ mimeType: "application/pdf", bytes: 8 * MB, width: 0, height: 0 }).reencode,
    ).toBe(false);
    expect(
      planResize({ mimeType: "image/heic", bytes: 8 * MB, width: 0, height: 0 }).reencode,
    ).toBe(false);
  });

  it("keeps a quality that a photographed invoice survives", () => {
    expect(JPEG_QUALITY).toBeGreaterThanOrEqual(0.75);
    expect(JPEG_QUALITY).toBeLessThan(1);
  });
});

describe("rejectionReason", () => {
  it("accepts photographs and PDF, refuses the rest", () => {
    expect(rejectionReason({ type: "image/jpeg", size: 3 * MB })).toBeNull();
    expect(rejectionReason({ type: "image/heic", size: 3 * MB })).toBeNull();
    expect(rejectionReason({ type: "application/pdf", size: 3 * MB })).toBeNull();
    expect(rejectionReason({ type: "application/zip", size: 1024 })).toBe("unsupported");
    expect(rejectionReason({ type: "", size: 1024 })).toBe("unsupported");
  });

  it("lets a heavy photograph through — it is about to be reduced — but not a heavy PDF", () => {
    expect(rejectionReason({ type: "image/jpeg", size: 12 * MB })).toBeNull();
    expect(rejectionReason({ type: "application/pdf", size: 12 * MB })).toBe("tooLarge");
  });

  it("refuses a picture so large that decoding it would take the tab down", () => {
    expect(rejectionReason({ type: "image/jpeg", size: MAX_PICKED_IMAGE_BYTES + 1 })).toBe(
      "tooLarge",
    );
  });

  it("refuses after preparation what the bucket would refuse", () => {
    expect(isTooLargeToStore(ATTACHMENT_MAX_BYTES)).toBe(false);
    expect(isTooLargeToStore(ATTACHMENT_MAX_BYTES + 1)).toBe(true);
  });
});

describe("storage path", () => {
  const boatId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const ownerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
  const attachmentId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

  it("starts with the boat, which is what the Storage policies read", () => {
    const path = attachmentStoragePath({
      boatId,
      owner: { type: "maintenance_log", id: ownerId },
      attachmentId,
      fileName: "Facture Chantier (2).pdf",
      mimeType: "application/pdf",
    });
    expect(path).toBe(`boats/${boatId}/maintenance_log/${ownerId}/${attachmentId}.pdf`);
  });

  it("never carries the original file name into the object key", () => {
    const path = attachmentStoragePath({
      boatId,
      owner: { type: "purchase", id: ownerId },
      attachmentId,
      fileName: "reçu 100% payé.JPG",
      mimeType: "image/jpeg",
    });
    expect(path).not.toContain("reçu");
    expect(path.endsWith(".jpg")).toBe(true);
  });

  it("falls back on the mime type when the name has no extension", () => {
    expect(attachmentExtension("scan", "application/pdf")).toBe("pdf");
    expect(attachmentExtension("scan", "image/png")).toBe("png");
    expect(attachmentExtension("scan", "")).toBe("bin");
  });
});

describe("mime helpers", () => {
  it("tells a photograph from a document", () => {
    expect(isImage("image/jpeg")).toBe(true);
    expect(isImage("application/pdf")).toBe(false);
    expect(isPdf("application/pdf")).toBe(true);
  });
});

describe("saveAttachmentSchema", () => {
  const valid = {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    boatId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    ownerType: "maintenance_log",
    ownerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    storagePath: "boats/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/maintenance_log/x/y.jpg",
    fileName: "facture.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 2048,
    caption: "  Facture Yanmar  ",
  };

  it("accepts a document and trims its legend", () => {
    const parsed = saveAttachmentSchema.parse(valid);
    expect(parsed.caption).toBe("Facture Yanmar");
  });

  it("turns an empty legend into null so the column is cleared", () => {
    expect(saveAttachmentSchema.parse({ ...valid, caption: "   " }).caption).toBeNull();
  });

  it("refuses anything but an image or a PDF, and anything over 10 Mo", () => {
    expect(saveAttachmentSchema.safeParse({ ...valid, mimeType: "application/zip" }).success).toBe(
      false,
    );
    expect(
      saveAttachmentSchema.safeParse({ ...valid, sizeBytes: ATTACHMENT_MAX_BYTES + 1 }).success,
    ).toBe(false);
    expect(saveAttachmentSchema.safeParse({ ...valid, sizeBytes: 0 }).success).toBe(false);
  });

  it("refuses an owner V1 does not write (the equipment gallery is V1.1)", () => {
    expect(saveAttachmentSchema.safeParse({ ...valid, ownerType: "equipment" }).success).toBe(
      false,
    );
  });
});

describe("formatBytes", () => {
  it("reads in French, at the precision a person cares about", () => {
    expect(formatBytes(800)).toBe("800 o");
    expect(formatBytes(812 * 1024)).toBe("812 ko");
    expect(formatBytes(Math.round(2.4 * MB))).toBe("2,4 Mo");
  });
});
