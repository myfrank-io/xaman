import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

// Service worker (built by `serwist build`, see serwist.config.mts → public/sw.js).
// E0-6: app-shell precache + Serwist's recommended runtime caching for Next.js.
// E9-1 will add the read-only offline behaviour on top (page cache, TanStack Query persistence).

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time with the list of precached assets.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
