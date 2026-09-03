"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, type ActionResult } from "@/lib/actions/result";
import { loadImportCatalog } from "@/lib/import/catalog";
import {
  buildDatabaseRow,
  cellText,
  createMatcher,
  descriptorOf,
  IMPORT_MAX_ROWS,
  IMPORT_NAME_MAX,
  isImportEntity,
  rejectionReason,
  rememberRow,
  type ImportReport,
  type ImportRow,
  type RejectedRow,
} from "@/lib/import/entities";
import { normaliseHeader } from "@/lib/import/mapping";
import { boatPath } from "@/lib/queries/boat-routes";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

/**
 * Writes mapped rows (E12-1). Valid lines go in even when others are refused: a real
 * spreadsheet always has three broken lines, and rejecting the whole file for them is a wall.
 * Recognised lines are updated rather than duplicated (D: natural key), so re-importing a
 * corrected sheet corrects it.
 */
/** The screen each list belongs to, refreshed once the write lands. */
const LANDS_ON = {
  logs: "logs",
  purchases: "supplies",
  contacts: "contacts",
  equipment: "boat",
  parts: "supplies",
  completions: "checklist",
  readings: "boat",
} as const;

export async function importRows(input: {
  boatId: string;
  entity: string;
  rows: ImportRow[];
}): Promise<ActionResult<ImportReport>> {
  const { boatId, entity, rows } = input ?? {};
  if (typeof boatId !== "string" || !isImportEntity(entity) || !Array.isArray(rows)) {
    return fail("errors.invalid");
  }
  if (rows.length === 0) return fail("import.errors.empty");
  if (rows.length > IMPORT_MAX_ROWS) return fail("import.errors.tooMany");

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const descriptor = descriptorOf(entity);

  // Roles are enforced by RLS on the write below; this only fails early with a clear message.
  const { data: role } = await supabase.rpc("boat_role", { p_boat_id: boatId });
  if (role !== "owner" && role !== "editor") return fail("errors.forbidden");

  // The union of tables defeats the generated row types; the descriptor states its own columns.
  let query = supabase.from(descriptor.table).select(descriptor.keyColumns).eq("boat_id", boatId);
  // A line put in the trash on purpose is not « already there »: re-importing makes a new row
  // rather than quietly reviving what someone chose to remove.
  if (descriptor.softDeleted) query = query.is("deleted_at", null);

  const [{ data: existing }, { data: categories }, { data: contacts }, catalog] = await Promise.all(
    [
      query as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
      supabase
        .from("boat_categories")
        .select("id, name")
        .eq("boat_id", boatId)
        .eq("is_active", true),
      descriptor.matchesContacts
        ? supabase.from("contacts").select("id, name").eq("boat_id", boatId)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
      // The checklist points and the engines a line may name (E12-4).
      loadImportCatalog(supabase, boatId, descriptor),
    ],
  );

  // An empty key means « never match this row » (a reading owned by an intervention): it must
  // not become an entry that some other line could land on.
  const byKey = new Map(
    (existing ?? [])
      .map((row) => [descriptor.existingKey(row), String(row.id)] as const)
      .filter(([key]) => key !== ""),
  );
  const categoryByName = new Map(
    (categories ?? []).map((category) => [normaliseHeader(category.name), category.id]),
  );
  const contactByName = new Map(
    (contacts ?? []).map((contact) => [normaliseHeader(contact.name), contact.id]),
  );
  // Stateful on purpose: an accepted reading joins the boat's own, so a sheet that contradicts
  // itself further down is caught against its own earlier lines.
  const match = createMatcher(catalog);

  const rejected: RejectedRow[] = [];
  // Two batches, never one: a new row carries created_by and an update must not overwrite it,
  // and PostgREST turns a key missing from one object of a bulk insert into a NULL.
  const creations: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const line = index + 1;
    // One validator for the preview and for the write: what the screen announced is written.
    const reason = rejectionReason(entity, row, match);
    if (reason) {
      rejected.push({ line, reason, values: row });
      return;
    }
    rememberRow(entity, row, match);
    const name = cellText(row.name, IMPORT_NAME_MAX) ?? "";
    const key = descriptor.naturalKey({ ...row, name }, match);
    const known = byKey.get(key);
    // A generated id keeps the write idempotent and every object of the batch identical.
    const id = known ?? crypto.randomUUID();
    (known ? updates : creations).push(
      buildDatabaseRow(entity, row, {
        id,
        boatId,
        userId,
        isNew: !known,
        categoryId: categoryByName.get(normaliseHeader(row.category ?? "")) ?? null,
        contactId: (provider: string) => contactByName.get(normaliseHeader(provider)) ?? null,
        match,
      }),
    );

    // Two lines of the file naming the same thing: the second updates the first, never a
    // duplicate — and the id is now known.
    byKey.set(key, id);
  });

  // One statement per batch: 300 lines must not be 300 round trips.
  for (const batch of [creations, updates]) {
    if (batch.length === 0) continue;
    const { error } = await supabase
      .from(descriptor.table)
      .upsert(batch as never, { onConflict: "id" });
    if (error) return fail(dbErrorKey(error));
  }

  // "layout": what lands on a screen shows on the screens below it too — a completion changes
  // the checklist grid and every category page under it.
  revalidatePath(boatPath(boatId, LANDS_ON[entity]), "layout");
  revalidatePath(boatPath(boatId, "dashboard"));
  return ok({ created: creations.length, updated: updates.length, rejected });
}
