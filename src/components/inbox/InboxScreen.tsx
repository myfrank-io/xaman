"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CopyIcon, InboxIcon, MailIcon } from "lucide-react";

import type { CategoryChoice } from "@/components/common/CategoryChips";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import type { ContactOption } from "@/components/contacts/specialties";
import { InboxDropzone } from "@/components/inbox/InboxDropzone";
import {
  confidentItems,
  type InboxEngine,
  type InboxLogChoice,
} from "@/components/inbox/inbox-draft";
import { InboxItemCard } from "@/components/inbox/InboxItemCard";
import { InboxValidateAll } from "@/components/inbox/InboxValidateAll";
import { Button } from "@/components/ui/button";
import type { InboxItem } from "@/lib/queries/inbox";

/** The fallback that stands in for Realtime while `inbox_items` is not published: see below. */
const POLL_FIRST_MS = 3_000;
const POLL_MAX_MS = 15_000;
const POLL_BUDGET_MS = 120_000;

/**
 * « À valider » (D91).
 *
 * Two ways in at the top — the camera or a pile of files, and the boat's own address — then, when several
 * documents were read without a single thing to flag, the one tap that files them all, and the
 * documents waiting for a decision, newest first, then the last ones filed. A document that
 * arrived by mail — or one of a pile dropped here (D109) — is read after the response; while it
 * is, the screen asks again on a budget, so the card fills itself in without anyone pulling to
 * refresh.
 */
export function InboxScreen({
  boatId,
  pending,
  done,
  categories,
  engines,
  contacts,
  logs,
  canContribute,
  canWrite,
  inboxAddress,
}: {
  boatId: string;
  pending: InboxItem[];
  done: InboxItem[];
  categories: CategoryChoice[];
  engines: InboxEngine[];
  contacts: ContactOption[];
  /** The interventions a document can join instead of becoming one (D109). */
  logs: InboxLogChoice[];
  canContribute: boolean;
  canWrite: boolean;
  /** Null when `INBOUND_EMAIL_DOMAIN` is not configured: the mail door is then simply absent. */
  inboxAddress: string | null;
}) {
  const t = useTranslations("inbox");
  const router = useRouter();

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

  async function copyAddress() {
    if (!inboxAddress) return;
    try {
      await navigator.clipboard.writeText(inboxAddress);
      toast.success(t("address.copied"));
    } catch {
      // No clipboard (an old WebView): the address is on screen, selectable.
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("subtitle")} />

      {!canWrite ? <p className="text-body text-ink-2">{t("readOnly")}</p> : null}

      {/* The two doors, side by side from `sm`: the camera or the pile, and the address. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <InboxDropzone boatId={boatId} canContribute={canContribute} />

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
                  logs={logs}
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
                  logs={logs}
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
