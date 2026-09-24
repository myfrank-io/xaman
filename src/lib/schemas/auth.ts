import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type EmailInput = z.infer<typeof emailSchema>;

/**
 * The code sent by e-mail for password recovery (D78). Six to ten digits, because that is the
 * range Supabase's « Email OTP Length » can hold — and the app does not own that setting.
 *
 * Sign-in itself is password-only (D151): this schema now serves only the forgot-password code
 * (`ForgotPasswordForm.tsx`), which is untouched by that change.
 */
export const OTP_MIN = 6;
export const OTP_MAX = 10;

export const otpSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  token: z
    .string()
    .trim()
    .regex(new RegExp(`^\\d{${OTP_MIN},${OTP_MAX}}$`)),
});
export type OtpInput = z.infer<typeof otpSchema>;

/**
 * Eight characters minimum, and never trimmed — a space someone deliberately typed is part of
 * their password. The ceiling is bcrypt's: everything past 72 bytes is silently ignored by the
 * hash, so a longer password would only be long in appearance.
 */
export const passwordField = z.string().min(8).max(72);

export const passwordSignInSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type PasswordSignInInput = z.infer<typeof passwordSignInSchema>;

export const signUpSchema = z
  .object({
    fullName: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email(),
    password: passwordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const newPasswordSchema = z
  .object({
    password: passwordField,
    confirm: z.string(),
  })
  .refine((values) => values.password === values.confirm, {
    path: ["confirm"],
    message: "mismatch",
  });
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
