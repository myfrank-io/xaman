import { z } from "zod";

export const memberRoleSchema = z.enum(["owner", "editor", "pro", "viewer"]);
// Since D89 a grant may carry any of them, `owner` included; who is allowed to issue which is
// decided by `grant_boat_access` (D151), and mirrored in `inviteMember`.
export const invitableRoleSchema = memberRoleSchema;

// Access duration (D29): 7 / 30 / 90 days or unlimited; an editor may only grant dated access
// (≤ 90 days, enforced by `grant_boat_access` too).
export const accessDurationSchema = z.enum(["7", "30", "90", "unlimited"]);
export type AccessDuration = z.infer<typeof accessDurationSchema>;

export const inviteMemberSchema = z.object({
  boatId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  role: invitableRoleSchema,
  duration: accessDurationSchema,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

// Transfer (E1-8, D30): the new owner is invited as owner; the former one leaves afterwards.
export const inviteNewOwnerSchema = z.object({
  boatId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
});

export const leaveBoatSchema = z.object({ boatId: z.string().uuid() });

export const extendMemberAccessSchema = z.object({
  boatId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const changeMemberRoleSchema = z.object({
  boatId: z.string().uuid(),
  userId: z.string().uuid(),
  role: memberRoleSchema,
});

export const removeMemberSchema = z.object({
  boatId: z.string().uuid(),
  userId: z.string().uuid(),
});

export const revokeInvitationSchema = z.object({
  boatId: z.string().uuid(),
  invitationId: z.string().uuid(),
});

// D151: converts a legacy pending row (docs/DATA-MODEL.md §3.6) into a granted account, instead
// of resending its old token link. The row already carries the role and the duration, so the
// input is only which one.
export const resendInvitationSchema = revokeInvitationSchema;
