import { notFound } from "next/navigation";

import { ContactForm } from "@/components/contacts/ContactForm";
import { can, type BoatRole } from "@/lib/permissions";
import { usedSpecialties } from "@/lib/queries/contact-specialties";
import { createClient } from "@/lib/supabase/server";

export default async function EditContactPage({
  params,
}: {
  params: Promise<{ boatId: string; contactId: string }>;
}) {
  const { boatId, contactId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: contact }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.from("contacts").select("*").eq("id", contactId).eq("boat_id", boatId).maybeSingle(),
  ]);
  if (!role || !can(role as BoatRole, "write") || !contact) notFound();
  const used = await usedSpecialties(supabase, boatId);
  return (
    <ContactForm
      boatId={boatId}
      usedSpecialties={used}
      contact={{
        id: contact.id,
        name: contact.name,
        specialty: contact.specialty,
        company: contact.company,
        phone: contact.phone,
        email: contact.email,
        address: contact.address,
        notes: contact.notes,
        updatedAt: contact.updated_at,
      }}
    />
  );
}
