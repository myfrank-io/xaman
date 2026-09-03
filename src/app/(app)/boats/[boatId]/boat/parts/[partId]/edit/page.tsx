import { notFound } from "next/navigation";

import { AuditFooter } from "@/components/common/AuditFooter";
import { DeletePartButton } from "@/components/parts/DeletePartButton";
import { PartForm } from "@/components/parts/PartForm";
import { can, type BoatRole } from "@/lib/permissions";
import { auditNames } from "@/lib/queries/audit-names";
import { partFormContext } from "@/lib/queries/part-form";
import { createClient } from "@/lib/supabase/server";

/** Edit a part (E5-4). Deletion lives here and nowhere else: no swipe on the list. */
export default async function EditPartPage({
  params,
}: {
  params: Promise<{ boatId: string; partId: string }>;
}) {
  const { boatId, partId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: part }, context] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.from("parts").select("*").eq("id", partId).eq("boat_id", boatId).maybeSingle(),
    partFormContext(supabase, boatId),
  ]);
  if (!role || !can(role as BoatRole, "write") || !part) notFound();
  const names = await auditNames(supabase, [part.created_by, part.updated_by]);

  return (
    <div className="flex flex-col gap-6">
      <PartForm
        boatId={boatId}
        part={{
          id: part.id,
          name: part.name,
          reference: part.reference,
          quantity: part.quantity,
          minQuantity: part.min_quantity,
          unit: part.unit,
          location: part.location,
          categoryId: part.category_id,
          supplierContactId: part.supplier_contact_id,
          notes: part.notes,
          updatedAt: part.updated_at,
        }}
        categories={context.categories}
        contacts={context.contacts}
      />
      <AuditFooter
        createdByName={part.created_by ? (names.get(part.created_by) ?? null) : null}
        createdAt={part.created_at}
        updatedByName={part.updated_by ? (names.get(part.updated_by) ?? null) : null}
        updatedAt={part.updated_at}
      />
      <div className="flex justify-end">
        <DeletePartButton boatId={boatId} partId={part.id} name={part.name} />
      </div>
    </div>
  );
}
