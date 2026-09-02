"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { parseDecimal } from "@/lib/numbers";

export type NumericFieldProps = Omit<
  React.ComponentProps<"input">,
  "type" | "value" | "defaultValue"
> & {
  value?: string;
  defaultValue?: string;
  /** Raw text as typed, plus the normalised number (`,` → `.`, null when empty). */
  onValueChange?: (raw: string, value: number | null) => void;
  /** ` h`, ` €`, ` mois`… rendered outside the value. */
  suffix?: React.ReactNode;
  /** `decimal` for hours/amounts, `numeric` for integers. */
  mode?: "decimal" | "numeric";
};

/**
 * Never `type="number"`: on iOS it accepts `e`/`+`/`-`, refuses the French comma,
 * changes on scroll and shows arrows nobody can hit with a finger (ux-flows §4.2).
 */
export function NumericField({
  onValueChange,
  suffix,
  mode = "decimal",
  onChange,
  ...props
}: NumericFieldProps) {
  return (
    <Input
      type="text"
      inputMode={mode}
      autoComplete="off"
      pattern={mode === "decimal" ? "[0-9]*[.,]?[0-9]*" : "[0-9]*"}
      align="right"
      suffix={suffix}
      onChange={(event) => {
        onChange?.(event);
        onValueChange?.(event.target.value, parseDecimal(event.target.value) ?? null);
      }}
      {...props}
    />
  );
}
