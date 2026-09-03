import { redirect } from "next/navigation";

/**
 * The app is private (SPEC §2): there is nothing to show a visitor who is not signed in, so
 * the root sends them to the sign-in screen. A signed-in visitor never reaches this page —
 * `src/proxy.ts` sends them to `/boats` first.
 */
export default function HomePage() {
  redirect("/login");
}
