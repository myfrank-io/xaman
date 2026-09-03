"use server";

import { revalidatePath } from "next/cache";

import { dbErrorKey, fail, ok, type ActionResult } from "@/lib/actions/result";
import {
  cellDate,
  cellNumber,
  cellText,
  cellPurchaseKind,
  descriptorOf,
  IMPORT_MAX_ROWS,
  isImportEntity,
  rejectionReason,
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

  const [{ data: existing }, { data: categories }, { data: contacts }] = await Promise.all([
    query as unknown as Promise<{ data: Record<string, unknown>[] | null }>,
    supabase.from("boat_categories").select("id, name").eq("boat_id", boatId).eq("is_active", true),
    descriptor.matchesContacts
      ? supabase.from("contacts").select("id, name").eq("boat_id", boatId)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
  ]);

  const byKey = new Map(
    (existing ?? []).map((row) => [descriptor.existingKey(row), String(row.id)]),
  );
  const categoryByName = new Map(
    (categories ?? []).map((category) => [normaliseHeader(category.name), category.id]),
  );
  const contactByName = new Map(
    (contacts ?? []).map((contact) => [normaliseHeader(contact.name), contact.id]),
  );

  const rejected: RejectedRow[] = [];
  // Two batches, never one: a new row carries created_by and an update must not overwrite it,
  // and PostgREST turns a key missing from one object of a bulk insert into a NULL.
  const creations: Record<string, unknown>[] = [];
  const updates: Record<string, unknown>[] = [];

  rows.forEach((row, index) => {
    const line = index + 1;
    // One validator for the preview and for the write: what the screen announced is written.
    const reason = rejectionReason(entity, row);
    if (reason) {
      rejected.push({ line, reason, values: row });
      return;
    }
    const name = cellText(row.name, 120) ?? "";
    const key = descriptor.naturalKey({ ...row, name });
    const known = byKey.get(key);
    // A generated id keeps the write idempotent and every object of the batch identical.
    const id = known ?? crypto.randomUUID();
    const target = known ? updates : creations;
    const category = categoryByName.get(normaliseHeader(row.category ?? "")) ?? null;
    // Each table names its subject differently: `name`, `title`, `designation`.
    const base = {
      id,
      boat_id: boatId,
      notes: cellText(row.notes, 2000),
      updated_by: userId,
      ...(known ? {} : { created_by: userId }),
      ...(descriptor.needsReview ? { needs_review: true } : {}),
    };

    if (entity === "contacts") {
      target.push({
        ...base,
        name,
        specialty: cellText(row.specialty, 60),
        company: cellText(row.company, 120),
        phone: cellText(row.phone, 40),
        email: cellText(row.email, 160),
        address: cellText(row.address, 300),
      });
    } else if (entity === "equipment") {
      const quantity = cellNumber(row.quantity);
      target.push({
        ...base,
        name,
        category_id: category,
        brand: cellText(row.brand, 80),
        model: cellText(row.model, 80),
        serial: cellText(row.serial, 80),
        quantity: quantity === null ? 1 : Math.max(0, Math.round(quantity)),
        installed_at: cellDate(row.installedAt),
      });
    } else if (entity === "parts") {
      const quantity = cellNumber(row.quantity);
      const minQuantity = cellNumber(row.minQuantity);
      target.push({
        ...base,
        name,
        reference: cellText(row.reference, 80),
        quantity: quantity === null ? 0 : Math.max(0, quantity),
        min_quantity: minQuantity === null ? 0 : Math.max(0, minQuantity),
        unit: cellText(row.unit, 12) ?? "pc",
        location: cellText(row.location, 80),
        category_id: category,
      });
    } else if (entity === "logs") {
      // A provider that matches a contact of the boat is linked; one that matches nothing is
      // copied into the notes rather than dropped, and the line is « à vérifier » anyway.
      const provider = cellText(row.provider, 120);
      const contactId = provider ? (contactByName.get(normaliseHeader(provider)) ?? null) : null;
      const unmatched = provider && !contactId ? `Prestataire : ${provider}` : null;
      target.push({
        ...base,
        title: name,
        notes: [base.notes, unmatched].filter(Boolean).join("\n") || null,
        performed_at: cellDate(row.date),
        next_due_at: cellDate(row.nextDate),
        category_id: category,
        contact_id: contactId,
        cost: cellNumber(row.cost),
        external_ref: cellText(row.reference, 120),
        status: "done",
      });
    } else {
      const quantity = cellNumber(row.quantity);
      const supplier = cellText(row.supplier, 120);
      target.push({
        ...base,
        designation: name,
        purchased_at: cellDate(row.date),
        amount: cellNumber(row.amount),
        kind: cellPurchaseKind(row.kind),
        quantity: quantity === null || quantity <= 0 ? 1 : quantity,
        supplier_name: supplier,
        supplier_contact_id: supplier
          ? (contactByName.get(normaliseHeader(supplier)) ?? null)
          : null,
        category_id: category,
        external_ref: cellText(row.reference, 120),
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

  revalidatePath(boatPath(boatId, LANDS_ON[entity]));
  revalidatePath(boatPath(boatId, "dashboard"));
  return ok({ created: creations.length, updated: updates.length, rejected });
}
