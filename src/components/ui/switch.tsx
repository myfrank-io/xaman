"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // 44 px tap target (rule 1) around a 48 × 28 track drawn by ::before
        "peer relative inline-flex h-11 w-14 shrink-0 items-center rounded-full outline-none before:absolute before:inset-x-1 before:top-1/2 before:h-7 before:-translate-y-1/2 before:rounded-full before:border before:border-transparent before:shadow-xs before:transition-colors before:content-[''] focus-visible:before:border-ring focus-visible:before:ring-[3px] focus-visible:before:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:before:bg-primary data-[state=unchecked]:before:bg-input dark:data-[state=unchecked]:before:bg-input/80",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none relative z-10 block size-6 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-[26px] data-[state=unchecked]:translate-x-1.5 dark:data-[state=checked]:bg-primary-foreground dark:data-[state=unchecked]:bg-foreground",
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
