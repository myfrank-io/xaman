import { NextResponse } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    status: "ok",
    time: new Date().toISOString(),
    supabaseConfigured: hasSupabaseEnv(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
  });
}
