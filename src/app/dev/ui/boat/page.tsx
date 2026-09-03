import { BoatIdentity } from "@/components/boat/BoatIdentity";
import { BoatTabs } from "@/components/boat/BoatTabs";
import { EnginesTab } from "@/components/engines/EnginesTab";
import { EquipmentTab } from "@/components/equipment/EquipmentTab";
import { countLowStock } from "@/lib/parts";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import { SAMPLE_PARTS } from "../supplies/sample";
import {
  SAMPLE_BOAT,
  SAMPLE_ENGINES,
  SAMPLE_EQUIPMENT,
  SAMPLE_EQUIPMENT_CATEGORIES,
} from "./sample";

/**
 * Visual acceptance of the boat screen (D34, D37): the identity as the heading with its
 * pencil, then the two lists — engines, and equipment with the spare-parts stock beside it,
 * every section closed on arrival.
 */
export default async function DevBoatPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const only = tab === "engines" || tab === "equipment" ? tab : null;
  return (
    <DevShell>
      <div className="flex flex-col gap-6">
        <BoatIdentity boat={SAMPLE_BOAT} canEdit templateName="ORC 50 (Marsaudon)" />
        <BoatTabs
          boatId={DEV_BOAT_ID}
          active={only ?? "engines"}
          counts={{ engines: 3, equipment: 7 }}
        />
        {!only || only === "engines" ? (
          <EnginesTab boatId={DEV_BOAT_ID} engines={SAMPLE_ENGINES} canWrite canContribute />
        ) : null}
        {!only || only === "equipment" ? (
          <EquipmentTab
            boatId={DEV_BOAT_ID}
            items={SAMPLE_EQUIPMENT}
            categories={SAMPLE_EQUIPMENT_CATEGORIES}
            stock={{
              parts: SAMPLE_PARTS,
              filter: "all",
              lowCount: countLowStock(SAMPLE_PARTS),
              totalCount: SAMPLE_PARTS.length,
            }}
            canWrite
          />
        ) : null}
      </div>
    </DevShell>
  );
}
