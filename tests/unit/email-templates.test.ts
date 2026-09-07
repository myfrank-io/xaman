import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  APP_TEMPLATE,
  TEMPLATES,
  TEMPLATE_DIR,
  render,
  renderAppTemplate,
} from "../../scripts/gen-email-templates.mjs";
import { payload, subjectsFromConfig } from "../../scripts/push-email-templates.mjs";

import { SAMPLE_VALUES, renderEmailPreview, unresolvedPlaceholders } from "@/lib/email-preview";
import { invitationEmail } from "@/lib/email/invitation";
import { recoveryEmail } from "@/lib/email/recovery";
import { unresolvedPlaceholders as unresolvedIn } from "@/lib/email/render";
import {
  INVITATION_HTML,
  INVITATION_SUBJECT,
  RECOVERY_HTML,
  RECOVERY_SUBJECT,
} from "@/lib/email/templates.generated";

type Template = {
  key: string;
  file: string;
  subject: string;
  title: string;
  preheader: string;
  body: string[];
};

const templates = TEMPLATES as Template[];
const config = readFileSync(path.join(process.cwd(), "supabase", "config.toml"), "utf8");
const html = (file: string) => readFileSync(path.join(TEMPLATE_DIR as string, file), "utf8");

/**
 * The six e-mails Supabase Auth sends are the only Xaman screens nobody can look at before they
 * arrive in someone's inbox, and the only ones no `pnpm build` compiles. These tests are what
 * stands in for that: the committed HTML matches its generator, config.toml points at the files
 * that exist, and the templates that MUST carry a code still do.
 */
