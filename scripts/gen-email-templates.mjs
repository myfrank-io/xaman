#!/usr/bin/env node
/**
 * Regenerates supabase/templates/*.html — the six e-mails Supabase Auth sends.
 *
 * Why a generator rather than six hand-written files: GoTrue templates have no includes, so the
 * navy header, the gilt rule and the footer would be copied six times and drift the first time
 * someone touches one of them. The shell lives here once; the files are committed because that
 * is what `supabase start` and `supabase config push` read.
 * `tests/unit/email-templates.test.ts` fails if the committed HTML no longer matches this file.
 *
 * The palette is Xaman's own (src/app/globals.css): navy header, gilt hairline, warm chart-paper
 * ground, ink `--foreground`. Values are inlined as hexadecimal because e-mail clients have no
 * custom properties, and the display face falls back to the same serif stack as `--font-display`
 * — Fraunces is not installable in an inbox.
 *
 * Go template variables (https://supabase.com/docs/guides/auth/auth-email-templates):
 *   {{ .Token }}           6-digit code — its presence is what makes Supabase send a CODE
 *                          rather than a magic link (fixes « on reçoit un lien, pas un code »)
 *   {{ .ConfirmationURL }} verification link, honouring the redirectTo of the call
 *   {{ .Data.x }}          auth.users.user_metadata — the invitation passes boat_name,
 *                          inviter_name and role_label (src/lib/actions/members.ts)
 *   {{ .Email }}, {{ .NewEmail }}, {{ .SiteURL }}
 *
 * Usage: node scripts/gen-email-templates.mjs [--check]
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const TEMPLATE_DIR = path.join(root, "supabase", "templates");
/**
 * The e-mails the app sends itself, a second time, as TypeScript strings — the invitation (D75)
 * and the recovery code (D78). Both must be the very message Supabase would have sent, to the
 * pixel. Reading the .html at runtime would mean carrying a file into the serverless bundle and
 * hoping the tracer agrees; a generated module is simply imported, and the drift test covers it
 * like the rest.
 */
export const APP_TEMPLATE = path.join(root, "src", "lib", "email", "templates.generated.ts");

/** The templates the app sends itself, in the order they appear in the generated module. */
const APP_TEMPLATE_KEYS = ["invite", "recovery"];

/**
 * globals.css, verbatim — with one deliberate exception. The app draws its gilt rule as
 * `--brass-light` at 48 % (`#736655` once composited on the navy), one device pixel on a retina
 * screen against the header's gradient. An inbox has neither: two flat CSS pixels of `#736655`
 * on flat navy simply disappear, and the rule is the one thing that says Xaman before a word is
 * read. It is taken up to roughly 70 % of the brass, which is what the app's hairline looks like
 * rather than what it measures.
 */
const C = {
  navy: "#0c1b33",
  navyDeep: "#081426",
  hairline: "#a38964",
  paper: "#f6f5f1",
  surface: "#ffffff",
  ink: "#0c1b33",
  ink2: "#4a5b72",
  ink3: "#63748a",
  border: "#d2dae4",
  muted: "#eff3f7",
  primary: "#123152",
  onNavy: "#ffffff",
  onNavy2: "#cbd6e4",
  brassLight: "#e3b879",
};

const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";
/** The fallback half of `--font-family-display`: what an inbox can actually resolve. */
const DISPLAY = "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,'Times New Roman',serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace";

const CONTENT_WIDTH = 600;

// --------------------------------------------------------------------------- building blocks

/**
 * Dark mode is a class, light mode is an inline style: Apple Mail honours the `<style>` block in
 * the shell, everyone else keeps the inline colour. Every coloured node carries the pair.
 */
const TONE = { [C.ink]: "x-ink", [C.ink2]: "x-ink-2", [C.ink3]: "x-ink-3" };

const p = (text, { color = C.ink2, size = 16, top = 16 } = {}) =>
  `<p class="${TONE[color]}" style="margin:${top}px 0 0;font-family:${SANS};font-size:${size}px;line-height:1.6;color:${color}">${text}</p>`;

const h1 = (text) =>
  `<h1 class="x-ink" style="margin:0;font-family:${DISPLAY};font-size:26px;line-height:1.25;font-weight:600;color:${C.ink}">${text}</h1>`;

/** Emphasis inside a paragraph: the ink tone, and the same dark-mode class as a heading. */
const strong = (text) => `<strong class="x-ink" style="color:${C.ink}">${text}</strong>`;

