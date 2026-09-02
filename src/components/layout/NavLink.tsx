"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function useIsActive(href: string): boolean {
  const pathname = usePathname();
  return pathname === href || pathname.startsWith(`${href}/`);
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
