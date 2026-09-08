"use client";

import { useEffect, useState } from "react";
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;

/** Where the persisted read cache lives in IndexedDB. Also what sign-out has to remove. */
export const QUERY_CACHE_KEY = "xaman-query-cache";

/** Fired by the sign-out control; the provider hears it and empties the client it owns. */
const SIGN_OUT_EVENT = "xaman:sign-out";

/**
 * Asks this device to forget what it read, on the way out. Callable from anywhere — including a
 * screen rendered outside the provider, where it simply clears the stored copy.
 */
export async function signOutQueryCache(): Promise<void> {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(SIGN_OUT_EVENT));
  await clearPersistedQueryCache();
}

/**
 * Drops the persisted cache from this device (E9-1, rule 2 in spirit).
 *
 * The iPad is shared: Xav signs out, Emmanuel signs in, and a week-old dehydrated cache of the
 * previous member's boat is still sitting in IndexedDB waiting to be rehydrated — every list
 * they were entitled to read, and Emmanuel may not be. Clearing the in-memory client is not
 * enough, because the persisted copy is what a reload restores from.
 *
 * Called on the way out (`AccountMenu`); a signed-in user's offline cache is untouched.
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
        gcTime: ONE_WEEK, // must be >= persist maxAge so restored queries are kept
        networkMode: "offlineFirst", // serve the persisted cache when offline (read-only mode, E9-1)
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: "online",
      },
    },
  });
}

const noopPersister: Persister = {
  persistClient: async () => undefined,
  restoreClient: async () => undefined,
  removeClient: async () => undefined,
};

function makePersister(): Persister {
  if (typeof window === "undefined" || typeof indexedDB === "undefined") return noopPersister;
  return createAsyncStoragePersister({
    key: QUERY_CACHE_KEY,
    throttleTime: 1_000,
    storage: {
      getItem: (key) => get<string>(key).then((v) => v ?? null),
      setItem: (key, value) => set(key, value),
      removeItem: (key) => del(key),
    },
  });
}

// TanStack Query with the read cache persisted in IndexedDB: the last data stays readable offline.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(makeQueryClient);
  const [persister] = useState(makePersister);

  // Someone signed out on this device: the answers they were entitled to read leave with them.
  useEffect(() => {
    const forget = () => queryClient.clear();
    window.addEventListener(SIGN_OUT_EVENT, forget);
    return () => window.removeEventListener(SIGN_OUT_EVENT, forget);
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_WEEK,
        buster: "v1",
        dehydrateOptions: {
          // Attachment queries carry private, capability-bearing signed URLs: they expire in ~1h
          // and must never outlive the session nor cross users on a shared iPad. Keep them out of
          // the persisted IndexedDB cache (everything else may still persist for offline reads).
          shouldDehydrateQuery: (query) =>
            defaultShouldDehydrateQuery(query) && !query.queryKey.includes("attachments"),
        },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
