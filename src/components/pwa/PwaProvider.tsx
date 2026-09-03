"use client";

import { SerwistProvider } from "@serwist/next/react";

// Registers /sw.js in production only; the dev server never runs a service worker.
export function PwaProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      // `SerwistProvider` registers as an ES module by default, but `serwist build` bundles
      // public/sw.js as a classic script (no import/export, and Serwist's own code can call
      // `self.importScripts()`, which a module worker forbids). Declaring what the file really is
      // keeps the registration valid on the older Safari versions still on the pontoon.
      options={{ type: "classic" }}
      disable={process.env.NODE_ENV !== "production"}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
