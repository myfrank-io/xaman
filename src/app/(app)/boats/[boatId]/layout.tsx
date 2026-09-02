import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PlusIcon } from "lucide-react";

import { BoatProvider } from "@/components/boat/BoatProvider";
import { RealtimeBridge } from "@/components/boat/RealtimeBridge";
import { AppShell } from "@/components/layout/AppShell";
import type { NavItem, NavKey } from "@/components/layout/nav";
import { Button } from "@/components/ui/button";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

const NAV_KEYS: NavKey[] = [
  "dashboard",
  "logs",
  "checklist",
  "supplies",
  "haulOuts",
  "contacts",
  "boat",
  "members",
  "settings",
];

// Loads the boat and the user's role once; pages read them through useBoat() / the nav.
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
  const [{ data: boat }, { data: role }] = await Promise.all([
    supabase.from("boats").select("*").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;

  const tn = await getTranslations("nav");
  const tc = await getTranslations("common");
  const nav: NavItem[] = NAV_KEYS.filter((key) => key !== "members" || can(boatRole, "write")).map(
    (key) => ({ key, href: boatPath(boatId, key), label: tn(key) }),
  );

  return (
    <BoatProvider boat={boat} role={boatRole}>
      <RealtimeBridge boatId={boat.id} />
      <AppShell
        boatName={boat.name}
        boatSubtitle={[boat.builder, boat.model].filter(Boolean).join(" ")}
        nav={nav}
        primaryAction={
          can(boatRole, "contribute") ? (
            <Button size="icon" variant="secondary" aria-label={tc("add")}>
              <PlusIcon className="size-5" />
            </Button>
          ) : undefined
        }
      >
        {children}
      </AppShell>
    </BoatProvider>
  );
}
