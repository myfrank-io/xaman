import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  /**
   * /dev/ui/emails reads the committed Supabase Auth templates at request time. They live
   * outside src/, so nothing traces them into the serverless bundle on its own and the page
   * would answer ENOENT on a Vercel preview — the one place the gallery is meant to be used.
   */
  outputFileTracingIncludes: {
    "/dev/ui/emails": ["./supabase/templates/*.html"],
  },
  env: {
    /**
     * The commit this bundle was built from, shown in the install dialog.
     *
     * « C'est toujours le même texte » is unanswerable without it: neither of us can tell a
     * deploy that has not landed from a change that did not work, and we each guessed wrong
     * once today. Vercel sets `VERCEL_GIT_COMMIT_SHA`; locally it reads « dev ».
     */
    NEXT_PUBLIC_BUILD: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
  },
};

const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
