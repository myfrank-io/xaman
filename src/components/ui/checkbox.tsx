"use client";

import * as React from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { CheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // 44 px tap target (rule 1) around a 24 px box drawn by ::before
        "peer relative inline-flex size-11 shrink-0 items-center justify-center rounded-lg outline-none before:absolute before:inset-2.5 before:rounded-[6px] before:border before:border-input before:bg-surface before:shadow-xs before:transition-colors before:content-[''] focus-visible:before:border-ring focus-visible:before:ring-[3px] focus-visible:before:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:before:border-destructive data-[state=checked]:before:border-primary data-[state=checked]:before:bg-primary",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="relative z-10 flex items-center justify-center text-primary-foreground"
      >
        <CheckIcon className="size-4" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

export { Checkbox };
