import * as React from "react";

import { categoryIcon } from "@/components/common/category-icons";
import { cn } from "@/lib/utils";

// Category colours live in the database (boat_categories.color, hex) → inline styles.
// `cat-scope` derives the tint / border / on-dark variants with color-mix().
export function catStyle(color: string | null | undefined): React.CSSProperties {
  return { ["--cat" as string]: color || "var(--cat-fallback)" };
}

/**
 * Renders the lucide icon named by `boat_categories.icon`. Built with
 * createElement so the component identity stays the module-level one from
 * CATEGORY_ICONS instead of a locally created component.
 */
export function CategoryGlyph({
  icon,
  className,
  style,
}: {
  icon?: string | null;
  className?: string;
  style?: React.CSSProperties;
}) {
  return React.createElement(categoryIcon(icon), { className, style, "aria-hidden": true });
}

export function CategoryDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("inline-block size-2.5 shrink-0 rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

/** 32 px rounded square, tinted background, icon in the category colour. */
export function CategoryIcon({
  color,
  icon,
  className,
}: {
  color: string;
  icon?: string | null;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-md cat-scope",
        className,
      )}
      style={{ ...catStyle(color), backgroundColor: "var(--cat-tint)" }}
      aria-hidden
    >
      <CategoryGlyph icon={icon} className="size-5" style={{ color: "var(--cat)" }} />
    </span>
  );
}

/** 4 px vertical rule: the fastest marker when scanning a list vertically. */
export function CategoryBar({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("block w-1 shrink-0 self-stretch rounded-full", className)}
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

export function CategoryBadge({
  name,
  color,
  icon,
  withIcon = false,
  archived = false,
  size = "default",
  variant = "chip",
  className,
}: {
  name: string;
  color: string;
  /** lucide name from `boat_categories.icon` */
  icon?: string | null;
  withIcon?: boolean;
  archived?: boolean;
  size?: "sm" | "default";
  /** `inline` drops the tint and the border: for a metadata line inside a row. */
  variant?: "chip" | "inline";
  className?: string;
}) {
  const chip = variant === "chip";
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1.5 font-medium whitespace-nowrap text-foreground cat-scope",
        chip && "rounded-md border",
        size === "sm" ? "text-caption" : "text-label",
        chip && (size === "sm" ? "px-2 py-0.5" : "px-2.5 py-1"),
        !chip && "text-ink-2",
        archived && "opacity-60",
        className,
      )}
      style={{
        ...catStyle(color),
        ...(chip
          ? { backgroundColor: "var(--cat-tint)", borderColor: "var(--cat-border)" }
          : undefined),
      }}
    >
      {withIcon ? (
        <CategoryGlyph icon={icon} className="size-3.5 shrink-0" style={{ color: "var(--cat)" }} />
      ) : (
        <CategoryDot color={color} className="size-2.5" />
      )}
      <span className="truncate">{name}</span>
    </span>
  );
}
