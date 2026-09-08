import { notFound } from "next/navigation";

import { EngineForm } from "@/components/engines/EngineForm";
import { can, type BoatRole } from "@/lib/permissions";
import { readBoatRole } from "@/lib/queries/boat-context";

export default async function NewEnginePage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const { data: role } = await readBoatRole(boatId);
  if (!role || !can(role as BoatRole, "write")) notFound();
  return <EngineForm boatId={boatId} engine={null} />;
}
