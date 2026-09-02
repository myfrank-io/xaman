import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Display names for created_by / updated_by ids (E10-4); a missing profile reads as unknown.
export async function auditNames(
  supabase: SupabaseClient<Database>,
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (wanted.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", wanted);
  return new Map((data ?? []).map((row) => [row.id, row.full_name ?? row.email ?? ""]));
}
