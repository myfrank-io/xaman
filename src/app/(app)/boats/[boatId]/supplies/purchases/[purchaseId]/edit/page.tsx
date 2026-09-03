import { notFound } from "next/navigation";

import { PurchaseForm } from "@/components/supplies/PurchaseForm";
import { TrashPurchaseButton } from "@/components/supplies/TrashPurchaseButton";
import { can, type BoatRole } from "@/lib/permissions";
import { listAttachments } from "@/lib/queries/attachments";
import { purchaseFormContext } from "@/lib/queries/purchase-form";
import { createClient } from "@/lib/supabase/server";

/**
 * Edit a purchase (E5-2). « Mettre à la corbeille » lives here and nowhere else: no swipe
 * on the list, which is far too easy to trigger with the boat rolling (ux-flows §5.6).
 */
export default async function EditPurchasePage({
  params,
}: {
  params: Promise<{ boatId: string; purchaseId: string }>;
}) {
  const { boatId, purchaseId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: purchase }, context, attachments] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("purchases")
      .select("*")
      .eq("id", purchaseId)
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .maybeSingle(),
    purchaseFormContext(supabase, boatId),
    // The invoice and the photos already stored on this purchase (E10-1).
    listAttachments(supabase, boatId, { type: "purchase", id: purchaseId }).catch(() => []),
  ]);
  if (!role || !can(role as BoatRole, "write") || !purchase) notFound();

  return (
    <div className="flex flex-col gap-6">
      <PurchaseForm
        boatId={boatId}
        purchase={{
          id: purchase.id,
          kind: purchase.kind,
          designation: purchase.designation,
          amount: purchase.amount,
          purchasedAt: purchase.purchased_at,
          supplierContactId: purchase.supplier_contact_id,
          supplierName: purchase.supplier_name,
          categoryId: purchase.category_id,
          bottleType: purchase.bottle_type,
          maintenanceLogId: purchase.maintenance_log_id,
          notes: purchase.notes,
          needsReview: purchase.needs_review,
          updatedAt: purchase.updated_at,
        }}
        categories={context.categories}
        contacts={context.contacts}
        logs={context.logs}
        suggestions={context.suggestions}
        attachments={attachments}
      />
      <div className="flex justify-end">
        <TrashPurchaseButton boatId={boatId} purchaseId={purchase.id} />
      </div>
    </div>
  );
}
