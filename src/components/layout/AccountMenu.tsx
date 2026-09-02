"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  ChevronUpIcon,
  CircleUserIcon,
  DownloadIcon,
  LogOutIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

import { Avatar, AvatarFallback, initials } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/lib/actions/auth";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath } from "@/lib/queries/boat-routes";
import { cn } from "@/lib/utils";

export type AccountUser = {
  name: string;
  email: string;
};

type Entry = { key: string; label: string; icon: LucideIcon; href?: string; disabled?: boolean };

/**
 * Never a tab (0.1 opening per month, ux-flows §1.6). Sidebar footer from `lg`,
 * bottom of the « Plus » sheet below — a single node rendered at both
 * placements, each form hidden at the wrong breakpoint.
 * The row shows THE ROLE: it is the only way for a `pro` to understand why some
 * buttons do not exist for him.
 */
export function AccountMenu({
  boatId,
  role,
  user,
  className,
}: {
  boatId: string;
  role: BoatRole;
  user: AccountUser;
  className?: string;
}) {
  const t = useTranslations("nav");
  const tr = useTranslations("roles");
  const write = can(role, "write");

  const entries: Entry[] = [
    {
      key: "profile",
      label: t("profile"),
      icon: CircleUserIcon,
      href: boatPath(boatId, "profile"),
    },
    ...(write
      ? [
          {
            key: "members",
            label: t("members"),
            icon: UsersIcon,
            href: boatPath(boatId, "members"),
          },
          {
            key: "settings",
            label: t("settings"),
            icon: SettingsIcon,
            href: boatPath(boatId, "settings"),
          },
        ]
      : []),
    // Placeholder until the install prompt is wired (BACKLOG E0-6 / flux j).
    { key: "install", label: t("installApp"), icon: DownloadIcon, disabled: true },
  ];

  const identity = (
    <>
      <Avatar>
        <AvatarFallback>{initials(user.name || user.email)}</AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-label font-medium text-foreground">
          {user.name || user.email}
        </span>
        <span className="block truncate text-caption text-ink-2">{tr(role)}</span>
      </span>
    </>
  );

  // One form for both placements; each trigger submits it.
  const formRef = React.useRef<HTMLFormElement>(null);
  const submitSignOut = () => formRef.current?.requestSubmit();

  return (
    <div className={cn("contents", className)}>
      <form ref={formRef} action={signOut} className="hidden" />
      {/* < lg: flat rows at the bottom of the « Plus » sheet. */}
      <div className="flex flex-col lg:hidden">
        <div className="flex items-center gap-3 px-4 py-3">{identity}</div>
        <div className="flex flex-col px-1 pb-2">
          {entries.map((entry) =>
            entry.href ? (
              <Link
                key={entry.key}
                href={entry.href as Route}
                className="flex min-h-11 items-center gap-3 rounded-lg tap-feedback px-3 text-body font-medium focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <entry.icon className="size-5 shrink-0 text-ink-2" />
                {entry.label}
              </Link>
            ) : (
              <span
                key={entry.key}
                aria-disabled
                className="flex min-h-11 items-center gap-3 rounded-lg px-3 text-body font-medium text-ink-3"
              >
                <entry.icon className="size-5 shrink-0" />
                {entry.label}
              </span>
            ),
          )}
          <button
            type="button"
            onClick={submitSignOut}
            className="flex min-h-11 w-full items-center gap-3 rounded-lg tap-feedback px-3 text-left text-body font-medium text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <LogOutIcon className="size-5 shrink-0" />
            {t("signOut")}
          </button>
        </div>
      </div>

      {/* >= lg: sidebar footer row opening a menu upwards. */}
      <DropdownMenu>
        <DropdownMenuTrigger className="hidden min-h-11 w-full items-center gap-3 rounded-lg tap-feedback px-2 py-1.5 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none lg:flex">
          {identity}
          <ChevronUpIcon className="size-4 shrink-0 text-n-400" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuLabel className="text-caption text-ink-2">{t("account")}</DropdownMenuLabel>
          {entries.map((entry) =>
            entry.href ? (
              <DropdownMenuItem key={entry.key} asChild>
                <Link href={entry.href as Route}>
                  <entry.icon />
                  {entry.label}
                </Link>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem key={entry.key} disabled>
                <entry.icon />
                {entry.label}
              </DropdownMenuItem>
            ),
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onSelect={(event) => {
              event.preventDefault();
              submitSignOut();
            }}
          >
            <LogOutIcon />
            {t("signOut")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
