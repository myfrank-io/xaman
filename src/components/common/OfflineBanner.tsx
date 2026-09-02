"use client";

import * as React from "react";
import { CloudOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useOnline } from "@/components/common/use-online";
import { cn } from "@/lib/utils";

/**
 * Full-width strip under the header, never dismissible: it disappears when the
 * network comes back (art-direction §7.13). Not a toast — the state lasts.
 */
export function OfflineBanner({
  lastSyncAt,
  className,
}: {
  /** Timestamp of the cached data, shown so nobody trusts a stale screen. */
  lastSyncAt?: Date | string | null;
  className?: string;
}) {
  const t = useTranslations("offline");
  const { online } = useOnline();
  if (online) return null;

  const date = lastSyncAt ? new Date(lastSyncAt) : null;
  const stamp =
    date && !Number.isNaN(date.getTime())
      ? t("lastSync", {
          date: new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date),
          time: new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
            date,
          ),
        })
      : null;

  return (
    <div
      role="status"
      className={cn(
        "flex min-h-10 items-center gap-2 border-b border-warning-border bg-warning-tint px-4 py-2 text-caption text-foreground",
        className,
      )}
    >
      <CloudOffIcon className="size-4 shrink-0 text-warning-fg" aria-hidden />
      <span className="font-medium">{t("banner")}</span>
      {stamp ? <span className="truncate num text-ink-2">{stamp}</span> : null}
    </div>
  );
}
