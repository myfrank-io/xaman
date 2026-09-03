"use client";

import { useState } from "react";
import { FileTextIcon, ImageOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/attachments/image";
import { formatDate } from "@/lib/format";
import type { AttachmentItem } from "@/lib/queries/attachments";
import { isPdf } from "@/lib/schemas/attachments";
import { cn } from "@/lib/utils";

/**
 * The documents of an intervention or a purchase (E10-1): a photograph opens full size, a PDF
 * opens in a new tab, the legend sits under the tile and the author / date read like the audit
 * footer of the sheet (E10-4). No colour of its own — a document is not a category (rule 12).
 */
export function AttachmentGallery({
  items,
  className,
}: {
  items: AttachmentItem[];
  className?: string;
}) {
  const t = useTranslations("attachments");
  const [zoomed, setZoomed] = useState<AttachmentItem | null>(null);

  if (items.length === 0) return null;

  return (
    <>
      <ul className={cn("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4", className)}>
        {items.map((item) => (
          <li key={item.id} className="flex flex-col gap-1.5">
            <AttachmentTile item={item} onZoom={() => setZoomed(item)} />
            {item.caption ? <p className="text-caption text-foreground">{item.caption}</p> : null}
            {/* Pushed to the bottom so the audit lines align across a row of uneven legends. */}
            <p className="mt-auto text-caption text-ink-3">
              {t("by", {
                name: item.createdByName ?? t("unknownAuthor"),
                date: formatDate(item.createdAt),
              })}
            </p>
          </li>
        ))}
      </ul>

      <Dialog open={zoomed !== null} onOpenChange={(open) => (open ? null : setZoomed(null))}>
        <DialogContent className="max-w-[min(96vw,1100px)]">
          <DialogTitle className="text-label">{zoomed?.caption || zoomed?.fileName}</DialogTitle>
          {zoomed?.url ? (
            /* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset */
            <img
              src={zoomed.url}
              alt={zoomed.caption ?? zoomed.fileName}
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** The tile itself: a thumbnail for an image, a document chip for a PDF. Both 44 px+. */
export function AttachmentTile({ item, onZoom }: { item: AttachmentItem; onZoom: () => void }) {
  const t = useTranslations("attachments");
  const frame =
    "flex aspect-4/3 w-full items-center justify-center overflow-hidden rounded-lg border border-border bg-n-100 tap-feedback focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

  if (isPdf(item.mimeType)) {
    return (
      <a
        href={item.url ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={item.url ? undefined : true}
        className={cn(frame, "flex-col gap-1 px-2 text-center")}
      >
        <FileTextIcon className="size-8 text-ink-2" aria-hidden />
        <span className="line-clamp-2 text-caption font-medium text-foreground">
          {item.fileName}
        </span>
        <span className="num text-caption text-ink-3">
          {`${t("pdf")} · ${formatBytes(item.sizeBytes)}`}
        </span>
      </a>
    );
  }

  if (!item.url) {
    return (
      <div className={cn(frame, "flex-col gap-1 text-ink-3")}>
        <ImageOffIcon className="size-7" aria-hidden />
        <span className="text-caption">{t("unavailable")}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onZoom}
      className={frame}
      aria-label={t("open", { name: item.fileName })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL, not a static asset */}
      <img
        src={item.url}
        alt={item.caption ?? item.fileName}
        loading="lazy"
        className="size-full object-cover"
      />
    </button>
  );
}
