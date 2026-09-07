import { z } from "zod";

export const emailSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});
export type EmailInput = z.infer<typeof emailSchema>;

/**
 * The code sent by e-mail. Six to ten digits, because that is the range Supabase's « Email OTP
 * Length » can hold — and the app does not own that setting.
 *
 * It used to be exactly six, which is what the screen still promises everywhere else. A project
 * sending eight produced a code that could not even be typed: the field stopped at six
 * characters and the schema refused what got through. The length of a code is not ours to
 * decide, so nothing here decides it.
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
