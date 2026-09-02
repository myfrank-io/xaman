"use client";

import * as React from "react";
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";

import { cn } from "@/lib/utils";

// Segmented control: « Nous-mêmes / Un prestataire », date shortcuts, filters.
// 44 px tall, the selected item is marked by fill AND weight (never colour alone).
function ToggleGroup({
  className,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn(
        "inline-flex w-fit max-w-full items-stretch gap-1 rounded-lg border border-border-strong bg-surface-2 p-1",
        className,
      )}
      {...props}
    />
  );
}

function ToggleGroupItem({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex min-h-9 min-w-20 flex-1 items-center justify-center gap-2 rounded-md tap-feedback px-3 text-label whitespace-nowrap text-ink-2 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-surface data-[state=on]:font-semibold data-[state=on]:text-foreground data-[state=on]:shadow-sm [&_svg]:size-4 [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  );
}

export { ToggleGroup, ToggleGroupItem };
