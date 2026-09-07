"use server";

import { redirect } from "next/navigation";

import { fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { recoveryEmail } from "@/lib/email/recovery";
import { mailerConfigured, sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { emailSchema } from "@/lib/schemas/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/**
 * « Mot de passe oublié » — the code that opens the screen where a new one is chosen (D78).
 *
 * A code, not a link, for the reason D76 established on the sign-in e-mail: in GoTrue the
 * recovery link and the recovery code are the SAME one-time token, and a mailbox's anti-phishing
 * scanner opens every URL in a message seconds after it lands. The person who asked for it then
 * reads « ce lien n'est plus valable ». An e-mail with nothing to open cannot be burned that way.
 *
 * And the app sends it itself when a mailer is configured, like the invitation (D75).
 * `generateLink` mints the token without sending anything, so this path never touches Supabase's
 * built-in SMTP — the few-messages-an-hour box whose `429 email rate limit exceeded` was the
 * first half of « le mot de passe oublié ne fonctionne pas » (D45). **Without `RESEND_API_KEY`
 * the previous behaviour is kept exactly**: GoTrue sends its own `recovery` template, which now
 * carries the code too.
 *
 * The answer is the same whether the account exists or not — an unknown address is answered
 * « sent », because telling a stranger which addresses have an account here is telling them who
 * sails with whom. The hourly quota is the one exception: it belongs to the application, not to
 * the address, so saying it leaks nothing, and staying silent would leave someone waiting for a
 * message that is never going to be sent.
 */
export async function requestPasswordReset(input: unknown): Promise<ActionResult<undefined>> {
  const parsed = parseInput(emailSchema, input);
  if (!parsed.ok) return parsed.result;
  const { email } = parsed.data;

  if (mailerConfigured()) {
    const minted = await mintRecoveryCode(email);
    // « No such account » is answered exactly like a code that went out.
    if (minted.state === "unknown") return ok(undefined);
    if (minted.state === "ready") {
      const { subject, html } = recoveryEmail({ code: minted.code, appUrl: publicEnv.appUrl });
      if (!(await sendMail({ to: email, subject, html }))) return fail("auth.forgot.errors.send");
      return ok(undefined);
    }
    // `unavailable`: a mailer but no service-role key to mint a code with. Falling through to
    // GoTrue still gets the person their code — a half-configured project is not their problem.
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email);
  if (error && /rate limit|too many|429/i.test(error.message)) {
    return fail("auth.forgot.errors.rateLimited");
  }
  return ok(undefined);
}

type MintedCode =
  /** The raw OTP, ours to put in an e-mail. */
  | { state: "ready"; code: string }
  /** No account for that address — the one outcome that must look exactly like success. */
  | { state: "unknown" }
  /** No service-role key here: nothing was asked of Auth, and GoTrue can still send its own. */
  | { state: "unavailable" };

/** Mints a recovery token without sending anything: no e-mail, so no hourly quota to hit. */
async function mintRecoveryCode(email: string): Promise<MintedCode> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return { state: "unavailable" };
  }
  const { data, error } = await admin.auth.admin.generateLink({ type: "recovery", email });
  if (error) {
    // Only « no such user » is silence. Anything else — Auth unreachable, a 500 — must not be
    // answered « envoyé » on this path: GoTrue gets its turn rather than nobody getting a code.
    const missing = error.status === 404 || /user not found/i.test(error.message);
    return missing ? { state: "unknown" } : { state: "unavailable" };
  }
  if (!data.properties.email_otp) return { state: "unavailable" };
  return { state: "ready", code: data.properties.email_otp };
}
