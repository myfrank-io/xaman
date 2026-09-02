import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Dashboard block: section title, optional « voir tout » link, content, and a
 * local error slot — a dashboard missing one block is still useful
 * (ux-flows §2.7).
 */
export function SectionCard({
  title,
  action,
  actionHref,
  actionLabel,
  footer,
  children,
  bare = false,
  className,
}: {
  title: React.ReactNode;
  action?: React.ReactNode;
  actionHref?: string;
  actionLabel?: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** true = no card frame around the content (a bordered list draws its own). */
  bare?: boolean;
  className?: string;
}) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-overline text-ink-2 uppercase">{title}</h2>
        {action ??
          (actionHref && actionLabel ? (
            <Link
              href={actionHref as Route}
              className="inline-flex min-h-11 items-center gap-1 rounded-lg tap-feedback px-2 text-label font-medium text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {actionLabel}
              <ChevronRightIcon className="size-4" aria-hidden />
            </Link>
          ) : null)}
      </div>
      <div
        className={cn(
          bare ? "" : "overflow-hidden rounded-xl border border-border bg-surface shadow-sm",
        )}
      >
        {children}
      </div>
      {footer ? <div className="text-caption text-ink-3">{footer}</div> : null}
    </section>
  );
}
