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

/** How far back the picker of existing interventions goes: a season of paperwork, not a decade. */
const RECENT_LOGS = 200;

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
  // bateau, le rôle, la liste des documents, les listes du formulaire et les interventions
  // qu'un document peut rejoindre — dans une seule vague.
  const tl = await getTranslations("logs.form");
  const [{ data: boat }, { data: role }, items, form, { data: logs }] = await Promise.all([
    readBoatRow(boatId),
    readBoatRole(boatId),
    listInboxItems(supabase, boatId),
    logFormData(supabase, boatId, tl("equipmentRemoved")),
    // A document can join an intervention the carnet already has (D109): the recent ones.
    supabase
      .from("maintenance_logs_view")
      .select("id, title, performed_at")
      .eq("boat_id", boatId)
      .order("performed_at", { ascending: false })
      .limit(RECENT_LOGS),
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
      logs={(logs ?? []).map((log) => ({
        id: log.id ?? "",
        title: log.title ?? "",
        performedAt: log.performed_at ?? "",
      }))}
      canContribute={can(boatRole, "contribute")}
      canWrite={can(boatRole, "write")}
      inboxAddress={domain ? inboxAddress(boat.name, boat.inbox_token, domain) : null}
    />
  );
}
