"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { NavLink, useIsActive } from "@/components/layout/NavLink";
import {
  NAV_ICONS,
  navGroup,
  PRIMARY_NAV_KEYS,
  SECONDARY_NAV_KEYS,
  type NavItem,
} from "@/components/layout/nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// 12 px / 600 and not 11 px / 500: readability in full sun (ux-flows §1.3).
function tabClass(active: boolean) {
  return cn(
    "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 tap-feedback px-1 text-[12px] font-semibold",
    active ? "text-primary" : "text-ink-2",
  );
}

/** Solid 3 px top rule on the active tab: colour alone does not survive the sun. */
function ActiveRule({ active }: { active: boolean }) {
  return active ? (
    <span className="absolute inset-x-0 top-0 h-[3px] rounded-b bg-primary" aria-hidden />
  ) : null;
}

function CounterDot({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="absolute top-1.5 right-[calc(50%-1.25rem)] inline-flex min-w-4 items-center justify-center rounded-full bg-status-urgent px-1 num text-[10px] leading-4 font-bold text-white">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function MoreSheet({ items, accountMenu }: { items: NavItem[]; accountMenu?: React.ReactNode }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const anyActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type="button" className={tabClass(anyActive)} onClick={() => setOpen(true)}>
        <ActiveRule active={anyActive} />
        <MoreHorizontalIcon className="size-6" />
        <span>{t("more")}</span>
      </button>
      <SheetContent side="bottom" className="gap-0">
        <SheetHeader>
          <SheetTitle>{t("menu")}</SheetTitle>
        </SheetHeader>
        {/* Two groups, never mixed: management first, then the account block. */}
        <ul className="flex flex-col border-t border-border">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.key];
            return (
              <li key={item.key}>
                <NavLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-16 items-center gap-3 border-b border-border tap-feedback px-4 py-2 text-body font-medium"
                  activeClassName="bg-accent"
                >
                  <Icon className="size-5 shrink-0 text-ink-2" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {/* Context value on the right: it avoids opening a screen for nothing. */}
                  {item.hint ? (
                    <span className="shrink-0 num text-caption text-ink-2">{item.hint}</span>
                  ) : null}
                  {item.badge ? (
                    <span className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full bg-status-urgent px-1.5 num text-caption font-bold text-white">
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            );
          })}
        </ul>
        {accountMenu ? <div className="border-t border-border">{accountMenu}</div> : null}
      </SheetContent>
    </Sheet>
  );
}

function Tab({ item }: { item: NavItem }) {
  const active = useIsActive(item.href);
  const Icon = NAV_ICONS[item.key];
  return (
    <NavLink href={item.href} className={tabClass(active)}>
      <ActiveRule active={active} />
      <Icon className="size-6" />
      <CounterDot count={item.badge} />
      <span className="truncate">{item.shortLabel ?? item.label}</span>
    </NavLink>
  );
}

// iPhone / iPad portrait: bottom tab bar with safe-area padding.
export function BottomTabs({
  items,
  accountMenu,
  className,
}: {
  items: NavItem[];
  accountMenu?: React.ReactNode;
  className?: string;
}) {
  const primary = navGroup(items, PRIMARY_NAV_KEYS);
  const secondary = navGroup(items, SECONDARY_NAV_KEYS);

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 safe-pb-0 backdrop-blur",
        className,
      )}
    >
      <div className="flex items-stretch">
        {primary.map((item) => (
          <Tab key={item.key} item={item} />
        ))}
        {secondary.length > 0 || accountMenu ? (
          <MoreSheet items={secondary} accountMenu={accountMenu} />
        ) : null}
      </div>
    </nav>
  );
}
