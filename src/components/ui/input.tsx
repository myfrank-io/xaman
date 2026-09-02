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
  const field = (
    <input
      type={type}
      data-slot="input"
      data-align={align}
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-surface px-3 py-1 text-body shadow-xs transition-[color,box-shadow] outline-none selection:bg-primary selection:text-primary-foreground file:inline-flex file:h-9 file:border-0 file:bg-transparent file:text-label file:text-foreground placeholder:text-ink-3 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-n-50 disabled:opacity-50",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "data-[align=right]:text-right data-[align=right]:num",
        suffix && "pr-10",
        className,
      )}
      {...props}
    />
  );

  if (!suffix) return field;

  return (
    <div className={cn("relative w-full", containerClassName)} data-slot="input-wrapper">
      {field}
      <span
        aria-hidden
        className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-body text-ink-3"
      >
        {suffix}
      </span>
    </div>
  );
}

export { Input };
