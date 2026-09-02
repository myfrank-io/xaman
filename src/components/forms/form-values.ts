// Bridges between database values and what a text field holds (rule 13: numbers are typed
// as text with a numeric keyboard, and a French comma).
export function numberToInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(".", ",");
}

export function textToInput(value: string | null | undefined): string {
  return value ?? "";
}
