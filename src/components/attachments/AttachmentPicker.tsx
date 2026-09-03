"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CameraIcon,
  FileTextIcon,
  FolderOpenIcon,
  ImageIcon,
  RotateCcwIcon,
  TrashIcon,
} from "lucide-react";

import { AttachmentTile } from "@/components/attachments/AttachmentGallery";
import {
  removeOrphanObject,
  signedUrlFor,
  uploadAttachmentFile,
  STAGE_PROGRESS,
  type AttachmentErrorKey,
  type UploadStage,
} from "@/components/attachments/upload";
import { undoToast } from "@/components/common/UndoToast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/attachments/image";
import {
  restoreAttachment,
  saveAttachment,
  trashAttachment,
  updateAttachmentCaption,
} from "@/lib/actions/attachments";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import type { AttachmentItem } from "@/lib/queries/use-attachments";
import {
  ATTACHMENT_ACCEPT,
  isPdf,
  type AttachmentOwner,
  type SaveAttachmentInput,
} from "@/lib/schemas/attachments";

/** One line of the picker: an already stored document, or one on its way up. */
export type PickedAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption: string;
  /** Legend as the database holds it: the blur only writes when the two differ. */
  savedCaption: string;
  storagePath: string | null;
  previewUrl: string | null;
  stage: UploadStage;
  /** Translation key under `attachments.errors`, when the stage is `error`. */
  error: AttachmentErrorKey | null;
  /** true once the `attachments` row exists (edit mode), false while it is only an object. */
  persisted: boolean;
  createdAt: string;
  createdByName: string | null;
};

function fromStored(item: AttachmentItem): PickedAttachment {
  return {
    id: item.id,
    fileName: item.fileName,
    mimeType: item.mimeType,
    sizeBytes: item.sizeBytes,
    caption: item.caption ?? "",
    savedCaption: item.caption ?? "",
    storagePath: item.storagePath,
    previewUrl: item.url,
    stage: "done",
    error: null,
    persisted: true,
    createdAt: item.createdAt,
    createdByName: item.createdByName,
  };
}

/** What the form commits once the row it hangs off exists. */
export function pendingRows(
  items: PickedAttachment[],
  owner: AttachmentOwner,
): Omit<SaveAttachmentInput, "boatId">[] {
  return items
    .filter((item) => !item.persisted && item.stage === "done" && item.storagePath)
    .map((item) => ({
      id: item.id,
      ownerType: owner.type,
      ownerId: owner.id,
      storagePath: item.storagePath as string,
      fileName: item.fileName,
      mimeType: item.mimeType,
      sizeBytes: item.sizeBytes,
      caption: item.caption.trim() || null,
    }));
}

/**
 * « Photos et factures » (E10-1). Three ways in, because an iPad offers three: the camera, the
 * photo library and Files. Every photograph is reduced in the browser before it leaves the
 * boat, each file carries its own progress and its own failure — one that fails never stops
 * the others — and the delete goes through the soft delete with an « Annuler ».
 *
 * `deferred` is the creation form: the objects go up while the form is being typed (the id of
 * the intervention is already drawn), and the rows are written by the form once the
 * intervention exists. `onItemsChange` hands them back for that commit.
 */
