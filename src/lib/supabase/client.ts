import { createBrowserClient } from "@supabase/ssr";

import { assertSupabaseEnv, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Browser client (Client Components, TanStack Query hooks). One instance per page is cached by @supabase/ssr.
export function createClient() {
  assertSupabaseEnv();
  return createBrowserClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey);
}
