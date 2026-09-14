import { EquipmentForm } from "@/components/equipment/EquipmentForm";

import { DEV_BOAT_ID, DevShell } from "../../DevShell";
import { SAMPLE_EQUIPMENT_CATEGORIES } from "../sample";

const KINDS = [
  {
    id: "kind-winch",
    externalRef: "winch",
    label: "Winch",
    categoryRef: "sails_rigging",
    synonyms: ["winch", "andersen"],
  },
  {
    id: "kind-furler",
    externalRef: "furler",
    label: "Emmagasineur / enrouleur",
    categoryRef: "sails_rigging",
    synonyms: ["emmagasineur", "karver"],
  },
  {
    id: "kind-mast",
    externalRef: "mast",
    label: "Mât",
    categoryRef: "sails_rigging",
    synonyms: ["mat", "lorima"],
  },
];

/**
 * The equipment form, in its two states. The default is a row being corrected — the one the
 * touch audit has always measured. `?new=1` is the empty form (E17-3), the only place the
 * family actually proposes itself: on a row that already has one the matcher stays quiet, so
 * without this variant the behaviour the ticket is about could not be looked at.
 */
export default async function DevEquipmentFormPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const { new: isNew } = await searchParams;
  if (isNew) {
    return (
      <DevShell>
        <EquipmentForm
          boatId={DEV_BOAT_ID}
          item={null}
          categories={SAMPLE_EQUIPMENT_CATEGORIES}
          kinds={KINDS}
        />
      </DevShell>
    );
  }
  return (
    <DevShell>
      <EquipmentForm
        boatId={DEV_BOAT_ID}
        item={{
          id: "q1",
          name: "Winch Andersen 62ST",
          categoryId: "sails",
          kindId: "kind-winch",
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
        kinds={KINDS}
      />
    </DevShell>
  );
}
