"use client";

import { useTranslations } from "next-intl";

import { AttachmentGallery } from "@/components/attachments/AttachmentGallery";
import { SectionCard } from "@/components/common/SectionCard";
import type { AttachmentItem } from "@/lib/queries/attachments";
import { useAttachments } from "@/lib/queries/use-attachments";
import type { AttachmentOwner } from "@/lib/schemas/attachments";

/**
 * « Photos et documents » on a detail sheet (E10-1). Server-rendered on first paint, refreshed
 * by the hook so a document added from another device — and its fresh signed URL — shows up
 * without a reload.
 */
export function AttachmentsSection({
  boatId,
  owner,
  initial,
}: {
  boatId: string;
  owner: AttachmentOwner;
  initial: AttachmentItem[];
}) {
  const t = useTranslations("attachments");
  const { items } = useAttachments({ boatId, owner, initial });

  if (items.length === 0) return null;

  return (
    <SectionCard title={t("title")} footer={t("count", { count: items.length })} bare>
      <AttachmentGallery items={items} />
    </SectionCard>
  );
}
