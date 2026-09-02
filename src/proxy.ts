import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

// Paths reachable without a session. Everything else (the (app) group) requires one.
const PUBLIC_PREFIXES = ["/login", "/auth", "/invite", "/health", "/dev"];

function isPublic(pathname: string): boolean {
  if (pathname === "/") return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function proxy(request: NextRequest) {
  // Not configured yet (e.g. a preview without environment variables): serve everything.
  if (!hasSupabaseEnv()) return NextResponse.next();

  const { supabaseResponse, claims } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  if (!claims && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (claims && (pathname === "/login" || pathname === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/boats";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip static files, images and PWA assets.
    "/((?!_next/static|_next/image|icons/|sw\\.js|manifest\\.webmanifest|icon\\.png|apple-icon\\.png|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)",
  ],
};
