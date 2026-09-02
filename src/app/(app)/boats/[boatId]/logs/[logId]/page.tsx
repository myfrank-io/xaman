import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ChevronLeftIcon, PhoneIcon, TriangleAlertIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CategoryBadge } from "@/components/common/CategoryBadge";
import { ListRow } from "@/components/common/ListRow";
import { PageHeader } from "@/components/common/PageHeader";
import { SectionCard } from "@/components/common/SectionCard";
import { StatusBadge, type LogStatus } from "@/components/common/StatusBadge";
import { LogActions } from "@/components/logs/LogActions";
import { parseEngineHours } from "@/components/logs/rows";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, formatHours } from "@/lib/format";
import { can, type BoatRole } from "@/lib/permissions";
import { boatPath, categoryPath, logsReviewPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";

/** One labelled fact of the intervention. */
function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-overline text-ink-2 uppercase">{label}</span>
      <span className="text-body text-foreground">{children}</span>
    </div>
  );
}

/**
 * Detail of an intervention (E3-4): every field, the readings it carries, the checklist points
 * it ticked, the purchases attached to it, and the footer « créé par … » (E10-4).
 */
export default async function LogPage({
  params,
}: {
  params: Promise<{ boatId: string; logId: string }>;
}) {
  const { boatId, logId } = await params;
  const supabase = await createClient();
  const [{ data: role }, { data: log }, { data: auth }] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("maintenance_logs_view")
      .select("*")
      .eq("id", logId)
      .eq("boat_id", boatId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  if (!role || !log?.id) notFound();
  const boatRole = role as BoatRole;

  const [
    { data: completions },
    { data: purchases },
    { data: haulOut },
    { data: contact },
    { data: updatedBy },
  ] = await Promise.all([
    supabase
      .from("checklist_completions")
      .select("id, completed_at, engine_hours, checklist_items(id, label, category_id)")
      .eq("maintenance_log_id", logId),
    supabase
      .from("purchases")
      .select("id, designation, amount")
      .eq("maintenance_log_id", logId)
      .is("deleted_at", null),
    log.haul_out_id
      ? supabase
          .from("haul_outs")
          .select("id, started_at, yard_name")
          .eq("id", log.haul_out_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    log.contact_id
      ? supabase.from("contacts").select("id, name, phone").eq("id", log.contact_id).maybeSingle()
      : Promise.resolve({ data: null }),
    log.updated_by
      ? supabase.from("profiles").select("full_name, email").eq("id", log.updated_by).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const [t, tl, tc] = await Promise.all([
    getTranslations("logs.detail"),
    getTranslations("logs"),
    getTranslations("common"),
  ]);
  const { data: categories } = await supabase
    .from("boat_categories")
    .select("id, name, color, icon")
    .eq("boat_id", boatId);

  const engineHours = parseEngineHours(log.engine_hours);
  const canWrite = can(boatRole, "write");
  const mine = log.created_by === auth.user?.id;
  const canEdit = canWrite || (boatRole === "pro" && mine);
  const purchaseTotal = (purchases ?? []).reduce((sum, row) => sum + (row.amount ?? 0), 0);
  const phone = contact?.phone?.replace(/\s/g, "") ?? null;
  const updatedName = updatedBy?.full_name ?? updatedBy?.email ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2">
          <Link href={boatPath(boatId, "logs") as Route}>
            <ChevronLeftIcon />
            {tl("title")}
          </Link>
        </Button>
        <PageHeader
          className="mt-2"
          title={log.title ?? ""}
          subtitle={formatDate(log.performed_at)}
          actions={
            canEdit ? (
              <LogActions
                boatId={boatId}
                canWrite={canWrite}
                log={{
                  id: log.id,
                  title: log.title ?? "",
                  categoryId: log.category_id,
                  contactId: log.contact_id,
                  equipmentId: log.equipment_id,
                  engineHours,
                }}
              />
            ) : undefined
          }
        />
      </div>

      {log.needs_review ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>{t("reviewBanner")}</span>
            {canWrite ? (
              <Button asChild size="sm" variant="outline">
                <Link href={logsReviewPath(boatId, { log: log.id }) as Route}>
                  {t("reviewAction")}
                </Link>
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 rounded-xl border border-border bg-surface p-5 shadow-sm sm:grid-cols-2 lg:grid-cols-3">
        <Fact label={t("fields.status")}>
          <StatusBadge status={(log.status ?? "done") as LogStatus} />
        </Fact>
        <Fact label={t("fields.category")}>
          {log.category_name && log.category_color ? (
            <CategoryBadge
              name={log.category_name}
              color={log.category_color}
              icon={categories?.find((row) => row.id === log.category_id)?.icon}
              withIcon
              archived={log.category_is_active === false}
            />
          ) : (
            tc("none")
          )}
        </Fact>
        <Fact label={t("fields.cost")}>
          <span className="num">{log.cost === null ? tc("none") : formatCurrency(log.cost)}</span>
        </Fact>
        <Fact label={t("fields.by")}>
          {contact ? (
            <span className="flex flex-wrap items-center gap-2">
              {contact.name}
              {phone ? (
                <Button asChild size="sm" variant="outline">
                  <a href={`tel:${phone}`}>
                    <PhoneIcon />
                    {contact.phone}
                  </a>
                </Button>
              ) : null}
            </span>
          ) : (
            tl("byCrew")
          )}
        </Fact>
        {log.equipment_name ? (
          <Fact label={t("fields.equipment")}>{log.equipment_name}</Fact>
        ) : null}
        {haulOut ? (
          <Fact label={t("fields.haulOut")}>
            <Link
              href={boatPath(boatId, "haulOuts") as Route}
              className="text-primary underline-offset-4 hover:underline"
            >
              {[formatDate(haulOut.started_at), haulOut.yard_name].filter(Boolean).join(" · ")}
            </Link>
          </Fact>
        ) : null}
      </div>

      {log.notes ? (
        <SectionCard title={t("fields.notes")} bare>
          <p className="text-body whitespace-pre-wrap text-foreground">{log.notes}</p>
        </SectionCard>
      ) : null}

      {engineHours.length > 0 ? (
        <SectionCard title={t("sections.hours")}>
          {engineHours.map((entry) => (
            <ListRow
              key={entry.engineId}
              title={entry.label}
              trailing={
                <span className="num text-body font-medium">{formatHours(entry.hours)}</span>
              }
            />
          ))}
        </SectionCard>
      ) : null}

      <SectionCard title={t("sections.completions")} bare={(completions ?? []).length === 0}>
        {(completions ?? []).length === 0 ? (
          <p className="text-body text-ink-2">{t("noCompletions")}</p>
        ) : (
          (completions ?? []).map((completion) => {
            const item = completion.checklist_items;
            const category = categories?.find((row) => row.id === item?.category_id);
            return (
              <ListRow
                key={completion.id}
                categoryColor={category?.color}
                title={item?.label ?? ""}
                meta={category ? <span className="truncate">{category.name}</span> : null}
                trailing={
                  completion.engine_hours !== null ? (
                    <span className="num text-caption text-ink-2">
                      {formatHours(completion.engine_hours)}
                    </span>
                  ) : null
                }
                href={item?.category_id ? categoryPath(boatId, item.category_id) : undefined}
              />
            );
          })
        )}
      </SectionCard>

      {(purchases ?? []).length > 0 ? (
        <SectionCard
          title={t("sections.purchases")}
          footer={t("purchasesNote", {
            count: (purchases ?? []).length,
            amount: formatCurrency(purchaseTotal),
          })}
        >
          {(purchases ?? []).map((purchase) => (
            <ListRow
              key={purchase.id}
              title={purchase.designation}
              trailing={
                <span className="num text-caption text-ink-2">
                  {formatCurrency(purchase.amount)}
                </span>
              }
            />
          ))}
        </SectionCard>
      ) : null}

      <p className="text-caption text-ink-3">
        {updatedName && log.updated_at !== log.created_at
          ? t("footer", {
              createdBy: log.created_by_name ?? t("unknownAuthor"),
              createdAt: formatDate(log.created_at),
              updatedBy: updatedName,
              updatedAt: formatDate(log.updated_at),
            })
          : t("footerCreated", {
              createdBy: log.created_by_name ?? t("unknownAuthor"),
              createdAt: formatDate(log.created_at),
            })}
      </p>
    </div>
  );
}
