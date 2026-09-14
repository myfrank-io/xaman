import Link from "next/link";
import type { Route } from "next";
import { SearchIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { XamanMark } from "@/components/brand/XamanMark";
import { AttentionDot } from "@/components/common/AttentionDot";
import { NavLink } from "@/components/layout/NavLink";
import {
  NAV_ICONS,
  navGroup,
  PRIMARY_NAV_KEYS,
  SECONDARY_NAV_KEYS,
  type NavItem,
} from "@/components/layout/nav";
import { cn } from "@/lib/utils";

function NavRow({ item }: { item: NavItem }) {
  const Icon = NAV_ICONS[item.key];
  return (
    <li>
      <NavLink
        href={item.href}
        className="relative flex min-h-11 items-center gap-3 rounded-lg tap-feedback px-3 text-label font-medium text-ink-2"
        // Active: fill + 3 px left rule + weight 600. Never colour alone.
        activeClassName="bg-sidebar-accent font-semibold text-foreground before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-primary"
      >
        <Icon className="size-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {/* Ce qui est à faire aujourd'hui, jamais un total de section (D88). */}
        <AttentionDot count={item.badge} />
      </NavLink>
    </li>
  );
}

// iPad landscape / Mac: fixed 256 px sidebar (not collapsible in V1).
export function Sidebar({
  boatName,
  boatSubtitle,
  items,
  primaryAction,
  accountMenu,
  searchHref,
  className,
}: {
  boatName: string;
  boatSubtitle?: string;
  items: NavItem[];
  primaryAction?: React.ReactNode;
  accountMenu?: React.ReactNode;
  /** La porte de la recherche (E18-4). Absente hors d'un carnet : il n'y a rien à chercher. */
  searchHref?: string;
  className?: string;
}) {
  const t = useTranslations("app");
  const ts = useTranslations("search");
  const primary = navGroup(items, PRIMARY_NAV_KEYS);
  const secondary = navGroup(items, SECONDARY_NAV_KEYS);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="bg-header-gradient px-5 safe-pt-5 pb-5 text-on-navy brass-rule">
        <p className="flex items-center gap-2 text-overline text-brass-light uppercase">
          <XamanMark className="size-4" decorative />
          {t("eyebrow")}
        </p>
        <p className="mt-1.5 truncate text-xl font-semibold">{boatName}</p>
        {boatSubtitle ? (
          <p className="truncate text-caption text-on-navy-2">{boatSubtitle}</p>
        ) : null}
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        {/* Au-dessus des onglets, et hors de leur liste : chercher n'est pas une section du
            carnet, c'est une façon d'y entrer. Elle ne s'allume donc jamais comme un onglet. */}
        {searchHref ? (
          <Link
            href={searchHref as Route}
            className="mb-1 flex min-h-11 items-center gap-3 rounded-lg tap-feedback px-3 text-label font-medium text-ink-2 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <SearchIcon className="size-5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 truncate">{ts("label")}</span>
          </Link>
        ) : null}
        <ul className="flex flex-col gap-1">
          {primary.map((item) => (
            <NavRow key={item.key} item={item} />
          ))}
        </ul>
        {secondary.length > 0 ? (
          <>
            <hr className="my-3 border-sidebar-border" />
            <ul className="flex flex-col gap-1">
              {secondary.map((item) => (
                <NavRow key={item.key} item={item} />
              ))}
            </ul>
          </>
        ) : null}
      </nav>
      {primaryAction || accountMenu ? (
        <div className="flex flex-col gap-2 border-t border-sidebar-border p-3 safe-pb-3">
          {primaryAction}
          {accountMenu}
        </div>
      ) : null}
    </aside>
  );
}
