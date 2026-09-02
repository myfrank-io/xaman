"use server";

import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { buildExpensesCsv, EXPENSE_SOURCES, type ExpenseRow } from "@/lib/expenses";
import { isoDate } from "@/lib/schemas/common";
import { createClient } from "@/lib/supabase/server";

const exportExpensesSchema = z.object({
  boatId: z.string().uuid(),
  from: isoDate,
  to: isoDate,
  sources: z.array(z.enum(EXPENSE_SOURCES)).min(1),
});

/**
 * « Exporter en CSV » (E5-5). The action returns the text; the browser turns it into a file —
 * a Server Action cannot stream a download, and building the Blob client-side keeps the
 * whole thing inside one tap. RLS decides what the query returns, as everywhere else.
 */
export async function exportExpensesCsv(
  input: unknown,
): Promise<ActionResult<{ filename: string; csv: string }>> {
  const parsed = parseInput(exportExpensesSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, from, to, sources } = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses_by_category")
    .select("source, entity_id, label, amount, date, category_id, category_name, category_color")
    .eq("boat_id", boatId)
    .gte("date", from)
    .lte("date", to)
    .in("source", sources)
    .order("date", { ascending: false });
  if (error) return fail(dbErrorKey(error));

  const rows: ExpenseRow[] = (data ?? []).map((row) => ({
    source: row.source,
    entityId: row.entity_id,
    label: row.label,
    amount: row.amount,
    date: row.date,
    categoryId: row.category_id,
    categoryName: row.category_name,
    categoryColor: row.category_color,
  }));

  const t = await getTranslations("supplies.expenses");
  const csv = buildExpensesCsv(rows, {
    headers: [t("csv.date"), t("csv.source"), t("csv.label"), t("csv.category"), t("csv.amount")],
    // Singular in a cell, plural on the filter chips: one row is one intervention.
    source: {
      log: t("sourceSingular.log"),
      purchase: t("sourceSingular.purchase"),
      haul_out: t("sourceSingular.haul_out"),
    },
    uncategorized: t("uncategorized"),
  });

  return ok({ filename: t("csv.filename", { from, to }), csv });
}
