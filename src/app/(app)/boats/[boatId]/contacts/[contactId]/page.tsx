import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, MailIcon, MapPinIcon, PencilIcon, PhoneIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { DeleteContactButton } from "@/components/contacts/DeleteContactButton";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import {
  boatPath,
  editContactPath,
  logPath,
  logsPath,
  suppliesPath,
} from "@/lib/queries/boat-routes";
import { AuditFooter } from "@/components/common/AuditFooter";
import { auditNames } from "@/lib/queries/audit-names";
import { createClient } from "@/lib/supabase/server";

const REFERENCE_LIMIT = 10;

// Contact sheet (E6-2): tap-to-call, tap-to-write, and everything done or bought with them.
export default async function ContactPage({
  params,
}: {
  params: Promise<{ boatId: string; contactId: string }>;
}) {
  const { boatId, contactId } = await params;
  const supabase = await createClient();
  const [
    { data: role },
    { data: contact },
    { data: logs, count: logsCount },
    { data: purchases, count: purchasesCount },
    { count: haulOutsCount },
  ] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase.from("contacts").select("*").eq("id", contactId).eq("boat_id", boatId).maybeSingle(),
    supabase
      .from("maintenance_logs_view")
      .select("id, title, performed_at, cost, category_color", { count: "exact" })
      .eq("boat_id", boatId)
      .eq("contact_id", contactId)
      .order("performed_at", { ascending: false })
      .limit(REFERENCE_LIMIT),
    supabase
      .from("purchases")
      .select("id, designation, purchased_at, amount", { count: "exact" })
      .eq("boat_id", boatId)
      .eq("supplier_contact_id", contactId)
      .is("deleted_at", null)
      .order("purchased_at", { ascending: false })
      .limit(REFERENCE_LIMIT),
    supabase
      .from("haul_outs")
      .select("id", { count: "exact", head: true })
      .eq("boat_id", boatId)
      .eq("yard_contact_id", contactId)
      .is("deleted_at", null),
  ]);
  if (!role || !contact) notFound();
  const canWrite = can(role as BoatRole, "write");
  const [t, tc] = await Promise.all([getTranslations("contacts"), getTranslations("common")]);
  const references = {
    logs: logsCount ?? 0,
    purchases: purchasesCount ?? 0,
    haulOuts: haulOutsCount ?? 0,
  };
  const phone = contact.phone?.replace(/\s/g, "") ?? null;
  const names = await auditNames(supabase, [contact.created_by, contact.updated_by]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={boatPath(boatId, "contacts") as Route}>
            <ChevronLeftIcon />
            {t("title")}
          </Link>
        </Button>
        <PageHeader
          className="mt-2"
          title={contact.name}
          subtitle={[contact.specialty, contact.company].filter(Boolean).join(" · ")}
          actions={
            canWrite ? (
              <>
                <Button asChild variant="outline">
                  <Link href={editContactPath(boatId, contactId) as Route}>
                    <PencilIcon />
                    {tc("edit")}
                  </Link>
                </Button>
                <DeleteContactButton
                  boatId={boatId}
                  contactId={contactId}
                  name={contact.name}
                  references={references}
                />
              </>
            ) : undefined
          }
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {phone ? (
            <Button asChild>
              <a href={`tel:${phone}`}>
                <PhoneIcon />
                {contact.phone}
              </a>
            </Button>
          ) : null}
          {contact.email ? (
            <Button asChild variant="outline">
              <a href={`mailto:${contact.email}`}>
                <MailIcon />
                {contact.email}
              </a>
            </Button>
          ) : null}
        </div>
        {contact.address ? (
          <p className="flex items-start gap-2 text-body text-ink-2">
            <MapPinIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="whitespace-pre-wrap">{contact.address}</span>
          </p>
        ) : null}
        {contact.notes ? (
          <p className="text-body whitespace-pre-wrap text-foreground">{contact.notes}</p>
        ) : null}
        {!phone && !contact.email && !contact.address && !contact.notes ? (
          <p className="text-body text-ink-2">{tc("notSpecified")}</p>
        ) : null}
      </div>

      {references.logs + references.purchases + references.haulOuts === 0 ? (
        <p className="text-body text-ink-2">{t("references.none")}</p>
      ) : null}

      {references.logs > 0 ? (
        <SectionCard
          title={`${t("references.logs")} (${references.logs})`}
          actionHref={logsPath(boatId, { contact: contactId })}
          actionLabel={t("references.seeAll")}
        >
          {(logs ?? []).map((log) => (
            <ListRow
              key={log.id ?? ""}
              categoryColor={log.category_color ?? undefined}
              lead={
                <span className="w-20 shrink-0 num text-caption text-ink-2">
                  {formatDate(log.performed_at)}
                </span>
              }
              title={log.title ?? ""}
              trailing={
                log.cost !== null ? (
                  <span className="num text-caption text-ink-2">{formatCurrency(log.cost)}</span>
                ) : null
              }
              href={log.id ? logPath(boatId, log.id) : logsPath(boatId)}
            />
          ))}
        </SectionCard>
      ) : null}

      {references.purchases > 0 ? (
        <SectionCard
          title={`${t("references.purchases")} (${references.purchases})`}
          actionHref={suppliesPath(boatId)}
          actionLabel={t("references.seeAll")}
        >
          {(purchases ?? []).map((purchase) => (
            <ListRow
              key={purchase.id}
              lead={
                <span className="w-20 shrink-0 num text-caption text-ink-2">
                  {formatDate(purchase.purchased_at)}
                </span>
              }
              title={purchase.designation}
              trailing={
                purchase.amount !== null ? (
                  <span className="num text-caption text-ink-2">
                    {formatCurrency(purchase.amount)}
                  </span>
                ) : null
              }
            />
          ))}
        </SectionCard>
      ) : null}

      {references.haulOuts > 0 ? (
        <p className="text-body text-ink-2">
          {t("references.haulOutsCount", { count: references.haulOuts })}
        </p>
      ) : null}
      <AuditFooter
        createdByName={names.get(contact.created_by ?? "")}
        createdAt={contact.created_at}
        updatedByName={names.get(contact.updated_by ?? "")}
        updatedAt={contact.updated_at}
      />
    </div>
  );
}
