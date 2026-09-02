import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

// Touch-first sizing: every size is at least 44 px tall (CLAUDE.md rule 1).
const buttonVariants = cva(
  "inline-flex shrink-0 pressable items-center justify-center gap-2 rounded-lg text-label font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-xs hover:bg-primary/90",
        destructive:
          "bg-destructive text-white shadow-xs hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40",
        outline:
          "border border-border-strong bg-surface shadow-xs hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        // On the navy header: a navy button on navy is invisible (art-direction §7.7).
        inverse: "bg-on-navy text-navy shadow-sm hover:bg-on-navy/90",
        // Offline: never `opacity-50`, which vanishes in full sun (ux-flows §5.4).
        // Pair it with aria-disabled (not disabled) so a tap can still explain why.
        offline: "border border-border-strong bg-n-100 text-ink-2 shadow-none",
      },
      size: {
        default: "h-11 px-4 py-2 has-[>svg]:px-3",
        sm: "h-11 gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-12 px-6 text-body has-[>svg]:px-4",
        /** 48 px — primary form action, wet fingers (ux-flows §6.4). */
        xl: "h-12 px-6 text-body font-semibold has-[>svg]:px-5",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  }) {
  const Comp = asChild ? Slot.Root : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
