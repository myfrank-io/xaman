import { notFound } from "next/navigation";

import { BoatPicker } from "@/components/boats/BoatPicker";
import { devUiEnabled } from "@/lib/dev-ui";

/**
 * Visual acceptance of the boat selector. The page around it redirects straight to the
 * dashboard when someone owns a single boat, which is everyone today — so this screen is all
 * but unreachable and had never been opened on a phone. Long yard names on purpose.
 */
export default function DevBoatsPage() {
  if (!devUiEnabled()) notFound();
  return (
    <BoatPicker
      boats={[
        {
          id: "00000000-0000-4000-8000-000000000000",
          name: "Xaman",
          builder: "Marsaudon Composites",
          model: "ORC 50",
        },
        {
          id: "00000000-0000-4000-8000-000000000001",
          name: "Petit Coquelicot des Abers",
          builder: "Chantier Naval de Plouguerneau",
          model: "Cotre aurique 9,60 m",
        },
        {
          id: "00000000-0000-4000-8000-000000000002",
          name: "Anémone",
          builder: null,
          model: "First 31.7",
        },
      ]}
    />
  );
}
