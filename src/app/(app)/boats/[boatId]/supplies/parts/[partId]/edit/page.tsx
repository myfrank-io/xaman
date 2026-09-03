import { redirect } from "next/navigation";
import type { Route } from "next";

import { editPartPath } from "@/lib/queries/boat-routes";

/** Moved to Bateau › Équipements (D34); the old URL keeps working. */
export default async function MovedEditPartPage({
  params,
}: {
  params: Promise<{ boatId: string; partId: string }>;
}) {
  const { boatId, partId } = await params;
  redirect(editPartPath(boatId, partId) as Route);
}
