import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type EmailInput = z.infer<typeof emailSchema>;

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});
export type OtpInput = z.infer<typeof otpSchema>;
