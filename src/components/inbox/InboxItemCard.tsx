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
  PaperclipIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  Trash2Icon,
  TriangleAlertIcon,
  XIcon,
} from "lucide-react";

import { CategoryChips, type CategoryChoice } from "@/components/common/CategoryChips";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { ContactPicker } from "@/components/contacts/ContactPicker";
import type { ContactOption } from "@/components/contacts/specialties";
import { Field } from "@/components/forms/Field";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateField } from "@/components/ui/date-field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { NumericField } from "@/components/ui/numeric-field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  deleteInboxItem,
  dismissInboxItem,
  reanalyseInboxItem,
  reopenInboxItem,
  validateInboxItem,
} from "@/lib/actions/inbox";
import { formatBytes } from "@/lib/attachments/image";
import { formatCurrency, formatDate, todayString } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { parseDecimal } from "@/lib/numbers";
import { logPath, suppliesPath } from "@/lib/queries/boat-routes";
import type { InboxItem } from "@/lib/queries/inbox";
import { isPdf } from "@/lib/schemas/attachments";
import {
  validateInboxItemSchema,
  type InboxFiling,
  type InboxSuggestion,
  isInboxWarningCode,
} from "@/lib/schemas/inbox";
import { VISIBLE_PURCHASE_KINDS, type VisiblePurchaseKind } from "@/lib/schemas/purchases";
import { cn } from "@/lib/utils";

export type InboxEngine = { id: string; label: string };
/** An intervention the document can be hung on instead of becoming one (D95). */
export type InboxLogChoice = { id: string; title: string; performedAt: string };

type Draft = {
  kind: InboxFiling;
  title: string;
  date: string;
  categoryId: string;
  amount: string;
  contactId: string | null;
  supplierName: string;
  purchaseKind: VisiblePurchaseKind;
  notes: string;
  hours: Record<string, string>;
  /** The intervention picked for an `attach`; empty until then. */
  logId: string;
};

/** What the card opens on: the suggestion, or the document alone when there is none. */
function draftFrom(item: InboxItem, suggestion: InboxSuggestion | null): Draft {
  const hours: Record<string, string> = {};
  for (const row of suggestion?.engineHours ?? []) hours[row.engineId] = String(row.hours);
  const lines = (suggestion?.lineItems ?? [])
    .map((line) =>
      line.amount === null
        ? line.designation
        : `${line.designation} — ${formatCurrency(line.amount)}`,
    )
    .join("\n");
  return {
    kind: suggestion?.kind ?? "log",
    title: suggestion?.title ?? item.fileName.replace(/\.[a-z0-9]{1,8}$/i, ""),
    date: suggestion?.date ?? todayString(),
    categoryId: suggestion?.categoryId ?? "",
    amount:
      suggestion?.amount === null || suggestion?.amount === undefined
        ? ""
        : String(suggestion.amount),
    contactId: suggestion?.contactId ?? null,
    supplierName: suggestion?.supplierName ?? "",
    purchaseKind: suggestion?.purchaseKind ?? "service",
    notes: [suggestion?.notes, lines].filter(Boolean).join("\n\n"),
    hours,
    logId: "",
  };
}

/**
 * One document of the inbox (D91): the file on the left, what the reading proposes on the right,
 * every field editable, and two buttons. « Valider » is the tap that writes the carnet; nothing
 * is written before it, and the person sees exactly what will be.
 *
 * Three ways to file it (D95): an intervention, a purchase, or the attachments of an
 * intervention the carnet already has — the third shows only when there is one to pick.
 */
