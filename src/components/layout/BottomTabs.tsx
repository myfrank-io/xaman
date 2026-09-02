"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { MoreHorizontalIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { NavLink, useIsActive } from "@/components/layout/NavLink";
import { NAV_ICONS, PRIMARY_NAV_KEYS, type NavItem } from "@/components/layout/nav";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

function tabClass(active: boolean) {
  return cn(
    "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium",
    active ? "text-primary" : "text-muted-foreground",
  );
}

function MoreTab({ items }: { items: NavItem[] }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const anyActive = items.some(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <button type="button" className={tabClass(anyActive)} onClick={() => setOpen(true)}>
        <MoreHorizontalIcon className="size-6" />
        <span>{t("more")}</span>
      </button>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>{t("menu")}</SheetTitle>
        </SheetHeader>
        <ul className="grid grid-cols-2 gap-2 px-4 pb-4 sm:grid-cols-3">
          {items.map((item) => {
            const Icon = NAV_ICONS[item.key];
            return (
              <li key={item.key}>
                <NavLink
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex min-h-16 items-center gap-3 rounded-lg bg-muted/60 px-4 text-sm font-medium hover:bg-muted"
                  activeClassName="bg-primary/10 text-primary"
                >
                  <Icon className="size-5 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}

function Tab({ item }: { item: NavItem }) {
  const active = useIsActive(item.href);
  const Icon = NAV_ICONS[item.key];
  return (
    <NavLink href={item.href} className={tabClass(active)}>
      <Icon className="size-6" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

// iPhone / iPad portrait: bottom tab bar with safe-area padding.
export function BottomTabs({ items, className }: { items: NavItem[]; className?: string }) {
  const primary = PRIMARY_NAV_KEYS.map((key) => items.find((item) => item.key === key)).filter(
    (item): item is NavItem => item !== undefined,
  );
  const secondary = items.filter((item) => !PRIMARY_NAV_KEYS.includes(item.key));

  return (
    <nav
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 safe-bottom backdrop-blur",
        className,
      )}
    >
      <div className="flex items-stretch">
        {primary.map((item) => (
          <Tab key={item.key} item={item} />
        ))}
        {secondary.length > 0 ? <MoreTab items={secondary} /> : null}
      </div>
    </nav>
  );
}
