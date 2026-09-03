import { serwist } from "@serwist/next/config";

// Serwist « configurator » mode (Turbopack-compatible): `serwist build` runs after `next build`
// and writes public/sw.js from src/app/sw.ts with the precache manifest of the app shell.
//
// `withNextConfig` is used only to read `distDir`: the precache exclusions below are paths in the
// build output, and hardcoding « .next » would let them go stale — silently, since a stale
// exclusion does not fail the build, it fails the service worker install in the browser.
export default serwist.withNextConfig((nextConfig) => ({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Precached pages are served from cache on navigation; dynamic app pages are fetched at runtime.
  precachePrerendered: true,
  globIgnores: [
    "**/node_modules/**",
    // Serwist precaches every prerendered page, and a single one it cannot fetch aborts the WHOLE
    // install: the worker stays « installing » for ever, so nothing is ever cached and every page
    // load starts the 5 MB precache again. Two routes are prerendered but must NOT be precached:
    //
    // - `/dev/ui/**` — the visual mocks. They are prerendered, but `devUiEnabled()` answers 404 to
    //   them in production, which is exactly the failure above (`bad-precaching-response`).
    // - `/` — the public landing page. The proxy redirects a signed-in visitor from `/` to
    //   `/boats`; precaching `/` serves the cached marketing page instead, so the installed app
    //   opens on the landing page rather than on the boat. `start_url` needs that redirect to run.
    `${nextConfig.distDir}/server/app/dev/**`,
    `${nextConfig.distDir}/server/app/index.html`,
  ],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
}));
