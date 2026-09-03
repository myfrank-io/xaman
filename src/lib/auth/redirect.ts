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
export function appOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return publicEnv.appUrl;
}

/** `…/auth/callback?next=<where the person was going>`. */
export function callbackUrl(next: string): string {
  return `${appOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}
