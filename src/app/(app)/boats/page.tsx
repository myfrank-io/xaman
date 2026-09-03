import { redirect } from "next/navigation";

import { BoatPicker } from "@/components/boats/BoatPicker";
import { createClient } from "@/lib/supabase/server";

// After login: one boat → its dashboard, several → selector, none → waiting page (BACKLOG E1-3, E10-2).
export default async function BoatsPage() {
  const supabase = await createClient();
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, builder, model")
    .order("name");

  if (boats && boats.length === 1 && boats[0]) {
    redirect(`/boats/${boats[0].id}/dashboard`);
  }

  return <BoatPicker boats={boats ?? []} />;
}
