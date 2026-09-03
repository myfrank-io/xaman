"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { BOAT_TABS, type BoatTab } from "@/components/boat/tabs";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { boatTabPath } from "@/lib/queries/boat-routes";

// The tab lives in the URL (`?tab=`): reload, back and share keep it (ux-flows §1.2).
export function BoatTabs({
  boatId,
  active,
  counts,
}: {
  boatId: string;
  active: BoatTab;
  counts: Partial<Record<BoatTab, number>>;
}) {
  const t = useTranslations("boat.tabs");
  const router = useRouter();
  return (
    <Tabs
      value={active}
      onValueChange={(value) => {
        router.replace(
          boatTabPath(boatId, value as BoatTab) as Parameters<typeof router.replace>[0],
        );
      }}
    >
      <TabsList className="w-full sm:w-auto">
        {BOAT_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="min-w-24 gap-2">
            {t(tab)}
            {counts[tab] ? (
              <span className="num text-caption text-ink-3">{counts[tab]}</span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
