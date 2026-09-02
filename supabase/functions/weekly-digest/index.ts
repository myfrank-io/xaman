// Weekly digest (E9-6): one e-mail per boat and per owner/editor, Friday morning, with the
// overdue points, the ones due within 30 days or 25 h, and the planned / urgent interventions.
// No push, no per-item notification. Sent through Resend; without RESEND_API_KEY the function
// only logs what it would send (safe in preview projects).
//
// Deploy: `supabase functions deploy weekly-digest --no-verify-jwt` then set the secrets
// RESEND_API_KEY, DIGEST_FROM (e.g. "Xaman <carnet@xaman.app>"), APP_URL. The schedule lives in
// migration 0008 (pg_cron + pg_net + vault secrets `xaman_digest_url` / `xaman_digest_key`).

import { createClient } from "npm:@supabase/supabase-js@2";

type DigestItem = { label: string; category: string; due: string; state: "overdue" | "soon" };
type DigestLog = { title: string; status: "planned" | "in_progress" | "urgent"; date: string };
type BoatDigest = {
  boat_id: string;
  boat_name: string;
  recipients: { email: string; full_name: string | null }[];
  overdue: DigestItem[];
  soon: DigestItem[];
  logs: DigestLog[];
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const FROM = Deno.env.get("DIGEST_FROM") ?? "Xaman <no-reply@example.com>";
const APP_URL = Deno.env.get("APP_URL") ?? "https://xaman-blue.vercel.app";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

function frDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

const STATUS_FR: Record<DigestLog["status"], string> = {
  planned: "Planifiée",
  in_progress: "En cours",
  urgent: "Urgente",
};

function render(digest: BoatDigest): { subject: string; html: string; text: string } {
  const counts = [
    digest.overdue.length ? `${digest.overdue.length} en retard` : null,
    digest.soon.length ? `${digest.soon.length} bientôt` : null,
    digest.logs.length ? `${digest.logs.length} intervention${digest.logs.length > 1 ? "s" : ""} ouverte${digest.logs.length > 1 ? "s" : ""}` : null,
  ].filter(Boolean);
  const subject = counts.length
    ? `${digest.boat_name} · ${counts.join(", ")}`
    : `${digest.boat_name} · tout est à jour`;
  const link = `${APP_URL}/boats/${digest.boat_id}/dashboard`;

  const section = (title: string, rows: string[]) =>
    rows.length ? `<h2 style="font:600 15px system-ui;margin:20px 0 8px">${escapeHtml(title)}</h2><ul style="margin:0;padding-left:18px;font:14px/1.5 system-ui">${rows.join("")}</ul>` : "";
  const itemRow = (item: DigestItem) =>
    `<li>${escapeHtml(item.label)} <span style="color:#475569">· ${escapeHtml(item.category)} · ${escapeHtml(item.due)}</span></li>`;
  const logRow = (log: DigestLog) =>
    `<li>${escapeHtml(log.title)} <span style="color:#475569">· ${STATUS_FR[log.status]} · ${frDate(log.date)}</span></li>`;

  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:24px;background:#F7F9FB;color:#0F172A">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #D9E0E8;border-radius:12px;padding:24px">
<p style="font:600 11px system-ui;letter-spacing:.08em;color:#475569;text-transform:uppercase;margin:0 0 4px">Xaman · carnet d'entretien</p>
<h1 style="font:600 20px system-ui;margin:0 0 12px">${escapeHtml(digest.boat_name)}</h1>
<p style="font:14px/1.5 system-ui;margin:0">${counts.length ? "Le point de la semaine sur ce qui attend le bateau." : "Rien à faire dans les 30 prochains jours."}</p>
${section("En retard", digest.overdue.map(itemRow))}
${section("Bientôt", digest.soon.map(itemRow))}
${section("Interventions ouvertes", digest.logs.map(logRow))}
<p style="margin:24px 0 0"><a href="${link}" style="display:inline-block;background:#123152;color:#fff;text-decoration:none;font:600 15px system-ui;padding:12px 18px;border-radius:10px">Ouvrir le tableau de bord</a></p>
<p style="font:12px/1.5 system-ui;color:#64748B;margin:20px 0 0">Vous recevez ce message chaque vendredi parce que vous tenez le carnet de ${escapeHtml(digest.boat_name)} dans Xaman.</p>
</div></body></html>`;

  const text = [
    `${digest.boat_name} — ${counts.length ? counts.join(", ") : "tout est à jour"}`,
    ...(digest.overdue.length ? ["", "En retard :", ...digest.overdue.map((i) => `- ${i.label} · ${i.category} · ${i.due}`)] : []),
    ...(digest.soon.length ? ["", "Bientôt :", ...digest.soon.map((i) => `- ${i.label} · ${i.category} · ${i.due}`)] : []),
    ...(digest.logs.length ? ["", "Interventions ouvertes :", ...digest.logs.map((l) => `- ${l.title} · ${STATUS_FR[l.status]} · ${frDate(l.date)}`)] : []),
    "",
    link,
  ].join("\n");
  return { subject, html, text };
}

async function send(to: string, message: { subject: string; html: string; text: string }) {
  if (!RESEND_API_KEY) {
    console.log(`[dry-run] to=${to} subject=${message.subject}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject: message.subject, html: message.html, text: message.text }),
  });
  if (!res.ok) console.error(`resend ${res.status} for ${to}: ${await res.text()}`);
  return res.ok;
}

Deno.serve(async (request) => {
  // Called by pg_cron (migration 0008) with the service key; refuse anything else.
  const auth = request.headers.get("authorization") ?? "";
  if (!SERVICE_KEY || auth !== `Bearer ${SERVICE_KEY}`) {
    return new Response("forbidden", { status: 403 });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("weekly_digest_payload");
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0;
  for (const digest of (data ?? []) as BoatDigest[]) {
    if (digest.recipients.length === 0) continue;
    const message = render(digest);
    for (const recipient of digest.recipients) {
      if (await send(recipient.email, message)) sent += 1;
    }
  }
  return Response.json({ boats: (data ?? []).length, sent });
});
