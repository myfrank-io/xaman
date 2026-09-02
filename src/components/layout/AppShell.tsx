import { Fragment } from "react";
import { getTranslations } from "next-intl/server";

import { BottomTabs } from "@/components/layout/BottomTabs";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import type { NavItem } from "@/components/layout/nav";

// Application frame: sidebar from `lg` (iPad landscape, Mac), top bar + bottom tabs below.
export async function AppShell({
  boatName,
  boatSubtitle,
  nav,
  primaryAction,
  accountMenu,
  banner,
  children,
}: {
  boatName: string;
  boatSubtitle?: string;
  nav: NavItem[];
  /**
   * The single creation control (R2), rendered at BOTH placements: sidebar
   * footer from `lg`, compact header below. Only one is ever visible — its
   * container is breakpoint-hidden.
   */
  primaryAction?: React.ReactNode;
  /** Role, profile, members, settings, sign out (ux-flows §1.6). */
  accountMenu?: React.ReactNode;
  /** Offline / « à vérifier » strip, above the content and under the header. */
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const t = await getTranslations("nav");

  // The same element is mounted at two placements; each one is wrapped in its
  // own keyed Fragment so React does not read them as an unkeyed list.
  const at = (placement: string, node: React.ReactNode) =>
    node ? <Fragment key={placement}>{node}</Fragment> : undefined;

  return (
    <div className="min-h-dvh lg:pl-64">
      <a
        href="#main"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        {t("skipToContent")}
      </a>
      <Sidebar
        boatName={boatName}
        boatSubtitle={boatSubtitle}
        items={nav}
        primaryAction={at("sidebar-action", primaryAction)}
        accountMenu={at("sidebar-account", accountMenu)}
        className="hidden lg:flex"
      />
      <TopBar
        boatName={boatName}
        boatSubtitle={boatSubtitle}
        nav={nav}
        action={at("header-action", primaryAction)}
        className="lg:hidden"
      />
      {banner}
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto w-full max-w-6xl px-4 pt-4 pb-[calc(7rem+env(safe-area-inset-bottom))] sm:px-6 lg:px-8 lg:pt-8 lg:pb-12"
      >
        {children}
      </main>
      <BottomTabs
        items={nav}
        accountMenu={at("sheet-account", accountMenu)}
        className="lg:hidden"
      />
    </div>
  );
}
