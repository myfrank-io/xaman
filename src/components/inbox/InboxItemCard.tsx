"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CameraIcon,
  CheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  MailIcon,
  PencilIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { ContactOption } from "@/components/contacts/specialties";
import {
  draftFrom,
  isConfidentItem,
  toValidateInput,
  type InboxDraft,
  type InboxEngine,
} from "@/components/inbox/inbox-draft";
import { InboxItemForm } from "@/components/inbox/InboxItemForm";
import { InboxItemSummary } from "@/components/inbox/InboxItemSummary";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  deleteInboxItem,
  dismissInboxItem,
  reanalyseInboxItem,
  reopenInboxItem,
  validateInboxItem,
} from "@/lib/actions/inbox";
import { formatBytes, formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { logPath, suppliesPath } from "@/lib/queries/boat-routes";
import type { InboxItem } from "@/lib/queries/inbox";
import { isPdf } from "@/lib/schemas/attachments";
import { validateInboxItemSchema, isInboxWarningCode } from "@/lib/schemas/inbox";
import { cn } from "@/lib/utils";

/**
 * One document of the inbox (D91): the file on the left, what the reading proposes on the right,
 * every field editable, and two buttons. « Valider » is the tap that writes the carnet; nothing
 * is written before it, and the person sees exactly what will be.
 *
 * How much of it is shown depends on the reading. A document the reading had nothing to flag
 * opens on one line — kind, title, date, amount, supplier — because filing it should cost the tap
 * it is worth; « Modifier » opens the full form, unchanged, and every field stays editable. A
 * document that carries a warning opens on the form: the warning is what earns the second look
 * (D92, D94).
 */
export function InboxItemCard({
  boatId,
  item,
  categories,
  engines,
  contacts,
  canWrite,
}: {
  boatId: string;
  item: InboxItem;
  categories: CategoryChoice[];
  engines: InboxEngine[];
  contacts: ContactOption[];
  canWrite: boolean;
}) {
  const t = useTranslations("inbox");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<InboxDraft>(() => draftFrom(item, item.suggestion));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const patch = (changes: Partial<InboxDraft>) =>
    setDraft((current) => ({ ...current, ...changes }));
  const reading = item.status === "received" || item.status === "analysing";
  const settled = item.status === "validated" || item.status === "dismissed";
  const engineIds = engines.map((engine) => engine.id);
  const confident = isConfidentItem(item, { boatId, engineIds });
  const showSummary = confident && !expanded;
  // The full list, `local` included (D94), on the form. The summary says the same thing in its
  // own sentence, so the box would only repeat it there.
  const warnings = showSummary ? [] : (item.suggestion?.warnings ?? []);

  function validate() {
    const parsed = validateInboxItemSchema.safeParse(
      toValidateInput(draft, { boatId, itemId: item.id, engineIds }),
    );
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[issue.path.map(String).join(".")] = issue.message;
      setErrors(next);
      // Whatever the summary was hiding is what has to be corrected: show the fields.
      setExpanded(true);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await validateInboxItem(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("validated", { title: parsed.data.title }));
      router.refresh();
    });
  }

  function dismiss() {
    startTransition(async () => {
      const result = await dismissInboxItem({ boatId, itemId: item.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("dismissed"));
      router.refresh();
    });
  }

  /** « Réouvrir » (D93): the card goes back up to « À valider », with the reading it already had. */
  function reopen() {
    startTransition(async () => {
      const result = await reopenInboxItem({ boatId, itemId: item.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("reopened"));
      router.refresh();
    });
  }

  /** « Supprimer » (D93): the row and the file, for good — hence the dialog that names it. */
  function remove() {
    startTransition(async () => {
      const result = await deleteInboxItem({ boatId, itemId: item.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      setConfirmingDelete(false);
      toast.success(t("deleted"));
      router.refresh();
    });
  }

  function reanalyse() {
    startTransition(async () => {
      const result = await reanalyseInboxItem({ boatId, itemId: item.id });
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      if (result.data.suggestion) setDraft(draftFrom(item, result.data.suggestion));
      router.refresh();
    });
  }

  const meta = [
    item.source === "email" && item.senderEmail
      ? t("from", {
          sender: item.senderName ? `${item.senderName} (${item.senderEmail})` : item.senderEmail,
        })
      : t(`source.${item.source}`),
    formatDate(item.receivedAt.slice(0, 10)),
  ].join(" · ");

  return (
    <article
      className={cn(
        "flex flex-col gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm",
        settled && "bg-surface-2",
      )}
    >
      <div className="flex items-start gap-3">
        <a
          href={item.url ?? undefined}
          target="_blank"
          rel="noreferrer"
          aria-label={t("open")}
          className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-n-100 sm:size-24"
        >
          {item.url && !isPdf(item.mimeType) ? (
            /* eslint-disable-next-line @next/next/no-img-element -- signed bucket URL */
            <img src={item.url} alt="" className="size-full object-cover" />
          ) : (
            <FileTextIcon className="size-7 text-ink-2" aria-hidden />
          )}
        </a>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-caption text-ink-2">
            {item.source === "email" ? (
              <MailIcon aria-hidden className="size-4 shrink-0" />
            ) : (
              <CameraIcon aria-hidden className="size-4 shrink-0" />
            )}
            <span className="truncate">{meta}</span>
          </p>
          {item.subject ? (
            <p className="truncate text-label font-medium text-foreground">
              {t("subjectLabel", { subject: item.subject })}
            </p>
          ) : null}
          <p className="truncate num text-caption text-ink-3">
            {item.fileName} · {formatBytes(item.sizeBytes)}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {/* Short words: an uppercase badge is 200 px wide with a sentence in it, and a
                phone's card has 160 to give. The sentence lives on the spinner line below. */}
            <Badge variant={settled ? "outline" : reading ? "secondary" : "success"} size="md">
              {t(`badge.${item.status}`)}
            </Badge>
            {item.suggestion && !settled ? (
              <Badge
                variant={
                  item.suggestion.confidence === "high"
                    ? "success"
                    : item.suggestion.confidence === "medium"
                      ? "warning"
                      : "danger"
                }
                size="md"
              >
                {t(`confidence.${item.suggestion.confidence}`)}
              </Badge>
            ) : null}
          </div>
        </div>
        {item.url ? (
          <Button asChild variant="ghost" size="sm" className="shrink-0">
            <a href={item.url} target="_blank" rel="noreferrer">
              <ExternalLinkIcon />
              <span className="sr-only sm:not-sr-only">{t("open")}</span>
            </a>
          </Button>
        ) : null}
      </div>

      {settled ? (
        <div className="flex flex-wrap items-center gap-3 text-body text-ink-2">
          {item.status === "validated" && item.suggestion ? (
            <span>{item.suggestion.title}</span>
          ) : null}
          {item.logId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={logPath(boatId, item.logId) as Route}>{t("went.log")}</Link>
            </Button>
          ) : null}
          {item.purchaseId ? (
            <Button asChild variant="outline" size="sm">
              <Link href={suppliesPath(boatId) as Route}>{t("went.purchase")}</Link>
            </Button>
          ) : null}
          {/* An ignored document is not the end of the road (D93): back up, or gone for good.
              A validated one keeps neither — its file is the attachment of the line it made. */}
          {item.status === "dismissed" && canWrite ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={reopen}
                disabled={pending}
                aria-busy={pending}
              >
                {pending ? <Spinner /> : <RotateCcwIcon />}
                {t("reopen")}
              </Button>
              <ConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                trigger={
                  <Button type="button" variant="ghost" size="sm" disabled={pending}>
                    <Trash2Icon />
                    {t("delete")}
                  </Button>
                }
                title={t("deleteConfirm.title")}
                description={t("deleteConfirm.description", { fileName: item.fileName })}
                confirmLabel={t("deleteConfirm.action")}
                pending={pending}
                onConfirm={remove}
              />
            </>
          ) : null}
        </div>
      ) : reading ? (
        <div className="flex items-center gap-3 text-body text-ink-2" aria-live="polite">
          <Spinner className="size-5" />
          <span>{t(`status.${item.status}`)}</span>
          {item.status === "received" && canWrite ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={reanalyse}
              disabled={pending}
            >
              <RefreshCwIcon />
              {t("reanalyse")}
            </Button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {item.error ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-tint p-3 text-caption text-warning-fg">
              <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{t(`errors.${item.error}`)}</span>
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <div className="rounded-lg border border-warning-border bg-warning-tint p-3">
              <p className="text-caption font-semibold text-warning-fg">{t("warnings")}</p>
              <ul className="mt-1 list-disc pl-5 text-caption text-warning-fg">
                {warnings.map((warning) => (
                  <li key={warning}>
                    {isInboxWarningCode(warning) ? t(`warningCodes.${warning}`) : warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {showSummary ? (
            <InboxItemSummary draft={draft} contacts={contacts} />
          ) : (
            <InboxItemForm
              boatId={boatId}
              itemId={item.id}
              draft={draft}
              onChange={patch}
              errors={errors}
              categories={categories}
              engines={engines}
              contacts={contacts}
              canWrite={canWrite}
            />
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="lg"
              onClick={validate}
              disabled={!canWrite || pending}
              aria-busy={pending}
            >
              {pending ? <Spinner /> : <CheckIcon />}
              {t("validate")}
            </Button>
            {showSummary ? (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setExpanded(true)}
                disabled={pending}
              >
                <PencilIcon />
                {t("summary.edit")}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={dismiss}
              disabled={!canWrite || pending}
            >
              <XIcon />
              {t("dismiss")}
            </Button>
            {canWrite && !showSummary ? (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={reanalyse}
                disabled={pending}
              >
                <RefreshCwIcon />
                {t("reanalyse")}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}
