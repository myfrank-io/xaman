"use client";

import { SerwistProvider } from "@serwist/next/react";

// Registers /sw.js in production only; the dev server never runs a service worker.
export function PwaProvider({ children }: { children: React.ReactNode }) {
  return (
    <SerwistProvider
      swUrl="/sw.js"
      disable={process.env.NODE_ENV !== "production"}
      reloadOnOnline={false}
    >
      {children}
    </SerwistProvider>
  );
}
