import { defaultCache } from "@serwist/next/worker";
import {
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  type PrecacheEntry,
  type RuntimeCaching,
  type SerwistGlobalConfig,
} from "serwist";

// Service worker (built by `serwist build`, see serwist.config.mts → public/sw.js).
// E0-6: app-shell precache + Serwist's recommended runtime caching for Next.js.
// E9-1 adds the read-only offline behaviour on top (page cache below, outbox in localStorage).

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected at build time with the list of precached assets.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

/** Les écrans du bateau, tels que le service worker les garde. Vidé à la déconnexion. */
const BOAT_PAGES_CACHE = "xaman-boat-pages";

/** Ce que la déconnexion envoie ici (voir `signOutQueryCache`). */
const SIGN_OUT_MESSAGE = "xaman:sign-out";

/**
 * Les écrans d'un bateau, réseau d'abord, avec une limite de patience.
 *
 * Toutes les pages de `(app)` sont `force-dynamic` : rien n'est prérendu, donc le precache de
 * l'app shell ne contient aucune d'elles. `defaultCache` les prend bien au vol (ses entrées
 * `pages-rsc` / `others` sont en NetworkFirst), mais **sans délai** : quand la liaison est
 * mauvaise plutôt qu'absente — un mouillage, une 4G à une barre —, NetworkFirst attend que la
 * requête échoue *vraiment*, ce qui sur iOS se compte en dizaines de secondes. Le tap d'onglet
 * paraît alors mort, alors que la réponse d'hier est là, dans le cache, à côté.
 *
 * Cette route passe devant, ne couvre que `/boats/:id/…`, et rend la copie au bout de cinq
 * secondes. Cinq et non deux : un tableau de bord rendu côté serveur met quelques centaines de
 * millisecondes en temps normal et peut monter à deux ou trois secondes sur une liaison lente ;
 * couper trop tôt, ce serait afficher la version d'hier à quelqu'un qui vient d'enregistrer.
 *
 * Elle a son propre cache pour ne pas se faire évincer par les 32 entrées que `defaultCache`
 * partage entre tout le site, et il est **vidé à la déconnexion** : sur un iPad partagé, la
 * copie d'un écran de Xav ne doit pas pouvoir s'afficher à Emmanuel hors ligne (règle 2, D102).
 */
const boatPages: RuntimeCaching = {
  matcher: ({ url: { pathname }, sameOrigin }) =>
    sameOrigin && pathname.startsWith("/boats/") && !pathname.startsWith("/api/"),
  handler: new NetworkFirst({
    cacheName: BOAT_PAGES_CACHE,
    networkTimeoutSeconds: 5,
    plugins: [new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 24 * 60 * 60 })],
  }),
};

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // L'ordre compte : la première route qui correspond répond.
  runtimeCaching: [boatPages, ...defaultCache],
});

// La déconnexion demande à ce worker d'oublier les écrans qu'il a gardés. `caches.delete` sur
// les seuls caches de pages : le precache de l'app shell ne contient rien de personnel.
self.addEventListener("message", (event) => {
  if ((event.data as { type?: string } | null)?.type !== SIGN_OUT_MESSAGE) return;
  event.waitUntil(
    Promise.all(
      [BOAT_PAGES_CACHE, "pages-rsc-prefetch", "pages-rsc", "pages", "others"].map((name) =>
        caches.delete(name),
      ),
    ),
  );
});

serwist.addEventListeners();
