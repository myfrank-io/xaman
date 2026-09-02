import { useTranslations } from "next-intl";

import { XamanMark } from "@/components/brand/XamanMark";
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
        {item.badge ? (
          <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-status-urgent px-1.5 num text-caption font-bold text-white">
            {item.badge}
          </span>
        ) : null}
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
  className,
}: {
  boatName: string;
  boatSubtitle?: string;
  items: NavItem[];
  primaryAction?: React.ReactNode;
  accountMenu?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("app");
  const primary = navGroup(items, PRIMARY_NAV_KEYS);
  const secondary = navGroup(items, SECONDARY_NAV_KEYS);

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="bg-header-gradient px-5 pt-5 safe-top pb-5 text-on-navy">
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
        <div className="flex flex-col gap-2 border-t border-sidebar-border p-3 safe-bottom">
          {primaryAction}
          {accountMenu}
        </div>
      ) : null}
    </aside>
  );
}
