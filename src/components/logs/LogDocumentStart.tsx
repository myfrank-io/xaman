"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CameraIcon, FileTextIcon, ImageIcon, PencilLineIcon, UploadIcon } from "lucide-react";

import {
  STAGE_PROGRESS,
  uploadFileTo,
  type AttachmentErrorKey,
  type UploadStage,
} from "@/components/attachments/upload";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createInboxUpload } from "@/lib/actions/inbox";
import { rejectionReason } from "@/lib/attachments/image";
import { formatBytes } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { ATTACHMENT_ACCEPT } from "@/lib/schemas/attachments";
import { inboxStoragePath, type InboxSuggestion } from "@/lib/schemas/inbox";

/** The stages of one document, from the finger to the form: the upload's, then the reading. */
type Stage = UploadStage | "analysing";
const PROGRESS: Record<Stage, number> = { ...STAGE_PROGRESS, saving: 60, analysing: 80 };

export type ReadDocument = {
  itemId: string;
  fileName: string;
  suggestion: InboxSuggestion | null;
};

/**
 * Ce par quoi une intervention commence (D115) : son document.
 *
 * Une intervention naît presque toujours d'un papier — la facture du mécanicien, le devis du
 * chantier, le ticket de l'accastilleur — et le carnet le demandait en dernier, une fois les huit
 * champs saisis à la main à côté de la page qui les portait tous. L'écran les demande donc dans
 * l'ordre inverse : le document d'abord, lu par la **même** chaîne qu'un document envoyé par
 * e-mail (même envoi dans le bucket, même ligne de « À valider », même lecture), puis le
 * formulaire déjà rempli de ce qu'elle en a tiré.
 *
 * Rien n'est obligatoire : « Saisir sans document » ouvre le formulaire vide, et c'est le chemin
 * de l'intervention faite par l'équipage, qui n'a pas de facture. Rien n'est perdu non plus si la
 * personne abandonne ensuite : le document est déjà dans « À valider », d'où il se classe d'un
 * tap.
 */
export function LogDocumentStart({
  boatId,
  onRead,
  onSkip,
}: {
  boatId: string;
  onRead: (document: ReadDocument) => void;
  onSkip: () => void;
}) {
  const t = useTranslations("logs.document");
  const ta = useTranslations("attachments");
  const ti = useTranslations("inbox");
  const errorMessage = useErrorMessage();
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<Stage | null>(null);
  const [error, setError] = useState<AttachmentErrorKey | null>(null);

  const busy = stage !== null;

  async function pick(files: FileList | null) {
    const picked = files?.[0];
    if (!picked || busy) return;
    setFile(picked);
    setError(null);

    const rejected = rejectionReason(picked);
    if (rejected) {
      setError(rejected);
      setStage(null);
      return;
    }

    // The id is drawn before anything leaves the device (rule 11): a retry rewrites the same
    // object and the same row of the inbox rather than piling up documents.
    const itemId = crypto.randomUUID();
    setStage("queued");
    try {
      const uploaded = await uploadFileTo({
        file: picked,
        onStage: setStage,
        storagePathFor: (prepared) =>
          inboxStoragePath({
            boatId,
            itemId,
            fileName: prepared.fileName,
            mimeType: prepared.mimeType,
          }),
      });
      if (!uploaded.ok) {
        setError(uploaded.error);
        setStage(null);
        return;
      }
      setStage("analysing");
      const result = await createInboxUpload({
        id: itemId,
        boatId,
        storagePath: uploaded.file.storagePath,
        fileName: uploaded.file.fileName,
        mimeType: uploaded.file.mimeType,
        sizeBytes: uploaded.file.sizeBytes,
        // One document, one person waiting: a bar on screen beats a card that says « lecture… ».
        deferReading: false,
      });
      if (!result.ok) {
        setError("save");
        setStage(null);
        toast.error(errorMessage(result.error));
        return;
      }
      // A document nobody could read still opens the form — with its own name in hand and the
      // file already filed. Nothing is ever lost between the upload and the saisie.
      if (!result.data.suggestion) toast.info(ti("uploadedNoRead"));
      onRead({
        itemId,
        fileName: uploaded.file.fileName,
        suggestion: result.data.suggestion,
      });
    } catch {
      setError("upload");
      setStage(null);
    }
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
      <div className="flex flex-col gap-1">
        <h2 className="text-title">{t("title")}</h2>
        <p className="text-body text-ink-2">{t("help")}</p>
      </div>

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
        ref={galleryInput}
        type="file"
        accept="image/*"
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
          disabled={busy}
          aria-busy={busy}
          onClick={() => cameraInput.current?.click()}
        >
          <CameraIcon />
          {ta("camera")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={busy}
          onClick={() => galleryInput.current?.click()}
        >
          <ImageIcon />
          {ta("library")}
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          <UploadIcon />
          {ta("files")}
        </Button>
      </div>

      {file && (busy || error) ? (
        <div className="flex items-start gap-3" aria-live="polite">
          <FileTextIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-ink-2" />
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <p className="truncate text-caption text-ink-2">
              {file.name} · <span className="num">{formatBytes(file.size)}</span>
            </p>
            {error ? (
              <p role="alert" className="text-caption font-medium text-state-overdue-fg">
                {ta(`errors.${error}`)}
              </p>
            ) : (
              <>
                <Progress value={PROGRESS[stage ?? "queued"]} />
                <span className="text-caption text-ink-2">
                  {stage === "analysing" ? t("reading") : ta(`stage.${stage ?? "queued"}`)}
                </span>
              </>
            )}
          </div>
        </div>
      ) : (
        <p className="text-caption text-ink-3">{ta("hint")}</p>
      )}

      {/* The crew's own work has no invoice: this is its door, and it is never hidden. */}
      <Button type="button" variant="ghost" className="self-start px-2" onClick={onSkip}>
        <PencilLineIcon />
        {t("skip")}
      </Button>
    </section>
  );
}
