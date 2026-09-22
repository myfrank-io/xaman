import { describe, expect, it } from "vitest";
import { upsertChecklistItemSchema } from "@/lib/schemas/checklist";
import { saveAttachmentSchema } from "@/lib/schemas/attachments";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const input = {
  id,
  boatId: id,
  label: "Contrôler les fixations",
  categoryIds: [id, other],
  description: "",
  intervalMonths: 12,
  intervalHours: "",
  engineId: "",
  anchorDate: "",
  actions: [],
};
describe("checklist form", () => {
  it("requires at least one system and preserves the first selected system", () => {
    expect(upsertChecklistItemSchema.parse(input).categoryIds).toEqual([id, other]);
    expect(upsertChecklistItemSchema.safeParse({ ...input, categoryIds: [] }).success).toBe(false);
    expect(
      upsertChecklistItemSchema.parse({ ...input, categoryIds: [id, other, id] }).categoryIds,
    ).toEqual([id, other]);
  });
  it("accepts supporting documents on the point itself", () => {
    expect(
      saveAttachmentSchema.safeParse({
        id,
        boatId: id,
        ownerId: other,
        ownerType: "checklist_item",
        storagePath: `boats/${id}/checklist_item/${other}/${id}.pdf`,
        fileName: "Devis.pdf",
        mimeType: "application/pdf",
        sizeBytes: 120,
        caption: null,
      }).success,
    ).toBe(true);
  });
});
