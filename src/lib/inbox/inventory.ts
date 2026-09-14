import { descriptorOf } from "@/lib/import/entities";
import type { InventoryLine } from "@/lib/schemas/inbox";

/**
 * An inventory read off a document, handed to the import screen (E2-10).
 *
 * The bridge is a **table**, not a new screen. Importing a list of equipment is already a solved
 * problem in this app — `ImportWizard` maps the columns, says which lines are new and which are
 * recognised, refuses what the write would refuse, and only then writes. A builder's document has
 * no business inventing a second one of those; it only has to arrive in the shape the wizard
 * already reads.
 *
 * So the reading is turned into a tab-separated table whose header row carries the very labels
 * the equipment import declares. `guessMapping` then lands every column by itself, and the person
 * gets the preview they would have had from a spreadsheet.
 */
function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  // Tabs and newlines are the table's own punctuation: a value may hold neither.
  return String(value)
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

/** `surface_m2: 88 ; tissu: Hydranet` — the shape `cellSpecs` reads back. */
export function specsText(specs: InventoryLine["specs"]): string {
  return specs.map((spec) => `${spec.key}: ${spec.value}`).join(" ; ");
}

export function inventoryToTable(
  lines: readonly InventoryLine[],
  categories: readonly { id: string; name: string }[],
): string {
  const fields = descriptorOf("equipment").fields;
  const header = fields.map((field) => field.label);
  const categoryName = new Map(categories.map((category) => [category.id, category.name]));
  const rows = lines.map((line) => {
    const values: Record<string, string> = {
      name: cell(line.name),
      category: cell(line.categoryId ? categoryName.get(line.categoryId) : null),
      brand: cell(line.brand),
      model: cell(line.model),
      serial: cell(line.serial),
      quantity: cell(line.quantity),
      installedAt: cell(line.installedAt),
      specs: cell(specsText(line.specs)),
      notes: "",
    };
    return fields.map((field) => values[field.key] ?? "").join("\t");
  });
  return [header.join("\t"), ...rows].join("\n");
}
