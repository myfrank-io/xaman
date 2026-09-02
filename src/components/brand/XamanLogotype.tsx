import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * Mark + « XAMAN » in spaced geometric capitals: the builder's plate register
 * (art-direction §9). Used on the login, home and boat-picker screens.
 * Inherits `currentColor`.
 */
export function XamanLogotype({
  className,
  title,
  decorative = false,
}: {
  className?: string;
  title?: string;
  decorative?: boolean;
}) {
  const t = useTranslations("app");
  const label = title ?? t("name");

  return (
    <svg
      viewBox="0 0 699.01 160"
      className={cn("h-8 w-auto", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <g fill="currentColor" transform="translate(-22.53 -14.21) scale(0.352)">
        <path d="M104 104 L182 104 L408 396 L330 396 Z" />
        <path d="M330 104 L408 104 L182 396 L104 396 Z" />
        <path d="M64 372 L448 372 L448 404 L64 404 Z" />
      </g>
      <g fill="currentColor" transform="translate(177.41 32)">
        <path d="M0 0 L24 0 L106 120 L82 120 Z" transform="translate(0 0) scale(0.8)" />
        <path d="M82 0 L106 0 L24 120 L0 120 Z" transform="translate(0 0) scale(0.8)" />
        <path d="M43 0 L67 0 L24 120 L0 120 Z" transform="translate(102.4 0) scale(0.8)" />
        <path d="M43 0 L67 0 L110 120 L86 120 Z" transform="translate(102.4 0) scale(0.8)" />
        <path d="M20 78 L90 78 L90 100 L20 100 Z" transform="translate(102.4 0) scale(0.8)" />
        <path d="M0 0 L22 0 L22 120 L0 120 Z" transform="translate(208 0) scale(0.8)" />
        <path d="M110 0 L132 0 L132 120 L110 120 Z" transform="translate(208 0) scale(0.8)" />
        <path
          d="M0 0 L66 112 L132 0 L106 0 L66 67.88 L26 0 Z"
          transform="translate(208 0) scale(0.8)"
        />
        <path d="M43 0 L67 0 L24 120 L0 120 Z" transform="translate(331.2 0) scale(0.8)" />
        <path d="M43 0 L67 0 L110 120 L86 120 Z" transform="translate(331.2 0) scale(0.8)" />
        <path d="M20 78 L90 78 L90 100 L20 100 Z" transform="translate(331.2 0) scale(0.8)" />
        <path d="M0 0 L22 0 L22 120 L0 120 Z" transform="translate(436.8 0) scale(0.8)" />
        <path d="M84 0 L106 0 L106 120 L84 120 Z" transform="translate(436.8 0) scale(0.8)" />
        <path d="M0 0 L24 0 L106 120 L82 120 Z" transform="translate(436.8 0) scale(0.8)" />
      </g>
    </svg>
  );
}