describe("auth e-mail templates", () => {
  it("match their generator — regenerate with pnpm gen:emails", () => {
    for (const template of templates) {
      expect(html(template.file), template.file).toBe(render(template));
    }
  });

  /**
   * The app sends its own invitation (D75) and its own recovery code (D78) when a mailer is
   * configured. Both must be the very e-mail Supabase would have sent, which is why the module
   * is generated rather than written.
   */
  it("hand the app the very e-mails Supabase would have sent", () => {
    expect(readFileSync(APP_TEMPLATE as string, "utf8")).toBe(renderAppTemplate());
    const invite = templates.find((t) => t.key === "invite")!;
    expect(INVITATION_HTML).toBe(html(invite.file));
    expect(INVITATION_SUBJECT).toBe(invite.subject);
    const recovery = templates.find((t) => t.key === "recovery")!;
    expect(RECOVERY_HTML).toBe(html(recovery.file));
    expect(RECOVERY_SUBJECT).toBe(recovery.subject);
  });

  /**
   * D78. The recovery e-mail the app sends carries the raw OTP `generateLink` hands back — in
   * the body and in the subject, which is where an iPad notification stops.
   */
  it("fill the recovery e-mail the app sends with the code, and leave no link in it", () => {
    const { subject, html: body } = recoveryEmail({
      code: "418273",
      appUrl: "https://xaman.boats",
    });
    expect(subject).toBe("418273 — réinitialiser votre mot de passe Xaman");
    expect(body).toContain("418273");
    expect(body).toContain("https://xaman.boats");
    expect(body).not.toContain("{{ .ConfirmationURL }}");
    expect(unresolvedIn(body, {})).toEqual([]);
  });

  it("fill the invitation the app sends with the boat, the inviter and the role", () => {
    const { subject, html: body } = invitationEmail({
      email: "emmanuel@exemple.fr",
      inviteUrl: "https://xaman.boats/invite/tok",
      boatName: "Xaman",
      inviterName: "Xavier",
      roleLabel: "Éditeur",
      appUrl: "https://xaman.boats",
    });
    expect(subject).toBe(INVITATION_SUBJECT);
    for (const value of ["Xaman", "Xavier", "Éditeur", "emmanuel@exemple.fr"]) {
      expect(body).toContain(value);
    }
    // The link is the invitation's own address, not an auth verification URL: opening it
    // creates nobody's account, /invite/[token] asks for the sign-in.
    expect(body).toContain("https://xaman.boats/invite/tok");
    expect(unresolvedIn(body, {})).toEqual([]);
  });

  // A boat with no name, or an invitation whose inviter has neither name nor e-mail on file.
  it("still read as an invitation when the metadata is empty", () => {
    const { html: body } = invitationEmail({
      email: "e@exemple.fr",
      inviteUrl: "https://xaman.boats/invite/tok",
      boatName: "",
      inviterName: "",
      roleLabel: "",
      appUrl: "https://xaman.boats",
    });
    expect(body).toContain("Le carnet du bord");
    expect(body).toContain("Vous êtes invité à rejoindre");
    expect(unresolvedIn(body, {})).toEqual([]);
  });

  it("are all declared in config.toml, with the subject the push script sends", () => {
    const subjects = subjectsFromConfig(config) as Record<string, string>;
    for (const template of templates) {
      expect(config).toContain(`[auth.email.template.${template.key}]`);
      expect(config).toContain(`content_path = "./supabase/templates/${template.file}"`);
      expect(subjects[template.key]).toBe(template.subject);
    }
  });

  /**
   * The bug this whole set was written for: with only `{{ .ConfirmationURL }}` in the template,
   * Supabase sends a magic link, and « Code par e-mail » in the sign-in screen asks for six
   * digits nobody ever received. `{{ .Token }}` is what switches it to a code.
   */
  it("send a code, not a link, wherever the app asks for six digits", () => {
    for (const key of ["magic_link", "confirmation", "reauthentication", "recovery"]) {
      const template = templates.find((t) => t.key === key);
      expect(template, key).toBeDefined();
      expect(html(template!.file), key).toContain("{{ .Token }}");
    }
  });

  /**
   * D80, extended to the recovery e-mail by D78. In GoTrue the link and the code are the same
   * one-time token, and a mailbox's anti-phishing scanner opens every URL in a message seconds
   * after it arrives — burning the token before its owner reads it. Measured here: three
   * `/verify 303` from Amazon and Azure addresses, then the human's own attempt refused. The two
   * e-mails whose token IS the journey carry nothing to open.
   */
  it("give a scanner nothing to open in the sign-in and recovery code e-mails", () => {
    for (const file of ["magic-link.html", "recovery.html"]) {
      const content = html(file);
      expect(content, file).toContain("{{ .Token }}");
      expect(content, file).not.toContain("{{ .ConfirmationURL }}");
      // The footer's `{{ .SiteURL }}` is the app's own home page, not a one-time token: a
      // scanner opening it costs nothing. Every other link would.
      expect(content.match(/<a href="(?!\{\{ \.SiteURL)/), file).toBeNull();
    }
  });

  // The invitation is the one e-mail that has something to say: which boat, from whom, as what.
  it("name the boat, the inviter and the role in the invitation", () => {
    const invite = html("invite.html");
    for (const field of ["boat_name", "inviter_name", "role_label"]) {
      expect(invite).toContain(`{{ .Data.${field} }}`);
      // A missing key renders as `<no value>` in Go templates unless it is guarded.
      expect(invite).toContain(`{{ if .Data.${field} }}`);
    }
    expect(invite).toContain("{{ .ConfirmationURL }}");
  });

  it("stay in Xaman's colours and in French", () => {
    for (const template of templates) {
      const content = html(template.file);
      expect(content, template.file).toContain('<html lang="fr">');
      // Navy plate, gilt rule, chart-paper ground — globals.css, not a stock e-mail blue.
      expect(content, template.file).toContain("#0c1b33");
      expect(content, template.file).toContain("#a38964");
      expect(content, template.file).toContain("#f6f5f1");
      expect(content, template.file).toContain(template.preheader);
    }
  });

  /**
   * An inbox has no `<link>`, no stylesheet and no custom properties: every colour has to be on
   * the element. The `<style>` block carries dark mode only, and losing it costs nothing.
   */
  it("carry their colours inline, so a client that drops <style> still reads right", () => {
    for (const template of templates) {
      const content = html(template.file);
      const withoutStyleBlock = content.replace(/<style>[\s\S]*?<\/style>/, "");
      expect(withoutStyleBlock, template.file).toContain("background-color:#0c1b33");
      expect(withoutStyleBlock, template.file).toContain("color:#0c1b33");
      expect(content.match(/<link/), template.file).toBeNull();
    }
  });

  /**
   * /dev/ui/emails is where these get looked at before anyone receives one. A placeholder the
   * preview cannot fill is a placeholder a real inbox would print as `<no value>`.
   */
  it("render in the preview with nothing left unsubstituted", () => {
    for (const template of templates) {
      expect(unresolvedPlaceholders(html(template.file)), template.file).toEqual([]);
    }
  });

  it("show the guarded branch when the invitation carries no boat name", () => {
    const bare = renderEmailPreview(html("invite.html"), {
      ...SAMPLE_VALUES,
      ".Data.boat_name": "",
      ".Data.inviter_name": "",
    });
    expect(bare).toContain("Le carnet du bord");
    expect(bare).toContain("Vous êtes invité à rejoindre");
    expect(bare).not.toContain("Xavier");
  });

  // Management API field names: a typo here is a silent no-op on a production project.
  it("build a payload the Management API understands", () => {
    const body = payload(config, html) as Record<string, string>;
    expect(Object.keys(body)).toHaveLength(templates.length * 2);
    expect(body.mailer_subjects_magic_link).toContain("{{ .Token }}");
    expect(body.mailer_templates_invite_content).toBe(html("invite.html"));
  });
});
