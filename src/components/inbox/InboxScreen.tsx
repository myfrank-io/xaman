"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CameraIcon, CopyIcon, InboxIcon, MailIcon, UploadIcon } from "lucide-react";

import {
  STAGE_PROGRESS,
  uploadFileTo,
  type AttachmentErrorKey,
  type UploadStage,
} from "@/components/attachments/upload";
import type { CategoryChoice } from "@/components/common/CategoryChips";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import type { ContactOption } from "@/components/contacts/specialties";
import { confidentItems, type InboxEngine } from "@/components/inbox/inbox-draft";
import { InboxItemCard } from "@/components/inbox/InboxItemCard";
import { InboxValidateAll } from "@/components/inbox/InboxValidateAll";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { createInboxUpload } from "@/lib/actions/inbox";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import type { InboxItem } from "@/lib/queries/inbox";
import { ATTACHMENT_ACCEPT } from "@/lib/schemas/attachments";
import { inboxStoragePath } from "@/lib/schemas/inbox";

/** The stages of a photo, from the finger to the suggestion: the upload's, then the reading. */
type CaptureStage = UploadStage | "analysing";
const CAPTURE_PROGRESS: Record<CaptureStage, number> = {
  ...STAGE_PROGRESS,
  saving: 60,
  analysing: 80,
};

/** The fallback that stands in for Realtime while `inbox_items` is not published: see below. */
const POLL_FIRST_MS = 3_000;
const POLL_MAX_MS = 15_000;
const POLL_BUDGET_MS = 120_000;

/**
 * « À valider » (D91).
 *
 * Two ways in at the top — the camera, and the boat's own address to copy — then, when several
 * documents were read without a single thing to flag, the one tap that files them all, and the
 * documents waiting for a decision, newest first, then the last ones filed. A document that
 * arrived by mail is read after the webhook answered; while it is, the screen asks again on a
 * budget, so the card fills itself in without anyone pulling to refresh.
 */
