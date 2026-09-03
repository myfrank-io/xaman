import { redirect } from "next/navigation";

import { BoatPicker } from "@/components/boats/BoatPicker";
import { NEW_BOAT_PATH } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

// After login: one boat → its dashboard, several → selector, none → « Ajouter mon bateau »
// (BACKLOG E1-3, D63). Landing on the creation screen rather than on a picker with a single
// button is the difference between an onboarding and a waiting room; someone who was invited and
// has not accepted yet still has their e-mail link, and the screen says so.
export default async function BoatsPage() {
  const supabase = await createClient();
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, builder, model")
    .order("name");

  if (boats && boats.length === 1 && boats[0]) {
    redirect(`/boats/${boats[0].id}/dashboard`);
  }
  if (!boats || boats.length === 0) {
    redirect(NEW_BOAT_PATH);
  }

  return <BoatPicker boats={boats} />;
}
