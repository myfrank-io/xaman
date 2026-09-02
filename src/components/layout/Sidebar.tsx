import { useTranslations } from "next-intl";

import { NavLink } from "@/components/layout/NavLink";
import { NAV_ICONS, type NavItem } from "@/components/layout/nav";
import { cn } from "@/lib/utils";

// iPad landscape / Mac: fixed left sidebar.
export function Sidebar({
  boatName,
  boatSubtitle,
  items,
  footer,
  className,
}: {
  boatName: string;
  boatSubtitle?: string;
  items: NavItem[];
  footer?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("app");

  return (
    <aside
      className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="bg-header-gradient px-5 pt-5 safe-top pb-5 text-white">
        <p className="text-xs font-medium tracking-widest text-white/60 uppercase">{t("name")}</p>
        <p className="mt-1 truncate text-xl font-semibold">{boatName}</p>
        {boatSubtitle ? <p className="truncate text-sm text-white/70">{boatSubtitle}</p> : null}
      </div>
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.key];
            return (
              <li key={item.key}>
                <NavLink
                  href={item.href}
                  className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
      {footer ? (
        <div className="border-t border-sidebar-border p-3 safe-bottom">{footer}</div>
      ) : null}
    </aside>
  );
}
