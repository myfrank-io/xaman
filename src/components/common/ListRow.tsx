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

const focusRing =
  "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:-outline-offset-2 focus-visible:outline-none";

/**
 * Normalised list row (ux-flows §2.4): 64 / 76 px, one badge on the left, the
 * title on one line, metadata below, one action on the right. Never a card per
 * row — 80 checklist points in separate cards become an unreadable accordion.
 * With both a link and an action, the link covers the text and the action sits
 * beside it: a button is never nested inside an anchor.
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
  const rule = categoryColor ? <CategoryBar color={categoryColor} className="my-2" /> : null;
  /**
   * Two lines on a phone, three columns from `sm`.
   *
   * First pass gave the phone three stacked blocks — title, metadata, then a line of its own
   * for the badge and the value. That fixed a title rendered zero pixels wide (the badge and
   * the value were both `shrink-0` and claimed 242 px of a 210 px row) but traded it for a
   * documented 64 px row rendering at 131 px, measured, and 165 px when the badge wrapped:
   * nine checklist rows filled 1 180 px, so two fit a screen. The row now folds the value onto
   * the title line and the badge onto the metadata line — 87 px measured, nothing removed. From
   * `sm` the three columns come back byte-identical.
   */
  const content = (
    <>
      {/* Fixed left column from `sm` so the titles line up down the list. */}
      {lead ? <div className="hidden shrink-0 items-center sm:flex sm:w-26">{lead}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Line one on a phone: the title, with the value beside it rather than under it. */}
        <div className="flex min-w-0 items-baseline gap-2 sm:block">
          <div className="line-clamp-1 min-w-0 flex-1 text-body font-medium break-words text-foreground sm:line-clamp-none sm:truncate">
            {title}
          </div>
          {trailing ? (
            <div className="shrink-0 text-right text-caption text-ink-2 sm:hidden">{trailing}</div>
          ) : null}
        </div>
        {/* Line two: the badge leads the metadata instead of costing a line of its own. */}
        {lead || meta ? (
          <div className="mt-0.5 flex min-w-0 items-center gap-x-1.5 overflow-hidden text-caption text-ink-2 sm:truncate">
            {lead ? <span className="shrink-0 sm:hidden">{lead}</span> : null}
            <span className="flex min-w-0 items-center gap-x-1.5 truncate">{meta}</span>
          </div>
        ) : null}
      </div>
      {trailing ? (
        <div className="hidden max-w-28 shrink-0 text-right sm:block">{trailing}</div>
      ) : null}
    </>
  );
  const chevron =
    href || onClick ? (
      <ChevronRightIcon className="size-5 shrink-0 text-n-400" aria-hidden />
    ) : null;

  const shell = cn(
    "flex w-full items-center gap-3 border-b border-border px-4 text-left last:border-b-0",
    size === "lg" ? "min-h-19 py-3" : "min-h-16 py-2",
    className,
  );

  if (action && (href || onClick)) {
    const target = cn(
      "-my-2 -ml-4 flex min-w-0 flex-1 items-center gap-3 self-stretch tap-feedback py-2 pl-4 text-left",
      focusRing,
    );
    return (
      <div className={shell}>
        {rule}
        {href ? (
          <Link href={href as Route} className={target}>
            {content}
          </Link>
        ) : (
          <button type="button" onClick={onClick} className={target}>
            {content}
          </button>
        )}
        <div className="shrink-0">{action}</div>
      </div>
    );
  }

  const body = (
    <>
      {rule}
      {content}
      {action ? <div className="shrink-0">{action}</div> : chevron}
    </>
  );
  const interactive = cn(shell, "tap-feedback", focusRing);

  if (href) {
    return (
      <Link href={href as Route} className={interactive}>
        {body}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={interactive}>
        {body}
      </button>
    );
  }
  return <div className={shell}>{body}</div>;
}