export function InboxScreen({
  boatId,
  pending,
  done,
  categories,
  engines,
  contacts,
  canContribute,
  canWrite,
  analysisEnabled,
  inboxAddress,
}: {
  boatId: string;
  pending: InboxItem[];
  done: InboxItem[];
  categories: CategoryChoice[];
  engines: InboxEngine[];
  contacts: ContactOption[];
  canContribute: boolean;
  canWrite: boolean;
  analysisEnabled: boolean;
  /** Null when `INBOUND_EMAIL_DOMAIN` is not configured: the mail door is then simply absent. */
  inboxAddress: string | null;
}) {
  const t = useTranslations("inbox");
  const ta = useTranslations("attachments");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const cameraInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [capture, setCapture] = useState<{
    stage: CaptureStage;
    error: AttachmentErrorKey | null;
  } | null>(null);

  // A document mailed in is read after the webhook answered, and `inbox_items` is not on the
  // Realtime publication yet (see `REALTIME_TABLES`), so the card cannot fill itself in. Until
  // that migration lands, the screen asks again — but on a budget, not forever: every tick
  // re-runs the whole server tree of the layout and the page, and a document that never leaves
  // « Reçu » used to keep that going for as long as the tab stayed open. The delay grows, and
  // the asking stops after two minutes; « Relire le document » is then the way on.
  const readingIds = pending
    .filter((item) => item.status !== "ready")
    .map((item) => item.id)
    .join(",");
  useEffect(() => {
    if (readingIds === "") return;
    let delay = POLL_FIRST_MS;
    let spent = 0;
    let timer: number | undefined;
    const tick = () => {
      spent += delay;
      router.refresh();
      delay = Math.min(Math.round(delay * 1.6), POLL_MAX_MS);
      if (spent + delay > POLL_BUDGET_MS) return;
      timer = window.setTimeout(tick, delay);
    };
    timer = window.setTimeout(tick, delay);
    // A document that arrives, or one that becomes ready, changes the list and starts a new
    // budget: what is waiting now is not what was waiting two minutes ago.
    return () => window.clearTimeout(timer);
  }, [readingIds, router]);

  // « Tout valider » (D91, one tap per document): the documents the reading had nothing to flag.
  // The control shows itself only above two or more of them — below that, the card's own button
  // is already the shortest way — and it is the one that decides, so that the count it reports
  // survives the run that empties the list.
  const confident = confidentItems(pending, {
    boatId,
    engineIds: engines.map((engine) => engine.id),
  });

  async function pick(files: FileList | null) {
    const file = files?.[0];
    if (!file || !canContribute) return;
    // Drawn before anything leaves the device (rule 11): a retry rewrites the same object.
    const itemId = crypto.randomUUID();
    setCapture({ stage: "queued", error: null });
    const uploaded = await uploadFileTo({
      file,
      onStage: (stage) => setCapture({ stage, error: null }),
      storagePathFor: (prepared) =>
        inboxStoragePath({
          boatId,
          itemId,
          fileName: prepared.fileName,
          mimeType: prepared.mimeType,
        }),
    });
    if (!uploaded.ok) {
      setCapture({ stage: "error", error: uploaded.error });
      return;
    }
    setCapture({ stage: analysisEnabled ? "analysing" : "saving", error: null });
    const result = await createInboxUpload({
      id: itemId,
      boatId,
      storagePath: uploaded.file.storagePath,
      fileName: uploaded.file.fileName,
      mimeType: uploaded.file.mimeType,
      sizeBytes: uploaded.file.sizeBytes,
    });
    if (!result.ok) {
      setCapture({ stage: "error", error: "save" });
      toast.error(errorMessage(result.error));
      return;
    }
    setCapture(null);
    toast.success(result.data.suggestion ? t("uploaded") : t("uploadedNoRead"));
    router.refresh();
  }

  async function copyAddress() {
    if (!inboxAddress) return;
    try {
      await navigator.clipboard.writeText(inboxAddress);
      toast.success(t("address.copied"));
    } catch {
      // No clipboard (an old WebView): the address is on screen, selectable.
    }
  }

  const busy = capture !== null && capture.stage !== "error";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {!canWrite ? <p className="text-body text-ink-2">{t("readOnly")}</p> : null}

      {/* The two doors, side by side from `sm`: the camera, and the address. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
          <p className="text-body text-ink-2">{t("captureHelp")}</p>
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
          {capture ? (
            <div className="flex flex-col gap-1" aria-live="polite">
              {capture.stage === "error" ? (
                <p role="alert" className="text-caption font-medium text-state-overdue-fg">
                  {capture.error ? ta(`errors.${capture.error}`) : ta("errors.save")}
                </p>
              ) : (
                <>
                  <Progress value={CAPTURE_PROGRESS[capture.stage]} />
                  <span className="text-caption text-ink-2">
                    {capture.stage === "analysing"
                      ? t("uploadStage.analysing")
                      : ta(`stage.${capture.stage}`)}
                  </span>
                </>
              )}
            </div>
          ) : (
            <p className="text-caption text-ink-3">{ta("hint")}</p>
          )}
        </section>

        {inboxAddress ? (
          <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
            <h2 className="flex items-center gap-2 text-h3">
              <MailIcon aria-hidden className="size-5 text-ink-2" />
              {t("address.title")}
            </h2>
            <p className="text-body text-ink-2">{t("address.help")}</p>
            <p className="rounded-lg border border-border bg-surface px-3 py-2 num text-label break-all select-all">
              {inboxAddress}
            </p>
            <div>
              <Button type="button" variant="outline" onClick={() => void copyAddress()}>
                <CopyIcon />
                {t("address.copy")}
              </Button>
            </div>
          </section>
        ) : null}
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-h2">{t("pending", { count: pending.length })}</h2>
        {canWrite ? <InboxValidateAll boatId={boatId} items={confident} engines={engines} /> : null}
        {pending.length === 0 ? (
          <EmptyState
            icon={<InboxIcon />}
            title={t("empty.title")}
            description={t("empty.description")}
            variant="positive"
          />
        ) : (
          <ul className="flex flex-col gap-4">
            {pending.map((item) => (
              <li key={item.id}>
                <InboxItemCard
                  boatId={boatId}
                  item={item}
                  categories={categories}
                  engines={engines}
                  contacts={contacts}
                  canWrite={canWrite}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 ? (
        <section className="flex flex-col gap-4">
          <h2 className="text-h3 text-ink-2">{t("history")}</h2>
          <ul className="flex flex-col gap-3">
            {done.map((item) => (
              <li key={item.id}>
                <InboxItemCard
                  boatId={boatId}
                  item={item}
                  categories={categories}
                  engines={engines}
                  contacts={contacts}
                  canWrite={canWrite}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
