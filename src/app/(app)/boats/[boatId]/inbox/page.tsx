import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { InboxScreen } from "@/components/inbox/InboxScreen";
import { inboundDomain } from "@/lib/inbox/receive";
import { can, type BoatRole } from "@/lib/permissions";
import { listInboxItems } from "@/lib/queries/inbox";
import { logFormData } from "@/lib/queries/log-form-data";
import { inboxAddress } from "@/lib/schemas/inbox";
import { readBoatRole, readBoatRow } from "@/lib/queries/boat-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** A photo is read while the person waits: a Claude call needs more than the platform's floor. */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title") };
}

/**
 * « À valider » (D91). What arrived on its own — a photo taken here, an attachment mailed to the
 * boat's address — read by the analysis and waiting for the tap that writes it into the carnet.
 * Every member sees the list; contributors add to it; owners and editors validate.
 */
export default async function InboxPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  // Les traductions ne coûtent aucun aller-retour : les lire d'abord met tout le reste — le
  // bateau, le rôle, la liste des documents et les listes du formulaire — dans une seule vague.
  const tl = await getTranslations("logs.form");
  const [{ data: boat }, { data: role }, items, form] = await Promise.all([
    readBoatRow(boatId),
    readBoatRole(boatId),
    listInboxItems(supabase, boatId),
    logFormData(supabase, boatId, tl("equipmentRemoved")),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;
  const domain = inboundDomain();

  return (
    <InboxScreen
      boatId={boatId}
      pending={items.pending}
      done={items.done}
      categories={form.categories}
      engines={form.engines.map((engine) => ({ id: engine.id, label: engine.label }))}
      contacts={form.contacts}
      canContribute={can(boatRole, "contribute")}
      canWrite={can(boatRole, "write")}
      analysisEnabled
      inboxAddress={domain ? inboxAddress(boat.name, boat.inbox_token, domain) : null}
    />
  );
}
