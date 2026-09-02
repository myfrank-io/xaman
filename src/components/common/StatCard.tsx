import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ChevronRightIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type StatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: "default" | "warning" | "danger" | "success";
  /** `dark` for the gradient dashboard header */
  variant?: "light" | "dark";
  /** Makes the whole tile a link (R3: every displayed value is actionable). */
  href?: string;
  onClick?: () => void;
  className?: string;
};

const toneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  warning: "text-state-soon-fg",
  danger: "text-state-overdue-fg",
  success: "text-state-ok-fg",
};

const darkToneClasses: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "",
  warning: "text-state-soon-on-dark",
  danger: "text-state-overdue-on-dark",
  success: "text-state-ok-on-dark",
};

// Dark variant is an opaque tile (`--on-navy-surface`), never `bg-white/10 backdrop-blur`:
// a translucent tile's contrast depends on the gradient pixel behind it (art-direction §7.6).
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
  variant = "light",
  href,
  onClick,
  className,
}: StatCardProps) {
  const dark = variant === "dark";
  const interactive = Boolean(href || onClick);

  const content = (
    <>
      <div
        className={cn(
          "flex items-center gap-2",
          // Dark = the deck display: 11 px spaced capitals over a huge figure.
          dark ? "text-overline text-on-navy-3 uppercase" : "text-label text-ink-2",
        )}
      >
        {icon ? <span className="[&_svg]:size-4">{icon}</span> : null}
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-1 num text-num-lg leading-tight font-semibold",
          dark ? darkToneClasses[tone] : toneClasses[tone],
        )}
      >
        {value}
      </div>
      {hint ? (
        <div
          className={cn(
            "mt-1 flex items-start gap-1 text-caption",
            dark ? "text-on-navy-3" : "text-ink-3",
          )}
        >
          <span className="line-clamp-2 min-w-0">{hint}</span>
          {interactive ? <ChevronRightIcon className="mt-0.5 size-4 shrink-0" aria-hidden /> : null}
        </div>
      ) : interactive ? (
        <ChevronRightIcon
          className={cn("mt-1 size-4", dark ? "text-on-navy-3" : "text-n-400")}
          aria-hidden
        />
      ) : null}
    </>
  );

  const shell = cn(
    "flex w-full flex-col justify-between rounded-xl border p-3.5 text-left",
    dark
      ? "min-h-26 border-on-navy-border bg-on-navy-surface text-on-navy"
      : "min-h-26 border-border bg-surface text-card-foreground shadow-sm",
    interactive &&
      "pressable focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
    className,
  );

  if (href) {
    return (
      <Link href={href as Route} className={shell}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={shell}>
        {content}
      </button>
    );
  }
  return <div className={shell}>{content}</div>;
}
