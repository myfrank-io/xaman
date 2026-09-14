"use client";

import * as React from "react";
import { CheckIcon } from "lucide-react";

import { catStyle, CategoryDot, CategoryGlyph } from "@/components/common/CategoryBadge";
import { cn } from "@/lib/utils";

export type CategoryChoice = {
  id: string;
  name: string;
  color: string;
  icon?: string | null;
  archived?: boolean;
};

/**
 * ≤ 12 categories → chips, never a select (ux-flows §4.4): one tap instead of
 * three, and the colour code is taught at the moment of choosing.
 * Selection carries THREE signals — fill, 2 px border, check mark — so it stays
 * readable in full sun and for a colour-blind user.
 */
export function CategoryChips({
  categories,
  value,
  onValueChange,
  label,
  name,
  disabled,
  className,
}: {
  categories: CategoryChoice[];
  value: string | null;
  onValueChange: (id: string) => void;
  label: string;
  name?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {categories.map((category) => (
        <CategoryChip
          key={category.id}
          category={category}
          role="radio"
          selected={category.id === value}
          disabled={disabled}
          name={name}
          onClick={() => onValueChange(category.id)}
        />
      ))}
    </div>
  );
}

/**
 * The same chips, several at a time (D118): « vidange + anode + gréement » is one visit of the
 * mechanic and one invoice, but three systems of the boat.
 *
 * Checkboxes rather than radios, so the assistive technology announces what the eye already
 * reads — a tap adds, a second tap removes — and the first one chosen stays first in the value,
 * because that is the one the row keeps in its own column.
 */
export function CategoryChipsMulti({
  categories,
  values,
  onValuesChange,
  label,
  max,
  disabled,
  className,
}: {
  categories: CategoryChoice[];
  values: string[];
  onValuesChange: (ids: string[]) => void;
  label: string;
  /** Beyond this, the chips that are not chosen stop responding rather than silently dropping. */
  max?: number;
  disabled?: boolean;
  className?: string;
}) {
  const full = max !== undefined && values.length >= max;
  return (
    <div role="group" aria-label={label} className={cn("flex flex-wrap gap-2", className)}>
      {categories.map((category) => {
        const selected = values.includes(category.id);
        return (
          <CategoryChip
            key={category.id}
            category={category}
            role="checkbox"
            selected={selected}
            disabled={disabled || (full && !selected)}
            onClick={() =>
              onValuesChange(
                selected
                  ? values.filter((id) => id !== category.id)
                  : // Appended, never inserted: the first chosen is the principal (D118).
                    [...values, category.id],
              )
            }
          />
        );
      })}
    </div>
  );
}

function CategoryChip({
  category,
  role,
  selected,
  disabled,
  name,
  onClick,
}: {
  category: CategoryChoice;
  role: "radio" | "checkbox";
  selected: boolean;
  disabled?: boolean;
  name?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      disabled={disabled}
      data-name={name}
      onClick={onClick}
      style={catStyle(category.color)}
      className={cn(
        // border-2 in both states: a width change would shift the row by 2 px.
        "inline-flex min-h-11 min-w-22 pressable items-center gap-2 rounded-full border-2 px-4 text-[15px] cat-scope focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50",
        selected
          ? "border-[var(--cat)] bg-[var(--cat-tint)] font-semibold text-foreground"
          : "border-border-strong bg-surface font-medium text-foreground",
        category.archived && "line-through opacity-60",
      )}
      {...(selected ? { "data-selected": true } : {})}
    >
      {selected ? (
        <span
          className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: "var(--cat)" }}
          aria-hidden
        >
          <CheckIcon className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <CategoryDot color={category.color} />
      )}
      <CategoryGlyph
        icon={category.icon}
        className="size-4 shrink-0"
        style={{ color: "var(--cat)" }}
      />
      <span className="truncate">{category.name}</span>
    </button>
  );
}
