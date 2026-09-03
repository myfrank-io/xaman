import { notFound } from "next/navigation";
import { differenceInCalendarDays } from "date-fns";
import { Trash2Icon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { EmptyState } from "@/components/common/EmptyState";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { PurgeButton } from "@/components/trash/PurgeButton";
import { RestoreButton, type TrashKind } from "@/components/trash/RestoreButton";
import { formatCurrency, formatDate, toDate } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";

const RETENTION_DAYS = 30;

type TrashEntry = {
  id: string;
  title: string;
  meta: string;
  amount: number | null;
  deletedAt: string;
  deletedByName: string | null;
  categoryColor?: string | null;
};

/** Start of the retention window, as an ISO timestamp the query can compare against. */
function retentionCutoff(): string {
  const date = new Date();
  date.setDate(date.getDate() - RETENTION_DAYS);
  return date.toISOString();
}

function daysLeft(deletedAt: string): number {
  const date = toDate(deletedAt);
  if (!date) return RETENTION_DAYS;
  return Math.max(0, RETENTION_DAYS - differenceInCalendarDays(new Date(), date));
}

/**
 * Corbeille (E3-5, widened by D40 / D41): everything the app can remove and that holds the
 * boat's history or its inventory — interventions, achats, sorties de l'eau, pièces de stock,
 * intervenants and documents — soft-deleted less than 30 days ago. The toast that carried
 * « Annuler » is gone by now; this screen is the real safety net.
 *
 * What is deliberately absent: a system, a point de checklist, a moteur and un équipement are
 * archived rather than deleted and come back from their own screen; removing a member is not
 * deleting data, and their interventions stay in the logbook.
 */
export default async function TrashPage({ params }: { params: Promise<{ boatId: string }> }) {
  const { boatId } = await params;
  const supabase = await createClient();
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (!role) notFound();
  if (!can(role as BoatRole, "write")) notFound();

  const since = retentionCutoff();
  const [
    { data: logs },
    { data: purchases },
    { data: haulOuts },
    { data: parts },
    { data: contacts },
    { data: attachments },
  ] = await Promise.all([
    supabase
      .from("maintenance_logs_trash_view")
      .select("id, title, performed_at, cost, category_color, deleted_at, deleted_by_name")
      .eq("boat_id", boatId)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("purchases")
      .select("id, designation, purchased_at, amount, deleted_at")
      .eq("boat_id", boatId)
      .not("deleted_at", "is", null)
      .gt("deleted_at", since)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("haul_outs")
      .select("id, started_at, yard_name, cost, deleted_at")
      .eq("boat_id", boatId)
      .not("deleted_at", "is", null)
      .gt("deleted_at", since)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("parts")
      .select("id, name, reference, quantity, unit, location, deleted_at")
      .eq("boat_id", boatId)
      .not("deleted_at", "is", null)
      .gt("deleted_at", since)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("contacts")
      .select("id, name, specialty, company, deleted_at")
      .eq("boat_id", boatId)
      .not("deleted_at", "is", null)
      .gt("deleted_at", since)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("attachments")
      .select("id, file_name, caption, entity_type, deleted_at")
      .eq("boat_id", boatId)
      .not("deleted_at", "is", null)
      .gt("deleted_at", since)
      .order("deleted_at", { ascending: false }),
  ]);

  const t = await getTranslations("trash");

  const logEntries: TrashEntry[] = (logs ?? []).map((row) => ({
    id: row.id ?? "",
    title: row.title ?? "",
    meta: formatDate(row.performed_at),
    amount: row.cost,
    deletedAt: row.deleted_at ?? "",
    deletedByName: row.deleted_by_name,
    categoryColor: row.category_color,
  }));
  const purchaseEntries: TrashEntry[] = (purchases ?? []).map((row) => ({
    id: row.id,
    title: row.designation,
    meta: formatDate(row.purchased_at),
    amount: row.amount,
    deletedAt: row.deleted_at ?? "",
    deletedByName: null,
  }));
  const haulOutEntries: TrashEntry[] = (haulOuts ?? []).map((row) => ({
    id: row.id,
    title: row.yard_name ?? t("haulOutLabel", { date: formatDate(row.started_at) }),
    meta: formatDate(row.started_at),
    amount: row.cost,
    deletedAt: row.deleted_at ?? "",
    deletedByName: null,
  }));
  const partEntries: TrashEntry[] = (parts ?? []).map((row) => ({
    id: row.id,
    title: row.name,
    meta: [t("partQuantity", { quantity: row.quantity, unit: row.unit }), row.location]
      .filter(Boolean)
      .join(" · "),
    amount: null,
    deletedAt: row.deleted_at ?? "",
    deletedByName: null,
  }));
  const contactEntries: TrashEntry[] = (contacts ?? []).map((row) => ({
    id: row.id,
    title: row.name,
    meta: [row.specialty, row.company].filter(Boolean).join(" · "),
    amount: null,
    deletedAt: row.deleted_at ?? "",
    deletedByName: null,
  }));
  // V1 only hangs documents off an intervention or a purchase; the other enum values are
  // reserved (DATA-MODEL §3.19) and get the generic label rather than the wrong one.
  const attachmentEntries: TrashEntry[] = (attachments ?? []).map((row) => ({
    id: row.id,
    title: row.caption ?? row.file_name,
    meta: t(
      `attachmentOwner.${
        row.entity_type === "maintenance_log" || row.entity_type === "purchase"
          ? row.entity_type
          : "other"
      }`,
    ),
    amount: null,
    deletedAt: row.deleted_at ?? "",
    deletedByName: null,
  }));

  const sections: { key: TrashKind; title: string; entries: TrashEntry[] }[] = [
    { key: "log", title: t("sections.logs"), entries: logEntries },
    { key: "purchase", title: t("sections.purchases"), entries: purchaseEntries },
    { key: "haulOut", title: t("sections.haulOuts"), entries: haulOutEntries },
    { key: "part", title: t("sections.parts"), entries: partEntries },
    { key: "contact", title: t("sections.contacts"), entries: contactEntries },
    { key: "attachment", title: t("sections.attachments"), entries: attachmentEntries },
  ];
  const total = sections.reduce((sum, section) => sum + section.entries.length, 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("title")} subtitle={t("description")} />

      {total === 0 ? (
        <EmptyState icon={<Trash2Icon />} title={t("empty")} description={t("emptyDescription")} />
      ) : (
        // Only the sections that hold something: six empty headings would bury the one line
        // the person came here for.
        sections
          .filter((section) => section.entries.length > 0)
          .map((section) => (
            <SectionCard key={section.key} title={section.title}>
              {section.entries.map((entry) => (
                <ListRow
                  key={entry.id}
                  size="lg"
                  categoryColor={entry.categoryColor ?? undefined}
                  title={entry.title}
                  meta={
                    <span className="truncate">
                      {[
                        entry.meta,
                        entry.deletedByName
                          ? t("deletedOn", {
                              date: formatDate(entry.deletedAt),
                              name: entry.deletedByName,
                            })
                          : null,
                        t("purgeIn", { days: daysLeft(entry.deletedAt) }),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  }
                  trailing={
                    entry.amount !== null ? (
                      <span className="num text-caption text-ink-2">
                        {formatCurrency(entry.amount)}
                      </span>
                    ) : null
                  }
                  action={
                    <div className="flex items-center gap-1">
                      <RestoreButton boatId={boatId} id={entry.id} kind={section.key} />
                      <PurgeButton
                        boatId={boatId}
                        id={entry.id}
                        kind={section.key}
                        label={entry.title}
                      />
                    </div>
                  }
                />
              ))}
            </SectionCard>
          ))
      )}

      <p className="text-caption text-ink-3">{t("purgeNote")}</p>
    </div>
  );
}
