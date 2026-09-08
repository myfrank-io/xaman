import type { Route } from "next";
import { permanentRedirect } from "next/navigation";

import { inboxPath } from "@/lib/queries/boat-routes";

/**
 * « Importer des documents » lived here (E10-1) until « À valider » became the one door for
 * documents (D109): the pile is dropped there, read by the agent, and validated card by card.
 * The address stays for the bookmarks and the mails that carry it.
 */
export default async function ImportDocumentsPage({
  params,
}: {
  params: Promise<{ boatId: string }>;
}) {
  const { boatId } = await params;
  permanentRedirect(inboxPath(boatId) as Route);
}
