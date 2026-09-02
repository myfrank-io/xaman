import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AccountMenu } from "@/components/layout/AccountMenu";
import { AppShell } from "@/components/layout/AppShell";
import { PrimaryActionSheet } from "@/components/layout/PrimaryActionSheet";
import {
  ACCOUNT_NAV_KEYS,
  PRIMARY_NAV_KEYS,
  SECONDARY_NAV_KEYS,
  type NavItem,
} from "@/components/layout/nav";

export const DEV_BOAT_ID = "00000000-0000-4000-8000-000000000000";

// Application frame around a preview page: same sidebar / tabs as the real app, fake boat.
export async function DevShell({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  const tn = await getTranslations("nav");
  const nav: NavItem[] = [...PRIMARY_NAV_KEYS, ...SECONDARY_NAV_KEYS, ...ACCOUNT_NAV_KEYS].map(
    (key) => ({
      key,
      href: `/boats/${DEV_BOAT_ID}/${key}`,
      label: tn(key),
      shortLabel: tn.has(`short.${key}`) ? tn(`short.${key}`) : undefined,
    }),
  );
  return (
    <AppShell
      boatName="Xaman"
      boatSubtitle="Marsaudon Composites ORC 50"
      nav={nav}
      primaryAction={<PrimaryActionSheet boatId={DEV_BOAT_ID} role="owner" />}
      accountMenu={
        <AccountMenu
          boatId={DEV_BOAT_ID}
          role="owner"
          user={{ name: "Xavier Marin", email: "xavier@example.com" }}
        />
      }
    >
      {children}
    </AppShell>
  );
}
