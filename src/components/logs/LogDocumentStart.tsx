"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CameraIcon, FileTextIcon, ImageIcon, UploadIcon } from "lucide-react";

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
 * Ce par quoi une intervention commence (D119) : son document.
 *
 * Une intervention naît presque toujours d'un papier — la facture du mécanicien, le devis du
 * chantier, le ticket de l'accastilleur — et le carnet le demandait en dernier, une fois les huit
 * champs saisis à la main à côté de la page qui les portait tous. Le document passe donc **en
 * tête du formulaire**, et il est lu par la **même** chaîne qu'un document envoyé par e-mail :
 * même envoi dans le bucket, même ligne de « À valider », même lecture (D91, D92).
 *
 * En tête, et non *avant* : c'est la moitié de la décision qui a coûté un aller-retour. Une
 * première version en faisait un écran à part, avec un « Saisir sans document » pour le
 * traverser — et le parcours §6.2 de SPEC.md, la vidange à quai, gagnait aussitôt un tap qu'il
 * existe précisément pour refuser. Ici les champs sont déjà là : celui qui a la facture en main
 * commence par elle, celui qui vient de faire le travail lui-même tape son titre et n'a rien à
 * traverser. Le budget de taps ne bouge pas d'un seul.
 *
 * Rien n'est perdu si la personne abandonne ensuite : le document est déjà dans « À valider »,
 * d'où il se classe d'un tap.
 */
export function LogDocumentStart({
  boatId,
  read,
  onRead,
}: {
  boatId: string;
  /** The document already read, when there is one: the block then says which. */
  read: ReadDocument | null;
  onRead: (document: ReadDocument) => void;
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
      // A document nobody could read still fills nothing and loses nothing: it is already in
      // « À valider », and the form below is the same form it always was.
      if (!result.data.suggestion) toast.info(ti("uploadedNoRead"));
      setStage(null);
      onRead({ itemId, fileName: uploaded.file.fileName, suggestion: result.data.suggestion });
    } catch {
      setError("upload");
      setStage(null);
    }
  }

  const label = read ? t("replace") : t("title");

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-body font-semibold">{label}</h2>
        <p className="text-caption text-ink-2">{read ? t("readHelp") : t("help")}</p>
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
          variant="outline"
          disabled={busy}
          aria-busy={busy}
          onClick={() => cameraInput.current?.click()}
        >
          <CameraIcon />
          {ta("camera")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => galleryInput.current?.click()}
        >
          <ImageIcon />
          {ta("library")}
        </Button>
        <Button
          type="button"
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
      ) : null}
    </section>
  );
}
