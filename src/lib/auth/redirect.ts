import { publicEnv } from "@/lib/env";

/**
 * Where an authentication e-mail should send the person back to.
 *
 * `NEXT_PUBLIC_APP_URL` is inlined at build time and falls back to localhost when it is not
 * set — which would put `http://localhost:3000` inside a confirmation e-mail sent from
 * production, a link that works on nobody's iPad. Every screen that asks for one of these
 * e-mails runs in the browser, and the browser already knows the address it was served from,
 * so that is what we use; the build-time value is only the fallback for server rendering.
 *
 * Supabase still checks the result against the project's redirect allow-list, so this widens
 * nothing: an origin that is not on the list is refused there, as it should be.
 */
function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return publicEnv.appUrl;
}

/** `…/auth/callback?next=<where the person was going>`. */
export function callbackUrl(next: string): string {
  return `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}

/**
 * The path `?next=` may send someone to, once they are signed in.
 *
 * `startsWith("/")` is not that test. `//evil.com` and `/\evil.com` both start with a slash and
 * both are read by every browser as « another site »: the first is a protocol-relative URL, the
 * second is one too because the URL parser turns a backslash into a slash. Given to
 * `redirect()` they take the person, freshly authenticated, to somebody else's login form.
 *
 * So the value is resolved like a browser resolves it, against an origin that exists nowhere,
 * and kept only when it resolves *inside* that origin. What comes back is `pathname + search`
 * rebuilt by the parser — never the raw string — so nothing exotic survives the round trip.
 * The fragment is dropped: it never reaches the server anyway.
 */
const DUMMY_ORIGIN = "https://xaman.invalid";

export function safeNextPath(next: string | undefined | null, fallback = "/boats"): string {
  if (!next || !next.startsWith("/")) return fallback;
  try {
    const url = new URL(next, DUMMY_ORIGIN);
    if (url.origin !== DUMMY_ORIGIN) return fallback;
    return `${url.pathname}${url.search}`;
  } catch {
    return fallback;
  }
}
