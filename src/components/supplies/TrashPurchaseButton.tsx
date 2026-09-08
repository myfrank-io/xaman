import { TrashEntityButton } from "@/components/common/TrashEntityButton";

/** « Mettre à la corbeille » a purchase (ux-flows §5.6): soft delete, 8 s undo, 30 days in `/trash`. */
export function TrashPurchaseButton({
  boatId,
  purchaseId,
}: {
  boatId: string;
  purchaseId: string;
}) {
  return <TrashEntityButton kind="purchase" boatId={boatId} id={purchaseId} />;
}
