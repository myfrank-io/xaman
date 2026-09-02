import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Id of the signed-in user, from the verified JWT claims (no network round-trip).
export async function currentUserId(supabase: SupabaseClient<Database>): Promise<string | null> {
  const { data } = await supabase.auth.getClaims();
  const sub = data?.claims?.sub;
  return typeof sub === "string" ? sub : null;
}
