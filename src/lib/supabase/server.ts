import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { assertSupabaseEnv, publicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

// Server client (Server Components, Server Actions, Route Handlers). Runs with the user's session,
// so RLS applies exactly as in the browser.
export async function createClient() {
  assertSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // Sessions are refreshed by the proxy (src/proxy.ts), so this can be ignored.
        }
      },
    },
  });
}
