"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  cellDate,
  cellNumber,
  cellText,
  descriptorOf,
  IMPORT_MAX_ROWS,
  isImportEntity,
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

  const [{ data: existing }, { data: categories }] = await Promise.all([
    supabase.from(descriptor.table).select("id, name").eq("boat_id", boatId),
    supabase.from("boat_categories").select("id, name").eq("boat_id", boatId).eq("is_active", true),
  ]);

  const byKey = new Map((existing ?? []).map((row) => [normaliseHeader(row.name), row.id]));
  const categoryByName = new Map(
    (categories ?? []).map((category) => [normaliseHeader(category.name), category.id]),
  );

  const rejected: RejectedRow[] = [];
  // Two batches, never one: a new row carries created_by and an update must not overwrite it,
  // and PostgREST turns a key missing from one object of a bulk insert into a NULL.
  const creations: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const line = index + 1;
    const name = cellText(row.name, 120);
    if (!name) {
      rejected.push({ line, reason: "import.errors.noName", values: row });
      return;
    }
    const key = descriptor.naturalKey({ ...row, name });
    const known = byKey.get(key);
    // A generated id keeps the write idempotent and every object of the batch identical.
    const id = known ?? crypto.randomUUID();
    const target = known ? updates : creations;
    const base = {
      id,
      boat_id: boatId,
      name,
      notes: cellText(row.notes, 2000),
      updated_by: userId,
      ...(known ? {} : { created_by: userId }),
    };

    if (entity === "contacts") {
      const specialty = cellText(row.specialty, 60);
      if (!specialty) {
        rejected.push({ line, reason: "import.errors.noSpecialty", values: row });
        return;
      }
      const email = cellText(row.email, 160);
      if (email && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email)) {
        rejected.push({ line, reason: "import.errors.badEmail", values: row });
        return;
      }
      target.push({
        ...base,
        specialty,
        company: cellText(row.company, 120),
        phone: cellText(row.phone, 40),
        email,
        address: cellText(row.address, 300),
      });
    } else if (entity === "equipment") {
      const quantity = cellNumber(row.quantity);
      const installedAt = cellDate(row.installedAt);
      if ((row.installedAt ?? "").trim() !== "" && installedAt === null) {
        rejected.push({ line, reason: "import.errors.badDate", values: row });
        return;
      }
      target.push({
        ...base,
        category_id: categoryByName.get(normaliseHeader(row.category ?? "")) ?? null,
        brand: cellText(row.brand, 80),
        model: cellText(row.model, 80),
        serial: cellText(row.serial, 80),
        quantity: quantity === null ? 1 : Math.max(0, Math.round(quantity)),
        installed_at: installedAt,
      });
    } else {
      const quantity = cellNumber(row.quantity);
      const minQuantity = cellNumber(row.minQuantity);
      target.push({
        ...base,
        reference: cellText(row.reference, 80),
        quantity: quantity === null ? 0 : Math.max(0, quantity),
        min_quantity: minQuantity === null ? 0 : Math.max(0, minQuantity),
        unit: cellText(row.unit, 12) ?? "pc",
        location: cellText(row.location, 80),
        category_id: categoryByName.get(normaliseHeader(row.category ?? "")) ?? null,
      });
    }

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

  revalidatePath(
    boatPath(boatId, entity === "contacts" ? "contacts" : entity === "parts" ? "supplies" : "boat"),
  );
  revalidatePath(boatPath(boatId, "dashboard"));
  return ok({ created: creations.length, updated: updates.length, rejected });
}
