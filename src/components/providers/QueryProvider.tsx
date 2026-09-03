"use client";

import { useState } from "react";
import { defaultShouldDehydrateQuery, QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider, type Persister } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { del, get, set } from "idb-keyval";

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;

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
    key: "xaman-query-cache",
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
