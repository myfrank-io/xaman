import * as React from "react";

import { cn } from "@/lib/utils";

// 44 px tall, 16 px text at every breakpoint (prevents the iOS auto-zoom on focus).
function Input({
  className,
  type,
  align,
  suffix,
  containerClassName,
  ...props
}: React.ComponentProps<"input"> & {
  /** Numbers read as columns: right-aligned and tabular (ux-flows §4.2). */
  align?: "left" | "right";
  /** Unit ornament rendered outside the value (` h`, ` €`), never inside it. */
  suffix?: React.ReactNode;
  containerClassName?: string;
}) {
  const shared =
    "h-11 w-full min-w-0 text-body transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-ink-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 data-[align=right]:text-right data-[align=right]:num";
  const box =
    "rounded-lg border border-input bg-surface shadow-xs disabled:bg-n-50 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-destructive/20";

  if (!suffix) {
    return (
      <input
        type={type}
        data-slot="input"
        data-align={align}
        className={cn(
          shared,
          box,
          "px-3 py-1 file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-label file:text-foreground",
          className,
        )}
        {...props}
      />
    );
  }

  /**
   * The unit is a box in the row, not an overlay on top of the value.
   *
   * It used to be absolutely positioned with a flat `pr-10` reserved for it — 40 px, enough
   * for « h » or « € » and nothing else. « h moteur » is 62 px, so the value was drawn over
   * its own unit: the checklist form read « h200teur » for two hundred engine hours. Laying
   * them side by side makes the reservation exact for any unit, in any language.
   */
  return (
    <div
      data-slot="input-wrapper"
      className={cn(
        "flex w-full items-center gap-2 pr-3 has-disabled:bg-n-50 has-disabled:opacity-50",
        box,
        "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 focus-visible:border-input focus-visible:ring-0",
        "has-[input[aria-invalid='true']]:border-destructive has-[input[aria-invalid='true']]:ring-destructive/20",
        containerClassName,
      )}
    >
      <input
        type={type}
        data-slot="input"
        data-align={align}
        className={cn(
          shared,
          "border-0 bg-transparent pl-3 shadow-none focus-visible:ring-0",
          className,
        )}
        {...props}
      />
      <span aria-hidden className="shrink-0 text-body whitespace-nowrap text-ink-3">
        {suffix}
      </span>
    </div>
  );
}

export { Input };
