import { readFileSync } from "node:fs";
import path from "node:path";

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { devUiEnabled } from "@/lib/dev-ui";
import { renderEmailPreview } from "@/lib/email-preview";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "E-mails" };

/**
 * The six e-mails Supabase Auth sends, rendered with sample values.
 *
 * They are the only Xaman screens that reach someone without anyone having looked at them first:
 * no route, no build error, no way back once sent. This page is that look. The HTML shown is the
 * committed template itself (supabase/templates/), so what is approved here is what is pushed
 * with `pnpm emails:push` — never a copy that drifted.
 *
 * The frame is deliberately plain: it is a picture frame, not a screen of the app.
 */
const MAILS = [
  {
    key: "invite",
    file: "invite.html",
    label: "Invitation",
    subject: "Vous êtes invité à bord — Xaman",
    when: "Un propriétaire ajoute quelqu'un à l'équipage.",
  },
  {
    key: "magic-link",
    file: "magic-link.html",
    label: "Code de connexion",
    subject: "418273 — votre code de connexion Xaman",
    when: "« Code par e-mail » sur l'écran de connexion, pour un compte qui existe.",
  },
  {
    key: "confirm-signup",
    file: "confirm-signup.html",
    label: "Nouveau compte",
    subject: "418273 — votre code Xaman",
    when: "Première connexion d'un invité : le compte se crée avec le code.",
  },
  {
    key: "recovery",
    file: "recovery.html",
    label: "Mot de passe oublié",
    subject: "Réinitialiser votre mot de passe Xaman",
    when: "« Mot de passe oublié ? » — le lien de récupération (D26).",
  },
  {
    key: "email-change",
    file: "email-change.html",
    label: "Changement d'adresse",
    subject: "Confirmez votre nouvelle adresse e-mail — Xaman",
    when: "Les deux adresses confirment (double_confirm_changes).",
  },
  {
    key: "reauthentication",
    file: "reauthentication.html",
    label: "Vérification",
    subject: "418273 — code de vérification Xaman",
    when: "Opération sensible : Supabase redemande un code.",
  },
] as const;

const TEMPLATE_DIR = path.join(process.cwd(), "supabase", "templates");

export default async function DevEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ mail?: string }>;
}) {
  if (!devUiEnabled()) notFound();
  const { mail } = await searchParams;
  const current = MAILS.find((entry) => entry.key === mail) ?? MAILS[0];
  const html = renderEmailPreview(readFileSync(path.join(TEMPLATE_DIR, current.file), "utf8"));

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <p className="text-overline text-ink-2 uppercase">Design system</p>
        <h1 className="mt-1 text-h1">E-mails d&apos;authentification</h1>
        <p className="mt-2 text-body text-ink-2">
          Ce que Supabase envoie, tel quel. Modifier{" "}
          <code className="font-mono text-caption">scripts/gen-email-templates.mjs</code>, puis{" "}
          <code className="font-mono text-caption">pnpm gen:emails</code> et{" "}
          <code className="font-mono text-caption">pnpm emails:push</code>.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="E-mails">
        {MAILS.map((entry) => (
          <Link
            key={entry.key}
            href={`/dev/ui/emails?mail=${entry.key}`}
            aria-current={entry.key === current.key ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center rounded-lg border tap-feedback px-4 text-label font-medium",
              entry.key === current.key
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-border bg-surface text-ink-2",
            )}
          >
            {entry.label}
          </Link>
        ))}
      </nav>

      <section className="flex flex-col gap-3">
        <div className="rounded-xl border bg-card p-4">
          <p className="text-caption text-ink-2">Objet</p>
          <p className="mt-1 text-body font-semibold">{current.subject}</p>
          <p className="mt-3 text-caption text-ink-2">Envoyé quand</p>
          <p className="mt-1 text-body">{current.when}</p>
        </div>
        {/* An e-mail is a document, not a fragment: a sandboxed iframe is the only honest
            preview — the page's own stylesheet must not reach inside it. */}
        <iframe
          key={current.key}
          title={`Aperçu — ${current.label}`}
          srcDoc={html}
          sandbox=""
          className="h-[900px] w-full rounded-xl border bg-white"
        />
      </section>
    </main>
  );
}
