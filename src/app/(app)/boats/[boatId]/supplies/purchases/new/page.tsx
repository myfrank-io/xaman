import { notFound } from "next/navigation";

import { PurchaseForm } from "@/components/supplies/PurchaseForm";
import { can, type BoatRole } from "@/lib/permissions";
import { purchaseFormContext } from "@/lib/queries/purchase-form";
import { isPurchaseKind } from "@/lib/purchases";
import { createClient } from "@/lib/supabase/server";

// New purchase (E5-2): a page, because the form has more than five fields and a textarea.
export default async function NewPurchasePage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const [{ boatId }, { kind }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [{ data: role }, context] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    purchaseFormContext(supabase, boatId),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();

  return (
    <PurchaseForm
      boatId={boatId}
      purchase={null}
      categories={context.categories}
      contacts={context.contacts}
      logs={context.logs}
      suggestions={context.suggestions}
      defaultKind={isPurchaseKind(kind) ? kind : undefined}
    />
  );
}
