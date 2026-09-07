import "server-only";

/**
 * The app's own mailer, for the one e-mail Supabase Auth cannot send on our behalf.
 *
 * Resend, like the weekly digest (`supabase/functions/weekly-digest`), and over `fetch` rather
 * than the SDK: one POST, no dependency. The key is server-only and read where it is used —
 * never exported, never in `publicEnv`.
 *
 * Unconfigured is a normal state, not a failure: `mailerConfigured()` answers false, and the
 * caller keeps whatever it did before. That is what lets this ship before the variable exists.
 */
const ENDPOINT = "https://api.resend.com/emails";

/** Must be an address on the domain verified with Resend, or the send is refused. */
const DEFAULT_FROM = "Xaman <noreply@xaman.boats>";

export function mailerConfigured(): boolean {
  return (process.env.RESEND_API_KEY ?? "") !== "";
}

export type Mail = { to: string; subject: string; html: string };

/**
 * Accepted by the mailer is not received by anyone: the id the provider answers with is what
 * lets the app find out which of the two it was (D78), so it comes back with the answer rather
 * than being thrown away. `sent: false` is the send itself failing, and stays what it was — the
 * caller's error path.
 */
export type SendResult = { sent: true; id: string | null } | { sent: false };

export async function sendMail({ to, subject, html }: Mail): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY ?? "";
  if (!key) return { sent: false };
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [to],
        subject,
        html,
      }),
    });
    if (res.ok) {
      const body: unknown = await res.json().catch(() => null);
      const id = (body as { id?: unknown } | null)?.id;
      // Accepted without a readable id: sent all the same, only untraceable afterwards.
      return { sent: true, id: typeof id === "string" && id !== "" ? id : null };
    }
    // The body carries why (unverified domain, refused sender): worth a server log, never the UI.
    console.error(`resend ${res.status}: ${await res.text()}`);
    return { sent: false };
  } catch (error) {
    console.error("resend request failed", error);
    return { sent: false };
  }
}
