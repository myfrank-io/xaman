import { notFound } from "next/navigation";

import { ContactForm } from "@/components/contacts/ContactForm";
import { can, type BoatRole } from "@/lib/permissions";
import { usedSpecialties } from "@/lib/queries/contact-specialties";
import { createClient } from "@/lib/supabase/server";

export default async function NewContactPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role || !can(role as BoatRole, "write")) notFound();
  const used = await usedSpecialties(supabase, boatId);
  return <ContactForm boatId={boatId} contact={null} usedSpecialties={used} />;
}
