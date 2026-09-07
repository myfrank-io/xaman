"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname, useSearchParams } from "next/navigation";

import { isNavActive } from "@/components/layout/nav-active";
import { cn } from "@/lib/utils";

// The rule itself is a pure function (`nav-active.ts`): the screens with no entry of their own
// — the haul-outs, the import — are exactly where it goes wrong unseen, so it is tested.
export function useIsActive(href: string): boolean {
  const pathname = usePathname();
  const entity = useSearchParams().get("entity");
  return isNavActive(pathname, href, entity);
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
