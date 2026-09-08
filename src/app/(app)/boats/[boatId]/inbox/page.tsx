import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { InboxScreen } from "@/components/inbox/InboxScreen";
import { analysisConfigured } from "@/lib/inbox/analyse";
import { inboundDomain } from "@/lib/inbox/receive";
import { can, type BoatRole } from "@/lib/permissions";
import { listInboxItems } from "@/lib/queries/inbox";
import { logFormData } from "@/lib/queries/log-form-data";
import { inboxAddress } from "@/lib/schemas/inbox";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
/** A photo is read while the person waits: a Claude call needs more than the platform's floor. */
export const maxDuration = 60;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("inbox");
  return { title: t("title") };
}

/**
 * « À valider » (D84). What arrived on its own — a photo taken here, an attachment mailed to the
 * boat's address — read by the analysis and waiting for the tap that writes it into the carnet.
 * Every member sees the list; contributors add to it; owners and editors validate.
 */
export default async function InboxPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const [{ data: boat }, { data: role }, tl] = await Promise.all([
    supabase.from("boats").select("id, name, inbox_token").eq("id", boatId).maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    getTranslations("logs.form"),
  ]);
  if (!boat || !role) notFound();
  const boatRole = role as BoatRole;

  const [items, form] = await Promise.all([
    listInboxItems(supabase, boatId),
    logFormData(supabase, boatId, tl("equipmentRemoved")),
  ]);
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
      analysisEnabled={analysisConfigured()}
      inboxAddress={domain ? inboxAddress(boat.name, boat.inbox_token, domain) : null}
    />
  );
}
