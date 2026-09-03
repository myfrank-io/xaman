"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronRightIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { buildTrail } from "@/components/layout/breadcrumb-trail";

/**
 * Trail under the header (« Journal › Fiche › Modifier »), built from the URL so every screen
 * has one without a line of its own. It answers the question the left menu cannot: how do I
 * step back up this flow — the menu restarts it, the trail resumes it. It opens on the section
 * of the menu the screen belongs to, so a screen three levels deep still says which of the
 * four tabs it hangs from.
 */
export function Breadcrumb({ boatId }: { boatId: string }) {
  const pathname = usePathname();
  // The import screen names its list in `?entity=`, not in the path (see IMPORT_SECTIONS).
  const entity = useSearchParams().get("entity");
  const t = useTranslations("nav");
  const crumbs = buildTrail(pathname, boatId, entity);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label={t("crumbs.label")} className="min-w-0">
      {/* Wraps onto a second line rather than scrolling: a 390 px phone never overflows. */}
      <ol className="-my-2 flex min-w-0 flex-wrap items-center gap-x-1 text-caption text-ink-2">
        {crumbs.map((crumb, index) => (
          <li key={`${crumb.key}-${index}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? (
              <ChevronRightIcon className="size-3.5 shrink-0 text-ink-3" aria-hidden />
            ) : null}
            {crumb.href ? (
              // 44 px of vertical room: a trail nobody can tap is decoration (ux-flows §6.4).
              <Link
                href={crumb.href as Route}
                className="inline-flex min-h-11 min-w-0 items-center rounded-md tap-feedback px-1 hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <span className="truncate">{t(crumb.key)}</span>
              </Link>
            ) : (
              <span
                // Only the last crumb is the page: buildTrail leaves it, and it alone, unlinked.
                aria-current={index === crumbs.length - 1 ? "page" : undefined}
                className="inline-flex min-h-11 min-w-0 items-center px-1 font-medium text-foreground"
              >
                <span className="truncate">{t(crumb.key)}</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
