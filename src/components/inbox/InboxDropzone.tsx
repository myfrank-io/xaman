"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CameraIcon, FileTextIcon, UploadIcon } from "lucide-react";

import {
  STAGE_PROGRESS,
  uploadFileTo,
  type AttachmentErrorKey,
  type UploadStage,
} from "@/components/attachments/upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createInboxUpload } from "@/lib/actions/inbox";
import { formatBytes, rejectionReason } from "@/lib/attachments/image";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ATTACHMENT_ACCEPT } from "@/lib/schemas/attachments";
import { inboxStoragePath } from "@/lib/schemas/inbox";
import { cn } from "@/lib/utils";

/** The stages of a document, from the finger to the card: the upload's, then the reading. */
type CaptureStage = UploadStage | "analysing";
const CAPTURE_PROGRESS: Record<CaptureStage, number> = {
  ...STAGE_PROGRESS,
  saving: 60,
  analysing: 80,
};

type Row = {
  /** Also the inbox item's id — drawn before anything leaves the device (rule 11). */
  key: string;
  file: File;
  stage: CaptureStage;
  error: AttachmentErrorKey | null;
};

/**
 * The one door documents come in by (D95): the camera for a ticket, the picker or a drop for a
 * pile of invoices. Every file becomes a row of the inbox and is read by the agent; the cards
 * appear below, pre-filled, and « Valider » is what writes the carnet.
 *
 * Sequential on purpose — one file at a time from a phone on a marina's wifi. One file is read
 * while the person waits, bar on screen; several are read after the response, each behind its
 * own action, and the inbox's polling fills the cards in as they come out. A file that fails
 * keeps its line and its reason; the others still land.
 *
 * Mounted by « À valider » and by step 2 of the mise en route (`embedded`: the step's own text
 * has already said what this is).
 */
export function InboxDropzone({
  boatId,
  canContribute,
  embedded = false,
  onReceived,
}: {
  boatId: string;
  canContribute: boolean;
  embedded?: boolean;
  /** How many documents landed in the inbox, for a parent that counts them. */
  onReceived?: (count: number) => void;
}) {
  const t = useTranslations("inbox");
  const ta = useTranslations("attachments");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);

  const busy = rows.some((row) => row.stage !== "done" && row.stage !== "error");

  const patch = (key: string, changes: Partial<Row>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));

  async function pick(files: FileList | File[] | null) {
    const picked = [...(files ?? [])];
    if (picked.length === 0 || !canContribute || busy) return;
    // A pile reads after the response; a single photo reads while the bar is on screen.
    const defer = picked.length > 1;
    const next: Row[] = picked.map((file) => ({
      key: crypto.randomUUID(),
      file,
      stage: "queued",
      error: rejectionReason(file),
    }));
    setRows(next);

    let received = 0;
    let readOnTheSpot = false;
    for (const row of next) {
      if (row.error) {
        patch(row.key, { stage: "error" });
        continue;
      }
      // A thrown error — a network that drops mid-upload, a client that cannot be built — is
      // this file's failure, shown on its line; never a list frozen on « Envoi… » with its
      // buttons greyed out (rule 13).
      try {
        const uploaded = await uploadFileTo({
          file: row.file,
          onStage: (stage) => patch(row.key, { stage }),
          storagePathFor: (prepared) =>
            inboxStoragePath({
              boatId,
              itemId: row.key,
              fileName: prepared.fileName,
              mimeType: prepared.mimeType,
            }),
        });
        if (!uploaded.ok) {
          patch(row.key, { stage: "error", error: uploaded.error });
          continue;
        }
        patch(row.key, { stage: defer ? "saving" : "analysing" });
        const result = await createInboxUpload({
          id: row.key,
          boatId,
          storagePath: uploaded.file.storagePath,
          fileName: uploaded.file.fileName,
          mimeType: uploaded.file.mimeType,
          sizeBytes: uploaded.file.sizeBytes,
          deferReading: defer,
        });
        if (!result.ok) {
          patch(row.key, { stage: "error", error: "save" });
          toast.error(errorMessage(result.error));
          continue;
        }
        if (result.data.suggestion) readOnTheSpot = true;
        patch(row.key, { stage: "done" });
        received += 1;
      } catch {
        patch(row.key, { stage: "error", error: "upload" });
      }
    }

    // The lines that landed have a card now; only the failures stay, with their reason.
    setRows((current) => current.filter((row) => row.stage === "error"));
    if (received === 0) return;
    toast.success(
      defer
        ? t("uploadedMany", { count: received })
        : readOnTheSpot
          ? t("uploaded")
          : t("uploadedNoRead"),
    );
    onReceived?.(received);
    router.refresh();
  }

  return (
    <section
      onDragOver={(event) => {
        event.preventDefault();
        if (canContribute) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        void pick(event.dataTransfer.files);
      }}
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm",
        dragging && "border-2 border-dashed border-primary bg-primary/5",
      )}
    >
      {embedded ? null : <p className="text-body text-ink-2">{t("captureHelp")}</p>}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void pick(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={fileInput}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          void pick(event.target.files);
          event.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="lg"
          disabled={!canContribute || busy}
          aria-busy={busy}
          onClick={() => cameraInput.current?.click()}
        >
          <CameraIcon />
          {t("capture")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={!canContribute || busy}
          onClick={() => fileInput.current?.click()}
        >
          <UploadIcon />
          {t("choose")}
        </Button>
      </div>
      {rows.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-live="polite">
          {rows.map((row) => (
            <li key={row.key} className="flex items-start gap-3">
              <FileTextIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="truncate text-caption text-ink-2">
                  {row.file.name} · <span className="num">{formatBytes(row.file.size)}</span>
                </p>
                {row.stage === "error" ? (
                  <p role="alert" className="text-caption font-medium text-state-overdue-fg">
                    {ta(`errors.${row.error ?? "save"}`)}
                  </p>
                ) : (
                  <>
                    <Progress value={CAPTURE_PROGRESS[row.stage]} />
                    <span className="text-caption text-ink-2">
                      {row.stage === "analysing"
                        ? t("uploadStage.analysing")
                        : ta(`stage.${row.stage}`)}
                    </span>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-caption text-ink-3">{embedded ? ta("hint") : t("drop")}</p>
      )}
    </section>
  );
}
