import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(80),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
