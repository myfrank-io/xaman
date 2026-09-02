import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon } from "lucide-react";

import { CategoryBar } from "@/components/common/CategoryBadge";
import { cn } from "@/lib/utils";

type ListRowProps = {
  /** Left column: state / status badge, ≈ 100 px on a wide screen. */
  lead?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  /** Right column before the action: due label, amount, date. */
  trailing?: React.ReactNode;
  /** Action button ([ Fait ]) — replaces the chevron. */
  action?: React.ReactNode;
  /** 4 px category rule on the left edge. */
  categoryColor?: string;
  href?: string;
  onClick?: () => void;
  /** 64 px (one line) or 76 px (two lines, portrait). */
  size?: "md" | "lg";
  className?: string;
};

/**
 * Normalised list row (ux-flows §2.4): 64 / 76 px, one badge on the left, the
 * title on one line, metadata below, one action on the right. Never a card per
 * row — 80 checklist points in separate cards become an unreadable accordion.
 */
export function ListRow({
  lead,
  title,
  meta,
  trailing,
  action,
  categoryColor,
  href,
  onClick,
  size = "md",
  className,
}: ListRowProps) {
  const body = (
    <>
      {categoryColor ? <CategoryBar color={categoryColor} className="my-2" /> : null}
      {/* Fixed left column from `sm` so the titles line up down the list. */}
      {lead ? <div className="flex shrink-0 items-center sm:w-26">{lead}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-body font-medium text-foreground sm:truncate">
          {title}
        </div>
        {meta ? (
          <div className="mt-0.5 flex items-center gap-1.5 truncate text-caption text-ink-2">
            {meta}
          </div>
        ) : null}
      </div>
      {trailing ? <div className="max-w-28 shrink-0 text-right">{trailing}</div> : null}
      {action ? (
        <div className="shrink-0">{action}</div>
      ) : href || onClick ? (
        <ChevronRightIcon className="size-5 shrink-0 text-n-400" aria-hidden />
      ) : null}
    </>
  );

  const shell = cn(
    "flex w-full items-center gap-3 border-b border-border px-4 text-left last:border-b-0",
    size === "lg" ? "min-h-19 py-3" : "min-h-16 py-2",
    (href || onClick) &&
      "tap-feedback focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:-outline-offset-2 focus-visible:outline-none",
    className,
  );

  if (href) {
    return (
      <Link href={href as Route} className={shell}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}
