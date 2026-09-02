"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

const KEY = (itemId: string) => `xaman.steps.${itemId}`;

function load(itemId: string, size: number): boolean[] {
  try {
    const raw = sessionStorage.getItem(KEY(itemId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (Array.isArray(parsed)) return Array.from({ length: size }, (_, i) => parsed[i] === true);
  } catch {
    // storage unavailable: start unchecked
  }
  return Array.from({ length: size }, () => false);
}

export function clearSteps(itemId: string) {
  try {
    sessionStorage.removeItem(KEY(itemId));
  } catch {
    // ignore
  }
}

/**
 * Detailed steps, checkable while working (D22): local, per session, never sent to the
 * database. The component mounts when the row is expanded, so reading storage at mount is safe.
 */
export function StepsChecklist({ itemId, steps }: { itemId: string; steps: string[] }) {
  const t = useTranslations("checklist.item");
  const [checked, setChecked] = useState(() => load(itemId, steps.length));
  const done = checked.filter(Boolean).length;

  function update(next: boolean[]) {
    setChecked(next);
    try {
      sessionStorage.setItem(KEY(itemId), JSON.stringify(next));
    } catch {
      // ignore
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-overline text-ink-2 uppercase">{t("steps")}</h4>
        <span className="num text-caption text-ink-2">
          {t("stepsProgress", { done, total: steps.length })}
        </span>
      </div>
      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li key={index}>
            <label className="flex min-h-11 items-start gap-3 py-2 text-body">
              <Checkbox
                checked={checked[index] ?? false}
                onCheckedChange={(value) => {
                  const next = [...checked];
                  next[index] = value === true;
                  update(next);
                }}
                className="mt-0.5"
              />
              <span className={checked[index] ? "text-ink-3 line-through" : undefined}>
                <span className="num text-ink-3">{index + 1}. </span>
                {step}
              </span>
            </label>
          </li>
        ))}
      </ol>
      {done > 0 ? (
        <div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => update(steps.map(() => false))}
          >
            {t("uncheckAll")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
