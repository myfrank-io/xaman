import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { BoatPicker } from "@/components/boats/BoatPicker";
import { boatLandingTarget, LAST_BOAT_COOKIE } from "@/lib/boats/landing";
import { boatPath, NEW_BOAT_PATH } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

// After login (D64, D155): no boat → « Ajouter mon bateau » ; one boat → its dashboard ; several
// → the last one opened (cookie), or the first. The picker is no longer the landing — it only
// shows when asked for by name (`?switch=1`, the account menu's « Changer de bateau »), so nobody,
// admin included, is made to choose a boat before seeing anything.
export default async function BoatsPage({
  searchParams,
}: {
  searchParams: Promise<{ switch?: string | string[] }>;
}) {
  const supabase = await createClient();
  const { data: boats } = await supabase
    .from("boats")
    .select("id, name, builder, model")
    .order("name");

  const { switch: switchParam } = await searchParams;
  const jar = await cookies();
  const target = boatLandingTarget(
    (boats ?? []).map((boat) => boat.id),
    jar.get(LAST_BOAT_COOKIE)?.value,
    switchParam !== undefined,
  );

  if (target.kind === "new") redirect(NEW_BOAT_PATH);
  if (target.kind === "boat") redirect(boatPath(target.boatId, "dashboard") as Route);

  return <BoatPicker boats={boats ?? []} />;
}
