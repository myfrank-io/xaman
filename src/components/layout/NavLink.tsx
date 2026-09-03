"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";

import { importSection } from "@/components/layout/breadcrumb-trail";
import { BOAT_ROUTES } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

export function useIsActive(href: string): boolean {
  const pathname = usePathname();
  const entity = useSearchParams().get("entity");
  if (pathname === href || pathname.startsWith(`${href}/`)) return true;
  // The import screen has no entry of its own: it belongs to the list its `?entity=` names, and
  // that list's entry is the one that must light up. Without this the menu shows nothing
  // selected, so « où suis-je » has no answer on the one screen that is hardest to place.
  if (!pathname.endsWith("/import")) return false;
  const owner = importSection(entity);
  return owner ? href.endsWith(`/${BOAT_ROUTES[owner.nav]}`) : false;
}

export function NavLink({
  href,
  className,
  activeClassName,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  const active = useIsActive(href);

  return (
    <Link
      // nav hrefs are built from the boat id at runtime; typed routes only validate literals
      href={href as Route}
      aria-current={active ? "page" : undefined}
      className={cn(className, active && activeClassName)}
      onClick={onClick}
    >
      {children}
    </Link>
  );
}
