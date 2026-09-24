import { redirect } from "next/navigation";

// D151: invitations are no longer token-based — the account already exists and the credentials
// e-mail points at /login. This route only still exists because e-mails sent before D151 carry
// this link; without it they landed on a bare 404 instead of somewhere to actually sign in.
export default function LegacyInvitePage() {
  redirect("/login");
}
