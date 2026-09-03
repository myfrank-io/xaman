"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckIcon, FileTextIcon, TrashIcon, UploadIcon } from "lucide-react";

import {
  uploadAttachmentFile,
  STAGE_PROGRESS,
  type AttachmentErrorKey,
  type UploadStage,
} from "@/components/attachments/upload";
import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { saveAttachment } from "@/lib/actions/attachments";
import { saveLog } from "@/lib/actions/logs";
import { formatBytes, rejectionReason } from "@/lib/attachments/image";
import { formatDate, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ATTACHMENT_ACCEPT } from "@/lib/schemas/attachments";
import { cn } from "@/lib/utils";

export type DocumentImportLog = { id: string; title: string; performedAt: string };

type Mode = "existing" | "new";

type Row = {
  key: string;
  file: File;
  previewUrl: string | null;
  /** Where it should go. Nothing is uploaded until this is decided. */
  mode: Mode;
  logId: string;
  newTitle: string;
  newDate: string;
  newCategoryId: string;
  stage: UploadStage | null;
  error: AttachmentErrorKey | null;
  /** Title of the intervention it ended up on, once done. */
  attachedTo: string | null;
};

/**
 * « Importer des documents » (E10-1). The pile of invoices and photos of a season, dropped at
 * once. Nothing is uploaded before someone has said where it goes: a file that cannot be
 * matched simply stays in the list with its question open — it is never silently dropped, and
 * it never leaves an orphan object in the bucket.
 */
