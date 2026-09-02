import { notFound } from "next/navigation";

import { CategoryItems, type CompletionRow } from "@/components/checklist/CategoryItems";
import { toChecklistRow } from "@/components/checklist/rows";
import { can, type BoatRole } from "@/lib/permissions";
import { completionContext } from "@/lib/queries/completion-context";
import { createClient } from "@/lib/supabase/server";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ boatId: string; categoryId: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ boatId, categoryId }, { filter }] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const [
    { data: role },
    { data: category },
    { data: status },
    { data: disabled },
    { data: progress },
    { data: engines },
    context,
  ] = await Promise.all([
    supabase.rpc("boat_role", { p_boat_id: boatId }),
    supabase
      .from("boat_categories")
      .select("id, name, color, icon, is_active")
      .eq("id", categoryId)
      .eq("boat_id", boatId)
      .maybeSingle(),
    supabase
      .from("checklist_item_status")
      .select("*")
      .eq("boat_id", boatId)
      .eq("category_id", categoryId)
      .order("sort_order"),
    supabase
      .from("checklist_items")
      .select("id, label")
      .eq("boat_id", boatId)
      .eq("category_id", categoryId)
      .eq("is_active", false)
      .order("sort_order"),
    supabase
      .from("checklist_category_progress")
      .select("progress")
      .eq("category_id", categoryId)
      .maybeSingle(),
    supabase.from("engines").select("id, label").eq("boat_id", boatId),
    completionContext(supabase, boatId),
  ]);
  if (!role || !category) notFound();
  const boatRole = role as BoatRole;

  const engineLabels = new Map((engines ?? []).map((engine) => [engine.id, engine.label]));
  const rows = (status ?? []).map((row) =>
    toChecklistRow(
      row,
      { name: category.name, color: category.color },
      row.engine_id ? (engineLabels.get(row.engine_id) ?? null) : null,
    ),
  );

  const itemIds = rows.map((row) => row.id);
  const { data: completions } = itemIds.length
    ? await supabase
        .from("checklist_completions")
        .select(
          "id, checklist_item_id, completed_at, completed_by_name, engine_hours, next_due_at, note, created_by, created_at, profiles!checklist_completions_completed_by_fkey(full_name, email)",
        )
        .in("checklist_item_id", itemIds)
        .order("completed_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(500)
    : { data: [] };
  const completionRows: CompletionRow[] = (completions ?? []).map((completion) => ({
    id: completion.id,
    itemId: completion.checklist_item_id,
    completedAt: completion.completed_at,
    completedByName:
      completion.completed_by_name ??
      completion.profiles?.full_name ??
      completion.profiles?.email ??
      null,
    engineHours: completion.engine_hours,
    nextDueAt: completion.next_due_at,
    note: completion.note,
    createdBy: completion.created_by,
    createdAt: completion.created_at,
  }));

  return (
    <CategoryItems
      boatId={boatId}
      category={{
        id: category.id,
        name: category.name,
        color: category.color,
        icon: category.icon,
      }}
      rows={rows}
      completions={completionRows}
      disabledItems={(disabled ?? []).map((item) => ({ id: item.id, label: item.label }))}
      progress={progress?.progress ?? null}
      members={context.members}
      currentUserId={context.currentUserId}
      currentUserName={context.currentUserName}
      canWrite={can(boatRole, "write")}
      canContribute={can(boatRole, "contribute")}
      filter={filter === "todo" ? "todo" : "all"}
    />
  );
}
