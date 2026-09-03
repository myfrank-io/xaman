import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { BoatProvider } from "@/components/boat/BoatProvider";
import { RealtimeBridge } from "@/components/boat/RealtimeBridge";
import { OfflineBanner } from "@/components/common/OfflineBanner";
import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell } from "@/components/layout/AppShell";
import { PrimaryActionSheet } from "@/components/layout/PrimaryActionSheet";
import {
  ACCOUNT_NAV_KEYS,
  PRIMARY_NAV_KEYS,
  SECONDARY_NAV_KEYS,
  type NavItem,
  type NavKey,
} from "@/components/layout/nav";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

const NAV_KEYS: NavKey[] = [...PRIMARY_NAV_KEYS, ...SECONDARY_NAV_KEYS, ...ACCOUNT_NAV_KEYS];

// A `pro` / `viewer` never sees the trash, the members or the boat settings:
// forbidden actions are ABSENT, not greyed out (greying is reserved for offline).
// An `editor` sees the members, read-only.
function visibleKeys(role: BoatRole): NavKey[] {
  return NAV_KEYS.filter((key) => {
    if (key === "trash" || key === "settings") return can(role, "write");
    if (key === "members") return can(role, "write");
    return true;
  });
}

// Loads the boat, the user's role and the nav counters once; pages read them
// through useBoat() / the nav.
export default async function BoatLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ boatId: string }>;
}) {
  const { boatId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(boatId)) notFound();

  const supabase = await createClient();
  const [{ data: boat }, { data: role }, { data: auth }] = await Promise.all([
    supabase.from("boats").select("*").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.auth.getUser(),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;

  const [{ data: stats }, { data: profile }] = await Promise.all([
    // Existing columns only (`boat_dashboard_stats`): no new column is required.
    supabase
      .from("boat_dashboard_stats")
      .select("overdue_items, planned_logs, in_progress_logs, urgent_logs")
      .eq("boat_id", boatId)
      .maybeSingle(),
    auth.user
      ? supabase.from("profiles").select("full_name, email").eq("id", auth.user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const openLogs =
    (stats?.planned_logs ?? 0) + (stats?.in_progress_logs ?? 0) + (stats?.urgent_logs ?? 0);
  const badges: Partial<Record<NavKey, number>> = {
    checklist: stats?.overdue_items ?? 0,
    logs: openLogs,
  };

  const tn = await getTranslations("nav");
  const nav: NavItem[] = visibleKeys(boatRole).map((key) => ({
    key,
    href: boatPath(boatId, key),
    label: tn(key),
    shortLabel: tn.has(`short.${key}`) ? tn(`short.${key}`) : undefined,
    badge: badges[key] || undefined,
  }));

  const account = {
    name: profile?.full_name ?? "",
    email: profile?.email ?? auth.user?.email ?? "",
  };

  return (
    <BoatProvider boat={boat} role={boatRole}>
      <RealtimeBridge boatId={boat.id} />
      <AppShell
        boatId={boatId}
        boatName={boat.name}
        boatSubtitle={[boat.builder, boat.model].filter(Boolean).join(" ")}
        nav={nav}
        primaryAction={
          can(boatRole, "contribute") ? (
            <PrimaryActionSheet boatId={boatId} role={boatRole} />
          ) : undefined
        }
        accountMenu={<AccountMenu boatId={boatId} role={boatRole} user={account} />}
        banner={<OfflineBanner lastSyncAt={new Date().toISOString()} />}
      >
        {children}
      </AppShell>
    </BoatProvider>
  );
}
