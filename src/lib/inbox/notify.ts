import "server-only";

import { inboxReadyEmail, inboxValidatedEmail } from "@/lib/email/inbox";
import { mailerConfigured, sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { formatCurrency, formatDate } from "@/lib/format";
import { editPurchasePath, inboxPath, logPath } from "@/lib/queries/boat-routes";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Who hears about the inbox (D84): the people who can validate — owners and editors — read from
 * the membership with the service key, because this runs after a webhook or after a response.
 *
 * Nothing here throws: an e-mail that does not go out is a line in the server log, never a
 * document lost or a validation undone.
 */
type Recipient = { id: string; email: string; name: string };

async function recipientsOf(
  admin: ReturnType<typeof createAdminClient>,
  boatId: string,
): Promise<Recipient[]> {
  const { data: members } = await admin
    .from("boat_members")
    .select("user_id, valid_until")
    .eq("boat_id", boatId)
    .in("role", ["owner", "editor"]);
  const today = new Date().toISOString().slice(0, 10);
  const ids = (members ?? [])
    .filter((row) => row.valid_until === null || row.valid_until >= today)
    .map((row) => row.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .in("id", ids);
  return (profiles ?? [])
    .filter((row) => row.email !== "")
    .map((row) => ({ id: row.id, email: row.email, name: row.full_name ?? row.email }));
}

/**
 * « Un document est arrivé » — sent once per mail received, whatever the number of attachments,
 * to everyone who can validate. Only for what arrives by mail: someone who has just photographed
 * a receipt is on the screen where it lands.
 */
export async function notifyInboxReceived(boatId: string, itemIds: string[]): Promise<void> {
  if (itemIds.length === 0 || !mailerConfigured()) return;
  try {
    const admin = createAdminClient();
    const [{ data: boat }, { data: items }, recipients] = await Promise.all([
      admin.from("boats").select("name").eq("id", boatId).maybeSingle(),
      admin
        .from("inbox_items")
        .select("sender_email, sender_name, subject")
        .in("id", itemIds)
        .limit(1),
      recipientsOf(admin, boatId),
    ]);
    const first = items?.[0];
    if (!boat || !first) return;
    const senderLabel = first.sender_name
      ? `${first.sender_name} (${first.sender_email ?? ""})`
      : (first.sender_email ?? "");
    const countLabel = itemIds.length === 1 ? "1 document" : `${itemIds.length} documents`;
    const mail = inboxReadyEmail({
      boatName: boat.name,
      senderLabel,
      subject: first.subject,
      countLabel,
      inboxUrl: `${publicEnv.appUrl}${inboxPath(boatId)}`,
      appUrl: publicEnv.appUrl,
    });
    await Promise.all(
      recipients.map(async (recipient) => {
        const result = await sendMail({ to: recipient.email, ...mail });
        if (!result.sent) console.error("inbox: could not notify", recipient.email);
      }),
    );
  } catch (error) {
    console.error("inbox: notification failed", error);
  }
}

/**
 * « C'est validé » — to the other owners and editors, never to the person who tapped the button:
 * they were looking at it.
 */
export async function notifyInboxValidated(input: {
  boatId: string;
  validatorId: string;
  validatorName: string;
  kind: "log" | "purchase";
  entityId: string;
  title: string;
  date: string;
  amount: number | null;
  kindLabel: string;
}): Promise<void> {
  if (!mailerConfigured()) return;
  try {
    const admin = createAdminClient();
    const [{ data: boat }, recipients] = await Promise.all([
      admin.from("boats").select("name").eq("id", input.boatId).maybeSingle(),
      recipientsOf(admin, input.boatId),
    ]);
    if (!boat) return;
    const others = recipients.filter((r) => r.id !== input.validatorId);
    if (others.length === 0) return;
    const mail = inboxValidatedEmail({
      boatName: boat.name,
      validatorName: input.validatorName,
      kindLabel: input.kindLabel,
      title: input.title,
      dateLabel: formatDate(input.date),
      amountLabel: input.amount === null ? null : formatCurrency(input.amount),
      url: `${publicEnv.appUrl}${
        input.kind === "log"
          ? logPath(input.boatId, input.entityId)
          : editPurchasePath(input.boatId, input.entityId)
      }`,
      appUrl: publicEnv.appUrl,
    });
    await Promise.all(
      others.map(async (recipient) => {
        const result = await sendMail({ to: recipient.email, ...mail });
        if (!result.sent) console.error("inbox: could not notify", recipient.email);
      }),
    );
  } catch (error) {
    console.error("inbox: notification failed", error);
  }
}
