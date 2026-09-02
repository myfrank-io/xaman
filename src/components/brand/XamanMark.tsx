import { useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

/**
 * « La Traverse » — the X drawn by two hulls, cut by the waterline.
 * Purely rectilinear, therefore crisp at 32 px, monochrome by construction
 * (art-direction §9, direction A). Inherits `currentColor`: never a fixed colour.
 */
export function XamanMark({
  className,
  title,
  decorative = false,
}: {
  className?: string;
  title?: string;
  /** true when a nearby text already names the brand. */
  decorative?: boolean;
}) {
  const t = useTranslations("app");
  const label = title ?? t("name");

  return (
    <svg
      viewBox="0 0 512 512"
      className={cn("size-8", className)}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      focusable="false"
    >
      <g fill="currentColor">
        <path d="M104 104 L182 104 L408 396 L330 396 Z" />
        <path d="M330 104 L408 104 L182 396 L104 396 Z" />
        <path d="M64 372 L448 372 L448 404 L64 404 Z" />
      </g>
    </svg>
  );
}
