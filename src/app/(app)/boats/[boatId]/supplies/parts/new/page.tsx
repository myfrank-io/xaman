import { notFound } from "next/navigation";

import { PartForm } from "@/components/supplies/PartForm";
import { can, type BoatRole } from "@/lib/permissions";
import { partFormContext } from "@/lib/queries/part-form";
import { createClient } from "@/lib/supabase/server";

// New part of the stock (E5-4): a page, like every form with more than five fields.
export default async function NewPartPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: role }, context] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    partFormContext(supabase, boatId),
  ]);
  if (!role || !can(role as BoatRole, "write")) notFound();

  return (
    <PartForm
      boatId={boatId}
      part={null}
      categories={context.categories}
      contacts={context.contacts}
    />
  );
}
