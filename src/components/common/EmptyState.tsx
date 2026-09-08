import * as React from "react";

import { cn } from "@/lib/utils";

export type EmptyStateVariant = "initial" | "filtered" | "positive";

// Solid border, never dashed: a dotted line disappears in full sun (art-direction §7.14).
export function EmptyState({
  icon,
  title,
  titleAs: Title = "h2",
  description,
  children,
  action,
  secondaryAction,
  variant = "initial",
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /**
   * How deep the block sits. An empty state that stands for a whole screen is its `h2` and takes
   * the display voice at H1 size; one nested inside a section of the dashboard is an `h3` and
   * steps down to the sans at H2 — size follows the outline, as everywhere else (art-direction).
   */
  titleAs?: "h2" | "h3";
  description?: React.ReactNode;
  /**
   * What the block offers instead of merely stating the void: the model picker of « Choisir un
   * modèle », the numbered steps of a brand-new carnet. Sits between the description and the
   * actions, and is why those two screens no longer redraw this frame by hand.
   */
  children?: React.ReactNode;
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
      <Title className={Title === "h3" ? "text-h2" : "font-display text-h1"}>{title}</Title>
      {description ? <p className="mt-2 max-w-sm text-body text-ink-2">{description}</p> : null}
      {children}
      {action || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          {action}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  );
}
