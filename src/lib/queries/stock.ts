import type { SupabaseClient } from "@supabase/supabase-js";

import type { StockItem } from "@/components/parts/StockList";
import { isLowStock, sortStock } from "@/lib/parts";
import type { Database } from "@/types/database";

/**
 * The boat's spare-parts stock, enriched with its system and supplier names and sorted for the
 * list (E5-4, D34). One loader read by every screen that shows the stock or the « À racheter »
 * checklist (D63) — the boat's Équipements tab and the checklist screen — so the row shape is
 * built in one place and the two surfaces can never drift apart.
 */
export async function loadStockItems(
  supabase: SupabaseClient<Database>,
  boatId: string,
): Promise<StockItem[]> {
  const [{ data: parts }, { data: categories }, { data: contacts }] = await Promise.all([
    supabase
      .from("parts")
      .select(
        "id, name, reference, quantity, min_quantity, unit, location, category_id, supplier_contact_id, checked_at",
      )
      .eq("boat_id", boatId)
      .is("deleted_at", null)
      .order("name"),
    supabase
      .from("boat_categories")
      .select("id, name, color")
      .eq("boat_id", boatId)
      .eq("is_active", true),
    supabase.from("contacts").select("id, name").eq("boat_id", boatId).is("deleted_at", null),
  ]);

  const categoryById = new Map((categories ?? []).map((category) => [category.id, category]));
  const contactNames = new Map((contacts ?? []).map((contact) => [contact.id, contact.name]));

  return sortStock(
    (parts ?? []).map((row) => {
      const category = row.category_id ? categoryById.get(row.category_id) : undefined;
      return {
        id: row.id,
        name: row.name,
        reference: row.reference,
        quantity: row.quantity,
        minQuantity: row.min_quantity,
        unit: row.unit,
        location: row.location,
        categoryName: category?.name ?? null,
        categoryColor: category?.color ?? null,
        supplierName: row.supplier_contact_id
          ? (contactNames.get(row.supplier_contact_id) ?? null)
          : null,
        checkedAt: row.checked_at,
      } satisfies StockItem;
    }),
  );
}

/** The « À racheter » subset: the low lines, in the same order as the full stock. */
export function toRestockList(parts: StockItem[]): StockItem[] {
  return parts.filter((part) => isLowStock(part));
}
