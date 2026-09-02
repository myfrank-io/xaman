import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { assertSupabaseEnv, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Service-role client. Bypasses RLS: use it ONLY in the Server Actions that strictly need it
// (reading an invitation token to send the e-mail) and never anywhere reachable by the browser.
export function createAdminClient() {
  assertSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set (server-only, see .env.example).");
  }

  return createSupabaseClient<Database>(publicEnv.supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
