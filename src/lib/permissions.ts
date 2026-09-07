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

/**
 * Roles an owner hands out from the UI — at the invitation and on a member already aboard, the
 * same four (D73). `renter` is V2 and is never granted.
 *
 * `owner` is in the list since D73. It was not before: ownership only moved through the guided
 * transfer (D30), while the members list quietly offered it anyway from a plain dropdown — one
 * door documented, one door open. Both are now the same door, and the transfer screen keeps its
 * own value: it invites *and* makes the former owner leave once the invitation is accepted.
 */
export const ASSIGNABLE_ROLES: BoatRole[] = ["owner", "editor", "pro", "viewer"];

/**
 * What an editor may hand out (D28): a professional or a reader, never a peer and never an owner,
 * and always with an end date. The insert policy on `boat_invitations` says the same in SQL —
 * this list only spares the editor a refusal they could not have predicted.
 */
export const EDITOR_ASSIGNABLE_ROLES: BoatRole[] = ["pro", "viewer"];
