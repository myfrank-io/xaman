"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CloudUploadIcon, Trash2Icon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ListRow } from "@/components/common/ListRow";
import { useOnline } from "@/components/common/use-online";
import { useOutbox } from "@/components/offline/use-outbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDate } from "@/lib/format";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { OUTBOX_LIMIT } from "@/lib/outbox";

/**
 * Entries waiting on the device (E9-1b, D25). Shown on the dashboard only when the queue is
 * not empty, above everything else: what is on the iPad and not on the server is the one
 * thing the crew must see. Nothing leaves without the tap on « Tout renvoyer » — no
 * background sync, so a wrong line can still be dropped.
 */
export function OutboxCard({ boatId }: { boatId: string }) {
  const t = useTranslations("offline.outbox");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const { entries, discard, resendAll, sending } = useOutbox(boatId);
  const { online } = useOnline();
  const [pending, startTransition] = useTransition();

  if (entries.length === 0) return null;

  function send() {
    startTransition(async () => {
      const { sent, failed } = await resendAll();
      if (sent > 0) {
        toast.success(t("sent", { count: sent }));
        router.refresh();
      }
      if (failed > 0) toast.error(t("failed", { count: failed }));
    });
  }

  const busy = pending || sending;
  return (
    <section
      className="flex flex-col gap-3 rounded-xl border border-warning-border bg-warning-tint p-4 sm:p-5"
      aria-labelledby="outbox-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 id="outbox-title" className="text-h2">
            {t("title", { count: entries.length })}
          </h2>
          <p className="mt-1 text-caption text-ink-2">
            {entries.length >= OUTBOX_LIMIT ? t("full", { limit: OUTBOX_LIMIT }) : t("help")}
          </p>
        </div>
        <Button type="button" onClick={send} disabled={busy || !online} aria-busy={busy}>
          {busy ? <Spinner className="size-4" /> : <CloudUploadIcon />}
          {online ? t("send") : t("waiting")}
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-surface">
        {entries.map((entry) => (
          <ListRow
            key={entry.id}
            lead={
              <span className="w-20 shrink-0 num text-caption text-ink-2">
                {formatDate(entry.queuedAt)}
              </span>
            }
            title={entry.label}
            meta={
              <>
                <span className="shrink-0">{t(`kinds.${entry.kind}`)}</span>
                {entry.error ? (
                  <>
                    <span aria-hidden>·</span>
                    <Badge
                      size="sm"
                      variant="outline"
                      className="shrink-0 border-state-overdue-border bg-state-overdue-tint text-state-overdue-fg"
                    >
                      {errorMessage(entry.error)}
                    </Badge>
                  </>
                ) : null}
              </>
            }
            action={
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label={t("discard", { label: entry.label })}
                disabled={busy}
                onClick={() => {
                  discard(entry.id);
                  toast.success(t("discarded"));
                }}
              >
                <Trash2Icon />
              </Button>
            }
          />
        ))}
      </div>
    </section>
  );
}
