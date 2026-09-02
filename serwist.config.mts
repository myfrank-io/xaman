import { serwist } from "@serwist/next/config";

// Serwist « configurator » mode (Turbopack-compatible): `serwist build` runs after `next build`
// and writes public/sw.js from src/app/sw.ts with the precache manifest of the app shell.
export default serwist({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  // Precached pages are served from cache on navigation; dynamic app pages are fetched at runtime.
  precachePrerendered: true,
  globIgnores: ["**/node_modules/**"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});
