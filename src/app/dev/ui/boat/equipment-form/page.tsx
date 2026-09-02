import { EquipmentForm } from "@/components/equipment/EquipmentForm";

import { DEV_BOAT_ID, DevShell } from "../../DevShell";
import { SAMPLE_EQUIPMENT_CATEGORIES } from "../sample";

export default function DevEquipmentFormPage() {
  return (
    <DevShell>
      <EquipmentForm
        boatId={DEV_BOAT_ID}
        item={{
          id: "q1",
          name: "Winch Andersen 62ST",
          categoryId: "sails",
          brand: "Andersen",
          model: "62ST",
          serial: null,
          quantity: 4,
          installedAt: "2019-05-01",
          specs: [
            { key: "Puissance", value: "62" },
            { key: "Vitesses", value: "2" },
          ],
          notes: "Graisse Andersen uniquement.",
          updatedAt: "2026-09-02T10:00:00+00:00",
        }}
        categories={SAMPLE_EQUIPMENT_CATEGORIES}
      />
    </DevShell>
  );
}
