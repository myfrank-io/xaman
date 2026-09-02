import type { Database } from "@/types/database";

export type BoatRole = Database["public"]["Enums"]["boat_role"];

// Mirror of the SQL functions (0002_rls.sql). UI convenience only: the database is the authority.
export type Permission =
  | "write" // owner | editor: everything on the boat's data, trash, export
  | "contribute" // + pro: own maintenance logs, completions, readings, attachments
  | "manageMembers" // owner: members, invitations
  | "deleteBoat"; // owner

const ROLE_RANK: Record<BoatRole, number> = {
  owner: 4,
  editor: 3,
  pro: 2,
  viewer: 1,
  renter: 0, // V2, never granted in V1
};

export function can(role: BoatRole | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  switch (permission) {
    case "write":
      return ROLE_RANK[role] >= ROLE_RANK.editor;
    case "contribute":
      return ROLE_RANK[role] >= ROLE_RANK.pro;
    case "manageMembers":
    case "deleteBoat":
      return role === "owner";
  }
}

// Roles an owner can assign from the UI in V1 (never owner directly, never renter).
export const ASSIGNABLE_ROLES: BoatRole[] = ["editor", "pro", "viewer"];
