import { BottomTabs } from "@/components/layout/BottomTabs";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import type { NavItem } from "@/components/layout/nav";

// Application frame: sidebar from `lg` (iPad landscape, Mac), top bar + bottom tabs below.
export function AppShell({
  boatName,
  boatSubtitle,
  nav,
  primaryAction,
  sidebarFooter,
  children,
}: {
  boatName: string;
  boatSubtitle?: string;
  nav: NavItem[];
  primaryAction?: React.ReactNode;
  sidebarFooter?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh lg:pl-64">
      <Sidebar
        boatName={boatName}
        boatSubtitle={boatSubtitle}
        items={nav}
        footer={sidebarFooter}
        className="hidden lg:flex"
      />
      <TopBar boatName={boatName} action={primaryAction} className="lg:hidden" />
      <main className="mx-auto w-full max-w-6xl px-4 pt-4 pb-28 sm:px-6 lg:px-8 lg:pt-8 lg:pb-12">
        {children}
      </main>
      <BottomTabs items={nav} className="lg:hidden" />
    </div>
  );
}