export function DocumentImport({
  boatId,
  logs,
  categories,
  canWrite,
}: {
  boatId: string;
  logs: DocumentImportLog[];
  categories: CategoryChoice[];
  canWrite: boolean;
}) {
  const t = useTranslations("attachments.import");
  const ta = useTranslations("attachments");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [dragging, setDragging] = useState(false);

  const patch = useCallback((key: string, changes: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }, []);

  const add = useCallback(
    (files: FileList | File[] | null) => {
      const picked = [...(files ?? [])];
      if (picked.length === 0) return;
      setRows((current) => [
        ...current,
        ...picked.map((file) => ({
          key: crypto.randomUUID(),
          file,
          previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
          mode: (logs.length > 0 ? "existing" : "new") as Mode,
          logId: "",
          newTitle: file.name.replace(/\.[a-z0-9]{1,8}$/i, ""),
          newDate: todayString(),
          newCategoryId: categories[0]?.id ?? "",
          stage: null,
          error: rejectionReason(file),
          attachedTo: null,
        })),
      ]);
    },
    [categories, logs.length],
  );

  /** Uploads the file and writes its row, creating the intervention first when asked to. */
  async function attach(row: Row) {
    patch(row.key, { stage: "queued", error: null });

    let logId = row.logId;
    let logTitle = logs.find((log) => log.id === row.logId)?.title ?? "";

    if (row.mode === "new") {
      const id = crypto.randomUUID();
      const created = await saveLog({
        id,
        boatId,
        title: row.newTitle.trim(),
        categoryId: row.newCategoryId,
        status: "done",
        performedAt: row.newDate,
        cost: null,
        contactId: null,
        equipmentId: null,
        haulOutId: null,
        notes: null,
        engineHours: [],
        checklistItemIds: [],
      });
      if (!created.ok) {
        patch(row.key, { stage: "error", error: null });
        toast.error(errorMessage(created.error));
        return;
      }
      logId = created.data.logId;
      logTitle = row.newTitle.trim();
    }

    const attachmentId = crypto.randomUUID();
    const owner = { type: "maintenance_log" as const, id: logId };
    const uploaded = await uploadAttachmentFile({
      boatId,
      owner,
      attachmentId,
      file: row.file,
      onStage: (stage) => patch(row.key, { stage }),
    });
    if (!uploaded.ok) {
      patch(row.key, { stage: "error", error: uploaded.error });
      return;
    }

    patch(row.key, { stage: "saving" });
    const saved = await saveAttachment({
      id: attachmentId,
      boatId,
      ownerType: "maintenance_log",
      ownerId: logId,
      storagePath: uploaded.file.storagePath,
      fileName: uploaded.file.fileName,
      mimeType: uploaded.file.mimeType,
      sizeBytes: uploaded.file.sizeBytes,
      caption: null,
    });
    if (!saved.ok) {
      patch(row.key, { stage: "error", error: "save" });
      toast.error(errorMessage(saved.error));
      return;
    }
    patch(row.key, { stage: "done", attachedTo: logTitle });
    router.refresh();
  }

  const waiting = rows.filter((row) => row.stage !== "done").length;
  const attached = rows.filter((row) => row.stage === "done").length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("description")} />

      {!canWrite ? <p className="text-body text-ink-2">{t("readOnly")}</p> : null}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          add(event.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border-strong bg-surface p-6 text-center",
          dragging && "border-primary bg-primary/5",
        )}
      >
        <UploadIcon className="size-7 text-ink-2" aria-hidden />
        <p className="text-body text-ink-2">{t("drop")}</p>
        <input
          ref={fileInput}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          multiple
          className="sr-only"
          onChange={(event) => {
            add(event.target.files);
            event.target.value = "";
          }}
        />
        <Button type="button" disabled={!canWrite} onClick={() => fileInput.current?.click()}>
          {t("choose")}
        </Button>
        <p className="text-caption text-ink-3">{ta("hint")}</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon />}
          title={t("emptyTitle")}
          description={t("emptyDescription")}
        />
      ) : (
        <>
          <p className="text-caption text-ink-2">
            {waiting > 0 ? t("pending", { count: waiting }) : t("done", { count: attached })}
          </p>
          <ul className="flex flex-col gap-4">
            {rows.map((row) => (
              <li
                key={row.key}
                className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-n-100">
                    {row.previewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- local blob preview */
                      <img src={row.previewUrl} alt="" className="size-full object-cover" />
                    ) : (
                      <FileTextIcon className="size-6 text-ink-2" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-label font-medium text-foreground">
                      {row.file.name}
                    </p>
                    <p className="num text-caption text-ink-3">{formatBytes(row.file.size)}</p>
                    {row.error ? (
                      <p role="alert" className="text-caption font-medium text-state-overdue-fg">
                        {ta(`errors.${row.error}`)}
                      </p>
                    ) : null}
                    {row.stage && row.stage !== "done" && row.stage !== "error" ? (
                      <div className="mt-2 flex flex-col gap-1">
                        <Progress value={STAGE_PROGRESS[row.stage]} />
                        <span className="text-caption text-ink-2">{ta(`stage.${row.stage}`)}</span>
                      </div>
                    ) : null}
                  </div>
                  {row.stage === "done" ? (
                    <span className="text-state-done-fg flex shrink-0 items-center gap-1 text-caption font-medium">
                      <CheckIcon className="size-4" aria-hidden />
                      {t("attached", { title: row.attachedTo ?? "" })}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label={t("discard")}
                      onClick={() =>
                        setRows((current) => current.filter((entry) => entry.key !== row.key))
                      }
                    >
                      <TrashIcon />
                    </Button>
                  )}
                </div>

                {row.stage !== "done" ? (
                  <div className="flex flex-col gap-4">
                    <ToggleGroup
                      type="single"
                      value={row.mode}
                      aria-label={t("existingLabel")}
                      onValueChange={(next) => next && patch(row.key, { mode: next as Mode })}
                    >
                      <ToggleGroupItem
                        value="existing"
                        className="min-h-11"
                        disabled={logs.length === 0}
                      >
                        {t("modeExisting")}
                      </ToggleGroupItem>
                      <ToggleGroupItem value="new" className="min-h-11">
                        {t("modeNew")}
                      </ToggleGroupItem>
                    </ToggleGroup>

                    {row.mode === "existing" ? (
                      <Field id={`doc-log-${row.key}`} label={t("existingLabel")}>
                        <NativeSelect
                          id={`doc-log-${row.key}`}
                          value={row.logId}
                          onChange={(event) => patch(row.key, { logId: event.target.value })}
                        >
                          <option value="">{t("existingPlaceholder")}</option>
                          {logs.map((log) => (
                            <option key={log.id} value={log.id}>
                              {`${formatDate(log.performedAt)} — ${log.title}`}
                            </option>
                          ))}
                        </NativeSelect>
                      </Field>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="grid gap-4 sm:grid-cols-2">
                          <Field id={`doc-title-${row.key}`} label={t("newTitle")} required>
                            <Input
                              id={`doc-title-${row.key}`}
                              value={row.newTitle}
                              autoComplete="off"
                              autoCapitalize="sentences"
                              onChange={(event) => patch(row.key, { newTitle: event.target.value })}
                            />
                          </Field>
                          <Field id={`doc-date-${row.key}`} label={t("newDate")} required>
                            <DateField
                              id={`doc-date-${row.key}`}
                              value={row.newDate}
                              onValueChange={(value) => patch(row.key, { newDate: value })}
                            />
                          </Field>
                        </div>
                        <div className="grid gap-2">
                          <Label>{t("newCategory")}</Label>
                          <CategoryChips
                            categories={categories}
                            value={row.newCategoryId}
                            onValueChange={(id) => patch(row.key, { newCategoryId: id })}
                            label={t("newCategory")}
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <Button
                        type="button"
                        disabled={
                          !canWrite ||
                          row.error !== null ||
                          (row.stage !== null && row.stage !== "error") ||
                          (row.mode === "existing"
                            ? !row.logId
                            : !row.newTitle.trim() || !row.newCategoryId)
                        }
                        onClick={() => void attach(row)}
                      >
                        {row.mode === "existing" ? t("attach") : t("createAndAttach")}
                      </Button>
                    </div>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {logs.length === 0 ? <p className="text-caption text-ink-3">{t("noLogs")}</p> : null}
    </div>
  );
}
