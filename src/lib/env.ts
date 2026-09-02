// Public environment variables. They are inlined by Next.js at build time, which only works when
// each variable is referenced literally as `process.env.NEXT_PUBLIC_…` (never dynamically).
// Server-only secrets (SUPABASE_SERVICE_ROLE_KEY) are read where they are used, never exported here.
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;

export function hasSupabaseEnv(): boolean {
  return publicEnv.supabaseUrl !== "" && publicEnv.supabaseAnonKey !== "";
}

export function assertSupabaseEnv(): void {
  if (!hasSupabaseEnv()) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example).",
    );
  }
}
