"use client";

import { useEffect, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { del } from "idb-keyval";

/** Where the persisted read cache used to live in IndexedDB. Also what sign-out has to remove. */
export const QUERY_CACHE_KEY = "xaman-query-cache";

/** Fired by the sign-out control; the provider hears it and empties the client it owns. */
const SIGN_OUT_EVENT = "xaman:sign-out";

/**
 * Asks this device to forget what it read, on the way out. Callable from anywhere — including a
 * screen rendered outside the provider, where it simply clears the stored copy.
 */
export async function signOutQueryCache(): Promise<void> {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SIGN_OUT_EVENT));
    // Le service worker garde une copie des écrans du bateau pour les lire hors ligne
    // (`src/app/sw.ts`) : sur un iPad partagé elle part avec la personne qui s'en va.
    navigator.serviceWorker?.controller?.postMessage({ type: SIGN_OUT_EVENT });
  }
  await clearPersistedQueryCache();
}

/**
 * Drops the persisted cache from this device (E9-1, D102, rule 2 in spirit).
 *
 * The iPad is shared: Xav signs out, Emmanuel signs in, and a dehydrated cache of the previous
 * member's boat is still sitting in IndexedDB waiting to be rehydrated — every list they were
 * entitled to read, and Emmanuel may not be. Clearing the in-memory client is not enough,
 * because a persisted copy is what a reload would restore from.
 *
 * The app no longer WRITES that copy (see below), but an iPad installed before this change is
 * still holding one: the deletion stays, and it is what empties those. Called on the way out
 * (`AccountMenu`); a signed-in user's cache is untouched.
 */
export async function clearPersistedQueryCache(): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  try {
    await del(QUERY_CACHE_KEY);
  } catch {
    // a browser refusing IndexedDB has nothing stored to remove either
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Serve what is already in memory rather than fail outright when the iPad drops the
        // network: a query that has an answer keeps showing it (read-only mode, E9-1).
        networkMode: "offlineFirst",
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: "online",
      },
    },
  });
}

/**
 * TanStack Query, sans persistance.
 *
 * L'app avait un cache dehydraté dans IndexedDB (une semaine de `gcTime`, trois dépendances
 * `@tanstack/*-persist` + `idb-keyval`) et **rien à y mettre** : toutes les lectures d'écran
 * sont faites sur le serveur, il ne reste qu'un seul `useQuery` dans tout le code — celui des
 * pièces jointes — et `shouldDehydrateQuery` l'excluait nommément, parce que ses URL signées ne
 * doivent pas survivre à la session. Le persister sérialisait donc un cache vide toutes les
 * secondes, restaurait un cache vide au démarrage, et faisait payer sa taille à chaque bundle.
 *
 * Ce qui rend l'app lisible hors ligne, c'est le service worker (`src/app/sw.ts`), pas ceci.
 *
 * Le jour où une liste passera en `useQuery` — la seule façon d'en tirer quelque chose serait
 * de déplacer les listes lues côté serveur (journal, checklist, dépenses) vers des hooks
 * `src/lib/queries/use-*.ts`, avec `initialData` venue du rendu serveur —, remettre le
 * `PersistQueryClientProvider` sera un import et six lignes. Tant qu'il n'y en a pas, c'est du
 * poids mort (règle 10).
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);

  // Someone signed out on this device: the answers they were entitled to read leave with them.
  useEffect(() => {
    const forget = () => queryClient.clear();
    window.addEventListener(SIGN_OUT_EVENT, forget);
    return () => window.removeEventListener(SIGN_OUT_EVENT, forget);
  }, [queryClient]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
