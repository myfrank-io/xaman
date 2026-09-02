"use client";

import { createContext, useContext } from "react";

import { can, type BoatRole, type Permission } from "@/lib/permissions";
import type { Database } from "@/types/database";

export type Boat = Database["public"]["Tables"]["boats"]["Row"];

type BoatContextValue = {
  boat: Boat;
  role: BoatRole;
  can: (permission: Permission) => boolean;
};

const BoatContext = createContext<BoatContextValue | null>(null);

export function BoatProvider({
  boat,
  role,
  children,
}: {
  boat: Boat;
  role: BoatRole;
  children: React.ReactNode;
}) {
  return (
    <BoatContext.Provider value={{ boat, role, can: (p) => can(role, p) }}>
      {children}
    </BoatContext.Provider>
  );
}

// Current boat + the signed-in user's role, provided by app/(app)/boats/[boatId]/layout.tsx.
export function useBoat(): BoatContextValue {
  const ctx = useContext(BoatContext);
  if (!ctx) throw new Error("useBoat() must be used inside a boat layout");
  return ctx;
}
