import { NextResponse, type NextRequest } from "next/server";

import { hasSupabaseEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/middleware";

// Paths reachable without a session. Everything else (the (app) group) requires one.
const PUBLIC_PREFIXES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/auth",
  "/invite",
  "/health",
  "/dev",
  // Machines with no session and no cookie jar: the mailer posting what became of an e-mail
  // (D79). Being reachable is not being open — the endpoint's own door is the signature it
  // verifies, and it refuses everything else. Without this line the POST is answered by a 307
  // to /login, which a webhook sender does not follow: six events were lost that way before
  // the logs showed it.
  "/api/webhooks",
];

// Screens a signed-in visitor has no business on: they already have what these ask for.
// `/reset-password` is deliberately absent — it is REACHED with the session the recovery
// link opened, and sending that visitor away would make the link do nothing.
const SIGNED_IN_ELSEWHERE = ["/", "/login", "/signup"];

export function isPublic(pathname: string): boolean {
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

  if (claims && SIGNED_IN_ELSEWHERE.includes(pathname)) {
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
