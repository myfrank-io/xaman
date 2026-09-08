"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCheckIcon } from "lucide-react";

import { draftFrom, toValidateInput, type InboxEngine } from "@/components/inbox/inbox-draft";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { validateInboxItem } from "@/lib/actions/inbox";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import type { InboxItem } from "@/lib/queries/inbox";
import { validateInboxItemSchema } from "@/lib/schemas/inbox";

/**
 * « Tout valider » — the tap that files every document the reading had nothing to flag.
 *
 * No bulk endpoint: the documents go through the same Server Action, one after the other, so each
 * one obeys the rules a single tap obeys — RLS, the shared zod schema, and the idempotent id
 * drawn from the document itself. One document refused therefore leaves the others filed, and
 * nothing has to be rolled back: tapping again re-files only what is still waiting, and a
 * document filed twice is the same line written twice, never two.
 *
 * Shown only above two or more such documents: below that, the card's own « Valider » is the tap.
 */
export function InboxValidateAll({
  boatId,
  items,
  engines,
}: {
  boatId: string;
  items: InboxItem[];
  engines: InboxEngine[];
}) {
  const t = useTranslations("inbox");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ filed: number; refused: number; failed: string[] } | null>(
    null,
  );
  const running = useRef(false);

  async function validateAll() {
    if (running.current) return;
    running.current = true;
    const targets = [...items];
    const engineIds = engines.map((engine) => engine.id);
    setResult(null);
    setProgress({ done: 0, total: targets.length });

    let filed = 0;
    const failed: string[] = [];
    let firstError: string | null = null;

    for (const [index, item] of targets.entries()) {
      const parsed = validateInboxItemSchema.safeParse(
        toValidateInput(draftFrom(item, item.suggestion), {
          boatId,
          itemId: item.id,
          engineIds,
        }),
      );
      if (!parsed.success) {
        failed.push(item.fileName);
      } else {
        const outcome = await validateInboxItem(parsed.data);
        if (outcome.ok) {
          filed += 1;
        } else {
          failed.push(item.fileName);
          firstError ??= outcome.error;
        }
      }
      setProgress({ done: index + 1, total: targets.length });
    }

    running.current = false;
    setProgress(null);
    setResult({ filed, refused: failed.length, failed });
    if (failed.length > 0 && firstError) toast.error(errorMessage(firstError));
    else if (failed.length === 0) toast.success(t("validateAll.done", { count: filed }));
    router.refresh();
  }

  const busy = progress !== null;
  // The control appears above two or more such documents — and stays, on its own, long enough to
  // say what became of them: a run that files four out of five leaves one card behind, which is
  // one too few to keep the button, and the count of what went in would go with it.
  const offered = items.length > 1 || busy;
  if (!offered && result === null) return null;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface-2 p-4">
      {offered ? (
        <>
          <p className="text-body text-ink-2">{t("validateAll.help", { count: items.length })}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              onClick={() => void validateAll()}
              disabled={busy}
              aria-busy={busy}
            >
              {busy ? <Spinner /> : <CheckCheckIcon />}
              {t("validateAll.action")}
            </Button>
            {progress ? (
              <span className="num text-body text-ink-2">
                {t("validateAll.progress", { done: progress.done, total: progress.total })}
              </span>
            ) : null}
          </div>
          {progress ? (
            <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
          ) : null}
        </>
      ) : null}
      {result ? (
        <div aria-live="polite" className="flex flex-col gap-1">
          <p className="text-body font-medium text-foreground">
            {t("validateAll.result", { filed: result.filed, refused: result.refused })}
          </p>
          {result.failed.length > 0 ? (
            <p className="text-caption text-ink-2">
              {t("validateAll.failed", { files: result.failed.join(", ") })}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
