import { notFound } from "next/navigation";

import type { LogStatus } from "@/components/common/StatusBadge";
import { EquipmentSheet, type EquipmentLogRow } from "@/components/equipment/EquipmentSheet";
import { can, type BoatRole } from "@/lib/permissions";
import { AuditFooter } from "@/components/common/AuditFooter";
import { auditNames } from "@/lib/queries/audit-names";
import { createClient } from "@/lib/supabase/server";

function specsToList(specs: unknown): { key: string; value: string }[] {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return [];
  return Object.entries(specs as Record<string, unknown>).map(([key, value]) => ({
    key,
    value: value === null || value === undefined ? "" : String(value),
  }));
}

export default async function EquipmentPage({
  params,
}: {
  params: Promise<{ boatId: string; equipmentId: string }>;
}) {
  const { boatId, equipmentId } = await params;
  const supabase = await createClient();
  const [{ data: item }, { data: role }, { data: logs }] = await Promise.all([
    supabase
      .from("equipment")
      .select("*, boat_categories(id, name, color)")
      .eq("id", equipmentId)
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("maintenance_logs_view")
      .select("id, title, performed_at, status, cost, contact_name")
      .eq("equipment_id", equipmentId)
      .order("performed_at", { ascending: false })
      .limit(50),
  ]);
  if (!item || !role) notFound();
  const boatRole = role as BoatRole;

  const logRows: EquipmentLogRow[] = (logs ?? []).map((log) => ({
    id: log.id ?? "",
    title: log.title ?? "",
    performedAt: log.performed_at ?? "",
    status: (log.status ?? "done") as LogStatus,
    cost: log.cost,
    contactName: log.contact_name,
  }));

  const names = await auditNames(supabase, [item.created_by, item.updated_by]);

  return (
    <div className="flex flex-col gap-6">
      <EquipmentSheet
        boatId={boatId}
        item={{
          id: item.id,
          name: item.name,
          brand: item.brand,
          model: item.model,
          serial: item.serial,
          quantity: item.quantity,
          installedAt: item.installed_at,
          removedAt: item.removed_at,
          notes: item.notes,
          specs: specsToList(item.specs),
          category: item.boat_categories
            ? {
                id: item.boat_categories.id,
                name: item.boat_categories.name,
                color: item.boat_categories.color,
              }
            : null,
        }}
        logs={logRows}
        canWrite={can(boatRole, "write")}
        canContribute={can(boatRole, "contribute")}
      />
      <AuditFooter
        createdByName={names.get(item.created_by ?? "")}
        createdAt={item.created_at}
        updatedByName={names.get(item.updated_by ?? "")}
        updatedAt={item.updated_at}
      />
    </div>
  );
}
