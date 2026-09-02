import { BoatIdentity } from "@/components/boat/BoatIdentity";
import { BoatTabs } from "@/components/boat/BoatTabs";
import { PageHeader } from "@/components/common/PageHeader";
import { EnginesTab } from "@/components/engines/EnginesTab";
import { EquipmentTab } from "@/components/equipment/EquipmentTab";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import {
  SAMPLE_BOAT,
  SAMPLE_ENGINES,
  SAMPLE_EQUIPMENT,
  SAMPLE_EQUIPMENT_CATEGORIES,
} from "./sample";

// Visual acceptance of the boat screen: the three tabs stacked on one page.
export default async function DevBoatPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const only = tab === "identity" || tab === "engines" || tab === "equipment" ? tab : null;
  return (
    <DevShell>
      <div className="flex flex-col gap-6">
        <PageHeader title="Xaman" subtitle="ORC 50 #25 · Marsaudon Composites · Catamaran" />
        <BoatTabs
          boatId={DEV_BOAT_ID}
          active={only ?? "engines"}
          counts={{ engines: 3, equipment: 7 }}
        />
        {!only || only === "engines" ? (
          <EnginesTab boatId={DEV_BOAT_ID} engines={SAMPLE_ENGINES} canWrite canContribute />
        ) : null}
        {!only || only === "identity" ? (
          <BoatIdentity boat={SAMPLE_BOAT} canEdit templateName="ORC 50 (Marsaudon)" />
        ) : null}
        {!only || only === "equipment" ? (
          <EquipmentTab
            boatId={DEV_BOAT_ID}
            items={SAMPLE_EQUIPMENT}
            categories={SAMPLE_EQUIPMENT_CATEGORIES}
            canWrite
          />
        ) : null}
      </div>
    </DevShell>
  );
}
