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
  InboxItemCard,
  type InboxEngine,
  type InboxLogChoice,
} from "@/components/inbox/InboxItemCard";
import { Button } from "@/components/ui/button";
import type { InboxItem } from "@/lib/queries/inbox";

/**
 * « À valider » (D91, D95).
 *
 * Two ways in at the top — the camera or a pile of files, and the boat's own address to copy —
 * then the documents waiting for a decision, newest first, then the last ones filed. A document
 * that arrived by mail, or in a pile, is read after the response; while one is, the screen asks
 * again every few seconds, so the card fills itself in without anyone pulling to refresh.
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
  /** The interventions a document can be hung on instead of becoming one (D95). */
  logs: InboxLogChoice[];
  canContribute: boolean;
  canWrite: boolean;
  /** Null when `INBOUND_EMAIL_DOMAIN` is not configured: the mail door is then simply absent. */
  inboxAddress: string | null;
}) {
  const t = useTranslations("inbox");
  const router = useRouter();

  // A document read after the response — mailed in, or one of a pile — is still being read:
  // ask again until every card is ready.
  const reading = pending.some((item) => item.status !== "ready");
  useEffect(() => {
    if (!reading) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [reading, router]);

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