export function InboxItemCard({
  boatId,
  item,
  categories,
  engines,
  contacts,
  logs,
  canWrite,
}: {
  boatId: string;
  item: InboxItem;
  categories: CategoryChoice[];
  engines: InboxEngine[];
  contacts: ContactOption[];
  logs: InboxLogChoice[];
  canWrite: boolean;
}) {
  const t = useTranslations("inbox");
  const tk = useTranslations("purchaseKind");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(item, item.suggestion));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const patch = (changes: Partial<Draft>) => setDraft((current) => ({ ...current, ...changes }));
  const reading = item.status === "received" || item.status === "analysing";
  const settled = item.status === "validated" || item.status === "dismissed";

  function validate() {
    const input = {
      boatId,
      itemId: item.id,
      kind: draft.kind,
      title: draft.title,
      date: draft.date,
      categoryId: draft.categoryId,
      amount: draft.amount.trim() === "" ? null : parseDecimal(draft.amount),
      contactId: draft.contactId,
      supplierName: draft.supplierName,
      purchaseKind: draft.purchaseKind,
      notes: draft.notes,
      logId: draft.kind === "attach" ? draft.logId : null,
      engineHours: engines.map((engine) => ({
        engineId: engine.id,
        hours:
          (draft.hours[engine.id] ?? "").trim() === ""
            ? null
            : parseDecimal(draft.hours[engine.id] ?? ""),
      })),
    };
    const parsed = validateInboxItemSchema.safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues)
        next[issue.path.map(String).join(".")] = issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    startTransition(async () => {
      const result = await validateInboxItem(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(
        parsed.data.kind === "attach"
          ? t("attached", { title: result.data.title })
          : t("validated", { title: result.data.title }),
      );
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
          {/* The reading's caveats are about fields; an attach has none to check. */}
          {item.error && draft.kind !== "attach" ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-tint p-3 text-caption text-warning-fg">
              <TriangleAlertIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>{t(`errors.${item.error}`)}</span>
            </p>
          ) : null}
          {item.suggestion && item.suggestion.warnings.length > 0 && draft.kind !== "attach" ? (
            <div className="rounded-lg border border-warning-border bg-warning-tint p-3">
              <p className="text-caption font-semibold text-warning-fg">{t("warnings")}</p>
              <ul className="mt-1 list-disc pl-5 text-caption text-warning-fg">
                {item.suggestion.warnings.map((warning) => (
                  <li key={warning}>
                    {isInboxWarningCode(warning) ? t(`warningCodes.${warning}`) : warning}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2">
            <Label>{t("fields.kind")}</Label>
            <ToggleGroup
              type="single"
              value={draft.kind}
              aria-label={t("fields.kind")}
              onValueChange={(next) => next && patch({ kind: next as InboxFiling })}
            >
              <ToggleGroupItem value="log" className="min-h-11">
                {t("kind.log")}
              </ToggleGroupItem>
              <ToggleGroupItem value="purchase" className="min-h-11">
                {t("kind.purchase")}
              </ToggleGroupItem>
              {logs.length > 0 ? (
                <ToggleGroupItem value="attach" className="min-h-11">
                  {t("kind.attach")}
                </ToggleGroupItem>
              ) : null}
            </ToggleGroup>
          </div>

          {draft.kind === "attach" ? (
            <Field
              id={`inbox-log-${item.id}`}
              label={t("fields.existingLog")}
              required
              error={errors.logId}
              help={t("attachHelp")}
            >
              <NativeSelect
                id={`inbox-log-${item.id}`}
                value={draft.logId}
                aria-invalid={errors.logId ? true : undefined}
                onChange={(event) => patch({ logId: event.target.value })}
              >
                <option value="">{t("fields.existingLogPlaceholder")}</option>
                {logs.map((log) => (
                  <option key={log.id} value={log.id}>
                    {`${formatDate(log.performedAt)} — ${log.title}`}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id={`inbox-title-${item.id}`}
                  label={draft.kind === "log" ? t("fields.title") : t("fields.designation")}
                  required
                  error={errors.title}
                >
                  <Input
                    id={`inbox-title-${item.id}`}
                    value={draft.title}
                    autoComplete="off"
                    autoCapitalize="sentences"
                    aria-invalid={errors.title ? true : undefined}
                    onChange={(event) => patch({ title: event.target.value })}
                  />
                </Field>
                <Field
                  id={`inbox-date-${item.id}`}
                  label={t("fields.date")}
                  required
                  error={errors.date}
                >
                  <DateField
                    id={`inbox-date-${item.id}`}
                    value={draft.date}
                    onValueChange={(value) => patch({ date: value })}
                  />
                </Field>
              </div>

              <div className="grid gap-2">
                <Label>{t("fields.category")}</Label>
                <CategoryChips
                  categories={categories}
                  value={draft.categoryId}
                  onValueChange={(id) => patch({ categoryId: id })}
                  label={t("fields.category")}
                />
                {errors.categoryId ? (
                  <p role="alert" className="text-caption font-medium text-state-overdue-fg">
                    {t("categoryRequired")}
                  </p>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id={`inbox-amount-${item.id}`}
                  label={t("fields.amount")}
                  error={errors.amount}
                >
                  <NumericField
                    id={`inbox-amount-${item.id}`}
                    value={draft.amount}
                    suffix="€"
                    onValueChange={(raw) => patch({ amount: raw })}
                  />
                </Field>
                {draft.kind === "purchase" ? (
                  <div className="grid gap-2">
                    <Label>{t("fields.purchaseKind")}</Label>
                    <ToggleGroup
                      type="single"
                      value={draft.purchaseKind}
                      aria-label={t("fields.purchaseKind")}
                      onValueChange={(next) =>
                        next && patch({ purchaseKind: next as VisiblePurchaseKind })
                      }
                    >
                      {VISIBLE_PURCHASE_KINDS.map((kind) => (
                        <ToggleGroupItem key={kind} value={kind} className="min-h-11">
                          {tk(kind)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor={`inbox-contact-${item.id}`}>{t("fields.contact")}</Label>
                  <ContactPicker
                    id={`inbox-contact-${item.id}`}
                    boatId={boatId}
                    contacts={contacts}
                    value={draft.contactId}
                    onValueChange={(contactId) => patch({ contactId })}
                    canCreate={canWrite}
                    label={t("fields.contact")}
                    crewLabel={t("fields.noContact")}
                  />
                </div>
                {draft.kind === "purchase" ? (
                  <Field id={`inbox-supplier-${item.id}`} label={t("fields.supplier")}>
                    <Input
                      id={`inbox-supplier-${item.id}`}
                      value={draft.supplierName}
                      autoComplete="off"
                      placeholder={t("fields.supplierPlaceholder")}
                      onChange={(event) => patch({ supplierName: event.target.value })}
                    />
                  </Field>
                ) : null}
              </div>

              {draft.kind === "log" && engines.length > 0 ? (
                <div className="grid gap-2">
                  <Label>{t("fields.hours")}</Label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {engines.map((engine) => (
                      <Field
                        key={engine.id}
                        id={`inbox-hours-${item.id}-${engine.id}`}
                        label={engine.label}
                      >
                        <NumericField
                          id={`inbox-hours-${item.id}-${engine.id}`}
                          value={draft.hours[engine.id] ?? ""}
                          suffix="h"
                          onValueChange={(raw) =>
                            setDraft((current) => ({
                              ...current,
                              hours: { ...current.hours, [engine.id]: raw },
                            }))
                          }
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              ) : null}

              <Field id={`inbox-notes-${item.id}`} label={t("fields.notes")}>
                <Textarea
                  id={`inbox-notes-${item.id}`}
                  rows={3}
                  value={draft.notes}
                  onChange={(event) => patch({ notes: event.target.value })}
                />
              </Field>
            </>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="lg"
              onClick={validate}
              disabled={!canWrite || pending}
              aria-busy={pending}
            >
              {pending ? <Spinner /> : draft.kind === "attach" ? <PaperclipIcon /> : <CheckIcon />}
              {draft.kind === "attach" ? t("attach") : t("validate")}
            </Button>
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
            {canWrite ? (
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
