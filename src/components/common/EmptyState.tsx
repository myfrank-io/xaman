import * as React from "react";

import { cn } from "@/lib/utils";

export type EmptyStateVariant = "initial" | "filtered" | "positive";

// Solid border, never dashed: a dotted line disappears in full sun (art-direction §7.14).
export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "initial",
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  /** initial = never filled · filtered = no result · positive = nothing to do, and that is good */
  variant?: EmptyStateVariant;
  className?: string;
}) {
  return (
    <div
      data-variant={variant}
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-border bg-surface-2 px-6 py-10 text-center",
        variant === "positive" && "border-state-ok-border bg-state-ok-tint",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "mb-4 flex size-14 items-center justify-center rounded-full border border-border bg-surface [&_svg]:size-7",
            variant === "positive" ? "text-state-ok-fg" : "text-n-400",
          )}
        >
          {icon}
        </div>
      ) : null}
      <h2 className="font-display text-h1">{title}</h2>
      {description ? <p className="mt-2 max-w-sm text-body text-ink-2">{description}</p> : null}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
