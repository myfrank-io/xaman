import { z } from "zod";

export const memberRoleSchema = z.enum(["owner", "editor", "pro", "viewer"]);
export const invitableRoleSchema = z.enum(["editor", "pro", "viewer"]);

export const inviteMemberSchema = z.object({
  boatId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  role: invitableRoleSchema,
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

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

export const acceptInvitationSchema = z.object({
  token: z.string().min(16).max(128),
});
