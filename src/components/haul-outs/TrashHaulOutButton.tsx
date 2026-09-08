import { TrashEntityButton } from "@/components/common/TrashEntityButton";

/** « Mettre à la corbeille » of a haul-out (E6-1): soft delete, 8 s undo, 30 days in `/trash`. */
export function TrashHaulOutButton({ boatId, haulOutId }: { boatId: string; haulOutId: string }) {
  return <TrashEntityButton kind="haulOut" boatId={boatId} id={haulOutId} />;
}
