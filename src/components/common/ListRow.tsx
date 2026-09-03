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
   * Mobile-first: the title owns the row, and the badge and the trailing value drop underneath
   * it on a phone rather than competing with it.
   *
   * Measured at 360 px before this: the badge (96 px) and the trailing value (106 px) were both
   * `shrink-0`, so with the gaps they claimed 242 px of a 210 px row and the title — the only
   * part that says what the line IS — was rendered **zero pixels wide**. Three columns do not
   * fit on a phone; from `sm` they do, and the original layout comes back.
   */
  const content = (
    <>
      {/* Fixed left column from `sm` so the titles line up down the list. */}
      {lead ? <div className="hidden shrink-0 items-center sm:flex sm:w-26">{lead}</div> : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="line-clamp-2 text-body font-medium break-words text-foreground sm:truncate">
          {title}
        </div>
        {meta ? (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-caption text-ink-2 sm:flex-nowrap sm:truncate">
            {meta}
          </div>
        ) : null}
        {lead || trailing ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:hidden">
            {lead}
            {trailing}
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