export function AttachmentPicker({
  boatId,
  owner,
  initial = [],
  deferred = false,
  disabled = false,
  onItemsChange,
}: {
  boatId: string;
  owner: AttachmentOwner;
  initial?: AttachmentItem[];
  deferred?: boolean;
  disabled?: boolean;
  onItemsChange?: (items: PickedAttachment[]) => void;
}) {
  const t = useTranslations("attachments");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const [items, setItems] = useState<PickedAttachment[]>(() => initial.map(fromStored));
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const filesInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef<string[]>([]);

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  // Published after the render, never from inside the state updater: telling the parent while
  // React is reducing this component's state is what produces the « cannot update while
  // rendering » warning.
  const notify = useRef(onItemsChange);
  useEffect(() => {
    notify.current = onItemsChange;
  }, [onItemsChange]);
  useEffect(() => {
    notify.current?.(items);
  }, [items]);

  const patch = useCallback((id: string, changes: Partial<PickedAttachment>) => {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)));
  }, []);

  const handleFiles = useCallback(
    async (files: FileList | File[] | null) => {
      const picked = [...(files ?? [])];
      if (picked.length === 0) return;

      const queued: PickedAttachment[] = picked.map((file) => ({
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        caption: "",
        savedCaption: "",
        storagePath: null,
        // A local preview keeps the tile from being an empty box while the bytes travel.
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        stage: "queued",
        error: null,
        persisted: false,
        createdAt: new Date().toISOString(),
        createdByName: null,
      }));
      queued.forEach((item) => {
        if (item.previewUrl) objectUrls.current.push(item.previewUrl);
      });
      setItems((current) => [...current, ...queued]);

      // One at a time: a hotspot at anchor does not share well, and a failure stays local.
      for (const [index, item] of queued.entries()) {
        const file = picked[index];
        if (!file) continue;
        const result = await uploadAttachmentFile({
          boatId,
          owner,
          attachmentId: item.id,
          file,
          onStage: (stage) => patch(item.id, { stage }),
        });
        if (!result.ok) {
          patch(item.id, { stage: "error", error: result.error });
          continue;
        }

        const uploaded = result.file;
        patch(item.id, {
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          storagePath: uploaded.storagePath,
        });

        if (deferred) {
          patch(item.id, { stage: "done" });
          continue;
        }

        patch(item.id, { stage: "saving" });
        const saved = await saveAttachment({
          id: item.id,
          boatId,
          ownerType: owner.type,
          ownerId: owner.id,
          storagePath: uploaded.storagePath,
          fileName: uploaded.fileName,
          mimeType: uploaded.mimeType,
          sizeBytes: uploaded.sizeBytes,
          caption: null,
        });
        if (!saved.ok) {
          patch(item.id, { stage: "error", error: "save" });
          toast.error(errorMessage(saved.error));
          continue;
        }
        const url = await signedUrlFor(uploaded.storagePath);
        patch(item.id, { stage: "done", persisted: true, previewUrl: url ?? item.previewUrl });
      }
    },
    [boatId, owner, deferred, patch, errorMessage],
  );

  function retry(item: PickedAttachment) {
    // The File is gone once the input is cleared: ask for it again rather than pretend.
    setItems((current) => current.filter((row) => row.id !== item.id));
    filesInput.current?.click();
  }

  async function remove(item: PickedAttachment) {
    if (!item.persisted) {
      setItems((current) => current.filter((row) => row.id !== item.id));
      if (item.storagePath) await removeOrphanObject(item.storagePath);
      return;
    }
    const result = await trashAttachment({ boatId, attachmentId: item.id });
    if (!result.ok) {
      toast.error(errorMessage(result.error));
      return;
    }
    setItems((current) => current.filter((row) => row.id !== item.id));
    undoToast({
      message: t("removed"),
      undoLabel: tc("undo"),
      onUndo: () => {
        void restoreAttachment({ boatId, attachmentId: item.id }).then((restored) => {
          if (restored.ok) setItems((current) => [...current, item]);
          else toast.error(errorMessage(restored.error));
        });
      },
    });
  }

  async function saveCaption(item: PickedAttachment, caption: string) {
    if (!item.persisted || caption.trim() === item.savedCaption.trim()) return;
    const result = await updateAttachmentCaption({
      boatId,
      attachmentId: item.id,
      caption: caption.trim() || null,
    });
    if (!result.ok) {
      toast.error(errorMessage(result.error));
      return;
    }
    patch(item.id, { savedCaption: caption.trim() });
  }

  const busy = items.some((item) => item.stage !== "done" && item.stage !== "error");

  return (
    <div className="flex flex-col gap-4">
      {/* Clipped to a pixel: real buttons open them, nobody aims a finger at a file input. */}
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
      <input
        ref={filesInput}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        multiple
        className="sr-only"
        onChange={(event) => {
          void handleFiles(event.target.files);
          event.target.value = "";
        }}
      />

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => cameraInput.current?.click()}
        >
          <CameraIcon />
          {t("camera")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => libraryInput.current?.click()}
        >
          <ImageIcon />
          {t("library")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          onClick={() => filesInput.current?.click()}
        >
          <FolderOpenIcon />
          {t("files")}
        </Button>
      </div>

      <p className="text-caption text-ink-3">{t("hint")}</p>

      {items.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="w-24 shrink-0">
                  {item.previewUrl && !isPdf(item.mimeType) ? (
                    <AttachmentTile
                      item={{
                        id: item.id,
                        fileName: item.fileName,
                        mimeType: item.mimeType,
                        sizeBytes: item.sizeBytes,
                        caption: item.caption || null,
                        storagePath: item.storagePath ?? "",
                        createdAt: item.createdAt,
                        createdByName: item.createdByName,
                        url: item.previewUrl,
                      }}
                      onZoom={() => window.open(item.previewUrl ?? "", "_blank", "noopener")}
                    />
                  ) : (
                    <div className="flex aspect-4/3 w-full items-center justify-center rounded-lg border border-border bg-n-100">
                      <FileTextIcon className="size-7 text-ink-2" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-label font-medium text-foreground">{item.fileName}</p>
                  <p className="num text-caption text-ink-3">{formatBytes(item.sizeBytes)}</p>
                  {item.stage !== "done" && item.stage !== "error" ? (
                    <div className="mt-2 flex flex-col gap-1">
                      <Progress value={STAGE_PROGRESS[item.stage]} />
                      <span className="text-caption text-ink-2">{t(`stage.${item.stage}`)}</span>
                    </div>
                  ) : null}
                  {item.stage === "error" ? (
                    <p role="alert" className="mt-1 text-caption font-medium text-state-overdue-fg">
                      {t(`errors.${item.error ?? "upload"}`)}
                    </p>
                  ) : null}
                </div>
              </div>

              {item.stage === "done" ? (
                <Input
                  aria-label={t("caption")}
                  placeholder={t("caption")}
                  value={item.caption}
                  disabled={disabled}
                  onChange={(event) => patch(item.id, { caption: event.target.value })}
                  onBlur={(event) => void saveCaption(item, event.target.value)}
                />
              ) : null}

              <div className="flex flex-wrap gap-2">
                {item.stage === "error" ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => retry(item)}>
                    <RotateCcwIcon />
                    {tc("retry")}
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={disabled}
                  onClick={() => void remove(item)}
                >
                  <TrashIcon />
                  {tc("delete")}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {deferred && busy ? <p className="text-caption text-ink-2">{t("deferredBusy")}</p> : null}
    </div>
  );
}