const link = (text, href) =>
  `<a href="${href}" style="color:${C.primary};text-decoration:underline">${text}</a>`;

/**
 * A tap target an e-mail client cannot shrink: 44 px of height comes from the padding, and the
 * background sits on the cell so Outlook — which drops the radius — still shows a filled button.
 */
const button = (
  label,
  href,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0">
  <tr>
    <td align="center" bgcolor="${C.primary}" style="border-radius:10px;background-color:${C.primary};mso-padding-alt:14px 28px">
      <a href="${href}" style="display:inline-block;padding:14px 28px;font-family:${SANS};font-size:16px;line-height:20px;font-weight:600;color:${C.onNavy};text-decoration:none;border-radius:10px">${label}</a>
    </td>
  </tr>
</table>`;

/**
 * The code, and nothing competing with it. `text-indent` gives back the trailing letter-space so
 * six digits stay optically centred.
 */
const code =
  () => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 0">
  <tr>
    <td class="x-panel" align="center" bgcolor="${C.muted}" style="background-color:${C.muted};border:1px solid ${C.border};border-radius:12px;padding:20px 16px">
      <div class="x-ink" style="font-family:${MONO};font-size:34px;line-height:1.2;font-weight:700;letter-spacing:0.24em;text-indent:0.24em;color:${C.ink}">{{ .Token }}</div>
    </td>
  </tr>
</table>`;

/** Bateau / rôle / adresse: the three facts an invitation is judged on, before the button. */
const facts = (
  rows,
) => `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="x-panel" style="margin:24px 0 0;border:1px solid ${C.border};border-radius:12px;border-collapse:separate">
${rows
  .map(
    ([label, value], i) => `  <tr>
    <td class="x-ink-3" style="padding:${i === 0 ? 14 : 12}px 18px ${i === rows.length - 1 ? 14 : 0}px;font-family:${SANS};font-size:13px;line-height:1.4;color:${C.ink3}">${label}<br /><span class="x-ink" style="font-size:16px;font-weight:600;color:${C.ink}">${value}</span></td>
  </tr>`,
  )
  .join("\n")}
</table>`;

/** The link under the button: some clients strip the button, none strip a plain URL. */
const fallbackLink = (href) =>
  p(
    `Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :<br /><a href="${href}" style="color:${C.primary};text-decoration:underline;word-break:break-all">${href}</a>`,
    { color: C.ink3, size: 13, top: 24 },
  );

const IGNORE = `Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail : rien ne se passera.`;

// --------------------------------------------------------------------------- the shell

/** Keeps the generated HTML readable: every block sits at the depth of the cell holding it. */
const indent = (html, spaces) =>
  html
    .split("\n")
    .map((line) => (line ? " ".repeat(spaces) + line : line))
    .join("\n");

/**
 * One frame for the six e-mails: navy plate, gilt rule, white card on chart paper.
 * Tables and inline styles because that is the only layout an inbox agrees on; the dark-mode
 * block is a bonus for Apple Mail and is ignored everywhere else.
 */
function shell({ title, preheader, body }) {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>${title}</title>
    <style>
      @media (prefers-color-scheme: dark) {
        .x-ground { background-color: ${C.navyDeep} !important; }
        .x-card { background-color: #12233d !important; }
        .x-ink { color: ${C.onNavy} !important; }
        .x-ink-2 { color: ${C.onNavy2} !important; }
        .x-ink-3 { color: #9bb0c8 !important; }
        .x-panel { background-color: #1b2a45 !important; border-color: #35496a !important; }
      }
      @media only screen and (max-width: 620px) {
        .x-pad { padding-left: 24px !important; padding-right: 24px !important; }
      }
    </style>
  </head>
  <body class="x-ground" style="margin:0;padding:0;width:100%;background-color:${C.paper};-webkit-text-size-adjust:100%">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px">${preheader}</div>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="x-ground" style="background-color:${C.paper}">
      <tr>
        <td align="center" style="padding:24px 12px 32px">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${CONTENT_WIDTH}" style="width:100%;max-width:${CONTENT_WIDTH}px">
            <tr>
              <td bgcolor="${C.navy}" class="x-pad" style="background-color:${C.navy};padding:28px 32px 22px;border-radius:14px 14px 0 0">
                <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.4;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:${C.brassLight}">Carnet d'entretien</p>
                <p style="margin:10px 0 0;font-family:${DISPLAY};font-size:28px;line-height:1.1;font-weight:600;letter-spacing:0.3em;text-indent:0.3em;color:${C.onNavy}">XAMAN</p>
              </td>
            </tr>
            <tr>
              <td bgcolor="${C.hairline}" style="background-color:${C.hairline};height:2px;line-height:2px;font-size:0">&nbsp;</td>
            </tr>
            <tr>
              <td bgcolor="${C.surface}" class="x-card x-pad" style="background-color:${C.surface};padding:32px;border-radius:0 0 14px 14px">
${body}
              </td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${CONTENT_WIDTH}" style="width:100%;max-width:${CONTENT_WIDTH}px">
            <tr>
              <td class="x-pad" style="padding:20px 32px 0">
                <p class="x-ink-3" style="margin:0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.ink3}">Xaman — carnet d'entretien numérique et partagé pour bateaux.<br />Cet e-mail part de <a href="{{ .SiteURL }}" style="color:${C.ink3}">{{ .SiteURL }}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

// --------------------------------------------------------------------------- the six e-mails

/**
 * Each entry is a file in supabase/templates/ and a `[auth.email.template.*]` block in
 * supabase/config.toml. `subject` is written here so the two stay side by side; the test checks
 * config.toml carries exactly these subjects and paths.
 */
export const TEMPLATES = [
  {
    key: "invite",
    file: "invite.html",
    // Static on purpose: a subject is rendered by the same engine, and a boat with no name
    // would leave « à bord de  » hanging in the inbox list.
    subject: "Vous êtes invité à bord — Xaman",
    title: "Invitation",
    preheader: "Un carnet d'entretien vous attend.",
    body: [
      h1("Vous êtes invité à bord"),
      p(
        `{{ if .Data.inviter_name }}${strong("{{ .Data.inviter_name }}")} vous invite à rejoindre{{ else }}Vous êtes invité à rejoindre{{ end }} un carnet d'entretien sur Xaman : l'historique du bateau, ce qui est à faire, et par qui.`,
      ),
      facts([
        [
          "Bateau",
          "{{ if .Data.boat_name }}{{ .Data.boat_name }}{{ else }}Le carnet du bord{{ end }}",
        ],
        ["Votre rôle", "{{ if .Data.role_label }}{{ .Data.role_label }}{{ else }}Membre{{ end }}"],
        ["Votre adresse", "{{ .Email }}"],
      ]),
      button("Rejoindre le carnet", "{{ .ConfirmationURL }}"),
      p("Ce lien ouvre votre compte et vous conduit à l'invitation. Il ne sert qu'une fois.", {
        color: C.ink3,
        size: 13,
        top: 20,
      }),
      fallbackLink("{{ .ConfirmationURL }}"),
    ],
  },
  {
    key: "magic_link",
    file: "magic-link.html",
    // The code first, in the subject too: on an iPad it is often all someone needs to read.
    subject: "{{ .Token }} — votre code de connexion Xaman",
    title: "Code de connexion",
    preheader: "Votre code de connexion.",
    body: [
      h1("Votre code de connexion"),
      p("Saisissez ce code dans Xaman pour ouvrir votre session."),
      code(),
      // No link, on purpose (D76). In GoTrue the magic link and this code are the SAME one-time
      // token, and the anti-phishing scanners of a corporate mailbox open every URL in a message
      // seconds after it lands — burning the code before its owner has read it. Measured on this
      // project: three `/verify 303` from Amazon and Azure addresses, then the human's own
      // attempt refused. Nothing to open is the only fix that holds.
      p(
        `Ce message ne contient volontairement aucun lien : certaines messageries les ouvrent automatiquement pour les vérifier, ce qui consommerait votre code avant vous.`,
        { size: 14, top: 24 },
      ),
      p(IGNORE, { color: C.ink3, size: 13, top: 20 }),
    ],
  },
  {
    key: "confirmation",
    file: "confirm-signup.html",
    subject: "{{ .Token }} — votre code Xaman",
    title: "Bienvenue à bord",
    preheader: "Votre code à 6 chiffres, valable 10 minutes.",
    body: [
      h1("Bienvenue à bord"),
      p(
        "Voici le code qui ouvre votre compte Xaman. Saisissez-le dans l'application : il est valable 10 minutes.",
      ),
      code(),
      p(
        `Vous pouvez aussi ${link("confirmer votre adresse depuis le navigateur", "{{ .ConfirmationURL }}")}.`,
        { size: 14, top: 24 },
      ),
      p(IGNORE, { color: C.ink3, size: 13, top: 20 }),
    ],
  },
  {
    key: "recovery",
    file: "recovery.html",
    subject: "{{ .Token }} — réinitialiser votre mot de passe Xaman",
    title: "Nouveau mot de passe",
    preheader: "Votre code pour choisir un nouveau mot de passe.",
    body: [
      h1("Choisir un nouveau mot de passe"),
      p("Saisissez ce code dans Xaman, puis choisissez le mot de passe que vous garderez."),
      code(),
      // No link, for the same reason the sign-in code has none (D76, extended by D78). The
      // recovery link and this code are one one-time token: a mailbox's anti-phishing scanner
      // opens every URL in a message seconds after it lands, and the person who asked for it
      // then reads « ce lien n'est plus valable ». Nothing to open is the only fix that holds.
      p(
        `Ce message ne contient volontairement aucun lien : certaines messageries les ouvrent automatiquement pour les vérifier, ce qui consommerait votre code avant vous.`,
        { size: 14, top: 24 },
      ),
      // D45: someone already signed in never needs this detour — the profile writes it directly.
      p(
        "Déjà connecté sur un appareil ? Mon profil → Mot de passe le change sans passer par ici.",
        { color: C.ink3, size: 13, top: 20 },
      ),
      p(IGNORE, { color: C.ink3, size: 13, top: 20 }),
    ],
  },
  {
    key: "email_change",
    file: "email-change.html",
    subject: "Confirmez votre nouvelle adresse e-mail — Xaman",
    title: "Nouvelle adresse e-mail",
    preheader: "Confirmez la nouvelle adresse de votre compte.",
    body: [
      h1("Confirmez votre nouvelle adresse"),
      p(
        `Votre compte Xaman passerait de ${strong("{{ .Email }}")} à ${strong("{{ .NewEmail }}")}. Confirmez avec le code ci-dessous, ou avec le bouton.`,
      ),
      code(),
      button("Confirmer cette adresse", "{{ .ConfirmationURL }}"),
      p(IGNORE, { color: C.ink3, size: 13, top: 20 }),
    ],
  },
  {
    key: "reauthentication",
    file: "reauthentication.html",
    subject: "{{ .Token }} — code de vérification Xaman",
    title: "Code de vérification",
    preheader: "Votre code de vérification, valable 10 minutes.",
    body: [
      h1("Votre code de vérification"),
      p("Une opération sensible attend ce code. Il est valable 10 minutes."),
      code(),
      p(IGNORE, { color: C.ink3, size: 13, top: 20 }),
    ],
  },
];

export function render(template) {
  return shell({
    title: template.title,
    preheader: template.preheader,
    body: indent(template.body.join("\n"), 16),
  });
}

/** The generated module: the two e-mails the app sends, and nothing to keep in step by hand. */
export function renderAppTemplate() {
  const names = { invite: "INVITATION", recovery: "RECOVERY" };
  const blocks = APP_TEMPLATE_KEYS.map((key) => {
    const template = TEMPLATES.find((t) => t.key === key);
    const name = names[key];
    return `export const ${name}_SUBJECT = ${JSON.stringify(template.subject)};

export const ${name}_HTML = ${JSON.stringify(render(template))};
`;
  });
  return `// Generated by scripts/gen-email-templates.mjs — do not edit.
// The e-mails the app sends itself, identical to their supabase/templates/*.html counterparts:
// the invitation (D75) and the password-recovery code (D78).
// Regenerate with: pnpm gen:emails

${blocks.join("\n")}`;
}

function main() {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const template of TEMPLATES) {
    const target = path.join(TEMPLATE_DIR, template.file);
    const html = render(template);
    if (check) {
      const current = readFileSync(target, "utf8");
      if (current !== html) {
        console.error(`stale: supabase/templates/${template.file}`);
        stale += 1;
      }
      continue;
    }
    writeFileSync(target, html);
    console.log(`wrote supabase/templates/${template.file}`);
  }
  const appTemplate = renderAppTemplate();
  if (check) {
    if (readFileSync(APP_TEMPLATE, "utf8") !== appTemplate) {
      console.error("stale: src/lib/email/templates.generated.ts");
      stale += 1;
    }
  } else {
    writeFileSync(APP_TEMPLATE, appTemplate);
    console.log("wrote src/lib/email/templates.generated.ts");
  }

  if (check) {
    if (stale) {
      console.error(`${stale} template(s) out of date — run: pnpm gen:emails`);
      process.exit(1);
    }
    console.log(`${TEMPLATES.length} templates up to date`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
