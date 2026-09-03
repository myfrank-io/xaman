import { redirect } from "next/navigation";
import type { Route } from "next";

import { newPartPath } from "@/lib/queries/boat-routes";

/**
 * The stock moved to Bateau › Équipements (D34). This route stays only so a link already
 * sent, a bookmark or an installed PWA lands somewhere real.
 */
export default async function MovedNewPartPage({
  params,
}: {
  params: Promise<{ boatId: string }>;
}) {
  const { boatId } = await params;
  redirect(newPartPath(boatId) as Route);
}
