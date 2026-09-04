"use client";

import { useTranslations } from "next-intl";

import type { Suggestion } from "@/lib/boat-models";

/**
 * The suggestions under « Constructeur » and « Modèle » (D65, D66).
 *
 * Never a `<datalist>`: Safari iOS renders it partially and it cannot be styled — the same
 * reason the title suggestions of the intervention form are hand-built (D26). Chips rather than
 * rows because these are two or three words, not a title with a category and an engine.
 *
 * They are suggestions, not a list to choose from: the field stays free text, and this only
 * spares the typing for the models the catalogue knows. The `hint` is what tells two identically
 * named models apart while the builder box is still empty.
 */
export function SuggestionChips({
  options,
  label,
  onPick,
}: {
  options: Suggestion[];
  label: string;
  onPick: (option: Suggestion) => void;
}) {
  const t = useTranslations("boats.new");

  if (options.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-caption text-ink-3">{t("suggestionsLabel")}</span>
      <ul aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              // The finger reaches the chip before the blur fires: keep the pick.
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(option)}
              className="flex min-h-11 items-center gap-1.5 rounded-full border border-border-strong tap-feedback bg-surface px-3 text-label text-ink-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {option.label}
              {option.hint ? <span className="text-caption text-ink-3">{option.hint}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
