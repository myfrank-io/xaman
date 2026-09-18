"use client";

import * as React from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The button that copies a line of text, and *shows* that it did (D146).
 *
 * The clipboard is silent: a tap that copied and a tap that did nothing look the same. The
 * toasts already say the sentence, but a toast appears at the edge of a 1024 px screen, far
 * from the finger — so the answer also happens under the finger, where the question was
 * asked. The copier swaps for a check for a second and a half, the button takes the green
 * tint of what went through, and a ring leaves it once. Then everything comes back, because
 * a check that stays becomes a state, and the button has none.
 *
 * The animation lives in `globals.css` (`copy-swap`, `copy-halo`), keyed off `data-copied`,
 * so `prefers-reduced-motion` neutralises it in one place.
 */

/** How long the check stays. Long enough to be seen, short enough not to be a state. */
const COPIED_MS = 1500;

/** The button trims its padding when it directly contains an icon (`has-[>svg]`); ours are in
 *  a span, so the trim is restored by hand — a copy button is not wider than any other. */
const ICON_PADDING = {
  default: "px-3",
  sm: "px-2.5",
  lg: "px-4",
  xl: "px-5",
  icon: "",
} as const;

type CopyButtonProps = Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> & {
  /** The text handed to the clipboard. */
  value: string;
  /** What the button says. On an icon-only button it becomes the `aria-label`. */
  label: string;
  /** Icon alone, no text — the button then takes the `icon` size by default. */
  iconOnly?: boolean;
  /** The copy went through: say it in words (a toast), the button says it in colour. */
  onCopied?: () => void;
  /** No clipboard at all (an old WebView), or the browser refused. */
  onCopyFailed?: () => void;
};

export function CopyButton({
  value,
  label,
  iconOnly = false,
  onCopied,
  onCopyFailed,
  className,
  variant = "outline",
  size,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // A dialog that closes on the copy (the invitation) unmounts us mid-flight.
  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      onCopyFailed?.();
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
    onCopied?.();
  }

  const resolvedSize = size ?? (iconOnly ? "icon" : "default");

  return (
    <Button
      type="button"
      variant={variant}
      size={resolvedSize}
      // `undefined` and not `false`: `data-copied="false"` would still match `[data-copied]`.
      data-copied={copied || undefined}
      aria-label={iconOnly ? label : undefined}
      onClick={() => void copy()}
      className={cn(
        "relative",
        ICON_PADDING[resolvedSize],
        // The tint of what went through. `hover:` repeated, otherwise the outline variant
        // takes its grey back under a mouse while the check is still on screen.
        copied &&
          "border-success-border bg-success-tint text-success-fg hover:bg-success-tint hover:text-success-fg",
        className,
      )}
      {...props}
    >
      <span aria-hidden className="copy-halo" />
      <span className="copy-swap size-5">
        <CopyIcon data-copy-idle aria-hidden />
        <CheckIcon data-copy-check aria-hidden />
      </span>
      {iconOnly ? null : label}
    </Button>
  );
}
