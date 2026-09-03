import { Fragment, Suspense } from "react";
import { getTranslations } from "next-intl/server";

import { BottomTabs } from "@/components/layout/BottomTabs";
import { Breadcrumb } from "@/components/layout/Breadcrumb";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import type { NavItem } from "@/components/layout/nav";

// Application frame: sidebar from `lg` (iPad landscape, Mac), top bar + bottom tabs below.
export async function AppShell({
  boatId,
  boatName,
  boatSubtitle,
  nav,
  primaryAction,
  accountMenu,
  banner,
  children,
}: {
  /** When given, the trail under the header is built from the URL (E12 UX, fil d'Ariane). */
  boatId?: string;
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
    <div className="min-h-dvh lg:pl-64 print:pl-0">
      <a
        href="#main"
        className="sr-only rounded-lg bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50"
      >
        {t("skipToContent")}
      </a>
      {/* The menu and the trail read the query string to place the import screen, which has no
          route of its own (D43). `useSearchParams` needs a boundary it can defer behind on a
          statically rendered page — every screen of the app is dynamic, so nothing is ever
          deferred there; only the `/dev/ui` mocks, which are prerendered, hydrate their nav. */}
      <Suspense fallback={null}>
        <Sidebar
          boatName={boatName}
          boatSubtitle={boatSubtitle}
          items={nav}
          primaryAction={at("sidebar-action", primaryAction)}
          accountMenu={at("sidebar-account", accountMenu)}
          className="hidden lg:flex print:hidden"
        />
      </Suspense>
      <TopBar
        boatName={boatName}
        boatSubtitle={boatSubtitle}
        nav={nav}
        action={at("header-action", primaryAction)}
        className="lg:hidden print:hidden"
      />
      <div className="print:hidden">{banner}</div>
      <main
        id="main"
        tabIndex={-1}
        className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 pt-3 pb-[calc(8rem+env(safe-area-inset-bottom))] sm:gap-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-10 lg:pb-16 print:max-w-none print:gap-0 print:p-0"
      >
        {boatId ? (
          <Suspense fallback={null}>
            <Breadcrumb boatId={boatId} />
          </Suspense>
        ) : null}
        {children}
      </main>
      <Suspense fallback={null}>
        <BottomTabs
          items={nav}
          accountMenu={at("sheet-account", accountMenu)}
          className="lg:hidden print:hidden"
        />
      </Suspense>
    </div>
  );
}
