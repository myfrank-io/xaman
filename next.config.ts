import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
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
