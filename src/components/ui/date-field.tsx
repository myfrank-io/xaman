"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toDateString } from "@/lib/format";
import { cn } from "@/lib/utils";

function shiftDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

/**
 * Quick chips + native `<input type="date">`: on iPad the system wheel is
 * localised, timezone-safe and beats any custom picker with wet fingers
 * (ux-flows §4.3). No calendar dependency in V1.
 */
export function DateField({
  value,
  onValueChange,
  min,
  max,
  id,
  name,
  disabled,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  /** `yyyy-MM-dd`; `max` = today on past-only dates (completion, reading). */
  min?: string;
  max?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const today = toDateString(new Date());
  const yesterday = shiftDays(-1);
  const shortcut = value === today ? "today" : value === yesterday ? "yesterday" : "";

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <ToggleGroup
        type="single"
        value={shortcut}
        onValueChange={(next) => {
          if (next === "today") onValueChange(today);
          if (next === "yesterday") onValueChange(yesterday);
        }}
        disabled={disabled}
        aria-label={t("today")}
      >
        <ToggleGroupItem value="today">{t("today")}</ToggleGroupItem>
        <ToggleGroupItem value="yesterday">{t("yesterday")}</ToggleGroupItem>
      </ToggleGroup>
      <Input
        id={id}
        name={name}
        type="date"
        value={value}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
        className="w-auto min-w-40 grow num"
      />
    </div>
  );
}
