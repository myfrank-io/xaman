"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";

import { Field } from "@/components/forms/Field";
import type { LogFormEngine } from "@/components/logs/log-form-values";
import { Button } from "@/components/ui/button";
import { NumericField } from "@/components/ui/numeric-field";
import { formatDayMonth, formatHours } from "@/lib/format";
import { parseDecimal } from "@/lib/numbers";

/**
 * Engine hours of an intervention (ux-flows §3a, [ÉCART]): the fields are EMPTY, never
 * pre-filled — pre-filling 1 234 h while the counter reads 1 256 writes a false reading dated
 * today and falsifies every hour deadline. Instead: the last reading as help text and a
 * « = reprendre » chip for the case where the engine has not run.
 * A field left empty writes no reading at all.
 */
export function EngineHoursSection({
  engines,
  values,
  onValueChange,
  focusEngineId,
}: {
  engines: LogFormEngine[];
  /** Raw text per engine, in the same order as `engines`. */
  values: string[];
  onValueChange: (index: number, raw: string) => void;
  /** Engine whose field must take the focus (a suggestion carrying an engine was picked). */
  focusEngineId?: string | null;
}) {
  const t = useTranslations("logs.form");
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!focusEngineId) return;
    const index = engines.findIndex((engine) => engine.id === focusEngineId);
    if (index >= 0) inputs.current[index]?.focus();
  }, [focusEngineId, engines]);

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-2 p-4">
      <p className="text-label font-semibold text-ink-2">{t("hours")}</p>
      {engines.map((engine, index) => {
        const raw = values[index] ?? "";
        const typed = parseDecimal(raw);
        const below =
          typeof typed === "number" && engine.lastHours !== null && typed < engine.lastHours;
        return (
          <Field
            key={engine.id}
            id={`log-hours-${engine.id}`}
            label={engine.label}
            help={
              engine.lastHours !== null && engine.lastDate
                ? t("hoursHelp", {
                    hours: formatHours(engine.lastHours),
                    date: formatDayMonth(engine.lastDate),
                  })
                : t("hoursNone")
            }
            warning={below ? t("hoursBelow", { hours: formatHours(engine.lastHours) }) : undefined}
          >
            <div className="flex items-center gap-2">
              <NumericField
                id={`log-hours-${engine.id}`}
                ref={(node) => {
                  inputs.current[index] = node;
                }}
                value={raw}
                onValueChange={(next) => onValueChange(index, next)}
                suffix="h"
                enterKeyHint="next"
                containerClassName="flex-1"
              />
              {engine.lastHours !== null ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onValueChange(index, String(engine.lastHours).replace(".", ","))}
                >
                  {t("takeLast")}
                </Button>
              ) : null}
            </div>
          </Field>
        );
      })}
    </div>
  );
}
