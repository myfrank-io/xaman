"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ChevronLeftIcon, CloudOffIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { useOnline } from "@/components/common/use-online";
import type { NavItem } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

/** Logical parent, not history: `/logs/[id]/edit` → `/logs/[id]` → `/logs`. */
function parentPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  // /boats/[boatId]/<section> is the shallowest addressable screen.
  if (segments.length <= 3) return null;
  return `/${segments.slice(0, -1).join("/")}`;
}

// iPhone / iPad portrait: compact top bar. Safe-area aware.
// The « ‹ Retour » button is mandatory as soon as we are not on a tab root: in
// standalone mode there is no URL bar and no reliable back gesture on iPad.
export function TopBar({
  boatName,
  boatSubtitle,
  nav,
  action,
  className,
}: {
  boatName: string;
  boatSubtitle?: string;
  nav?: NavItem[];
  action?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("app");
  const tc = useTranslations("common");
  const to = useTranslations("offline");
  const pathname = usePathname();
  const { online } = useOnline();

  const section = (nav ?? [])
    .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  const isRoot = !section || pathname === section.href;
  const back = isRoot ? null : parentPath(pathname);

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b border-navy-deep bg-header-gradient safe-pt-0 text-on-navy brass-rule",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 px-2">
        {back ? (
          <Link
            href={back as Route}
            className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg tap-feedback px-2 text-label font-medium text-on-navy focus-visible:ring-[3px] focus-visible:ring-on-navy/50 focus-visible:outline-none"
          >
            <ChevronLeftIcon className="size-5" aria-hidden />
            {tc("back")}
          </Link>
        ) : null}
        <div className="min-w-0 flex-1 px-2">
          {isRoot ? (
            <>
              <p className="text-overline text-on-navy-3 uppercase">{t("name")}</p>
              <p className="truncate text-body-lg font-semibold">{boatName}</p>
            </>
          ) : (
            <>
              <p className="truncate text-overline text-on-navy-3 uppercase">{boatName}</p>
              <p className="truncate text-body-lg font-semibold">{section?.label}</p>
            </>
          )}
          {isRoot && boatSubtitle ? <span className="sr-only">{boatSubtitle}</span> : null}
        </div>
        {!online ? (
          <span
            className="inline-flex size-11 shrink-0 items-center justify-center text-on-navy-2"
            title={to("banner")}
          >
            <CloudOffIcon className="size-5" aria-hidden />
            <span className="sr-only">{to("banner")}</span>
          </span>
        ) : null}
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
