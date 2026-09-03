"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MailCheckIcon, TriangleAlertIcon, UserPlusIcon } from "lucide-react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { callbackUrl } from "@/lib/auth/redirect";
import { signUpSchema, type SignUpInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Opening an account (D26): a name, an address, a password.
 *
 * The name is asked for straight away and is not decoration — it is what appears next to
 * everything this person notes in the logbook, and a boat's history signed « unknown » is
 * worth much less.
 *
 * Whether a confirmation e-mail is required is the Supabase project's setting, not ours: when
 * the sign-up comes back with a session the person is already in, otherwise they are told to
 * go and open the e-mail. Both are handled, so turning the setting on or off never breaks
 * this screen.
 */
export function SignupForm({ next }: { next: string }) {
  const t = useTranslations("auth.signup");
  const ta = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const form = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { fullName: "", email: "", password: "", confirm: "" },
  });

  async function submit(values: SignUpInput) {
    setError(null);
    const supabase = createClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { full_name: values.fullName },
        emailRedirectTo: callbackUrl(next),
      },
    });

    if (signUpError) {
      const message = signUpError.message;
      if (/already registered|already been registered|user already/i.test(message)) {
        setError(t("errors.taken"));
      } else if (/password/i.test(message)) setError(t("errors.weak"));
      else if (/rate limit|too many/i.test(message)) setError(ta("errors.rateLimited"));
      else setError(t("errors.failed"));
      return;
    }

    if (data.session) {
      startTransition(() => {
        router.replace(next as Route);
        router.refresh();
      });
      return;
    }
    setSentTo(values.email);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col gap-5">
        <Alert>
          <MailCheckIcon />
          <AlertTitle>{t("checkEmail.title")}</AlertTitle>
          <AlertDescription>{t("checkEmail.description", { email: sentTo })}</AlertDescription>
        </Alert>
        <p className="text-caption text-ink-2">{t("checkEmail.spam")}</p>
        <Button asChild size="lg" className="self-start">
          <Link href="/login">{t("signIn")}</Link>
        </Button>
      </div>
    );
  }

  const errors = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(submit)} className="flex flex-col gap-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="full-name">{t("name")}</Label>
        <Input
          id="full-name"
          autoComplete="name"
          autoCapitalize="words"
          placeholder={t("namePlaceholder")}
          autoFocus
          aria-invalid={errors.fullName ? true : undefined}
          {...form.register("fullName")}
        />
        {errors.fullName ? (
          <p className="text-sm text-destructive">{t("errors.nameRequired")}</p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="signup-email">{ta("email.label")}</Label>
        <Input
          id="signup-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={ta("email.placeholder")}
          aria-invalid={errors.email ? true : undefined}
          {...form.register("email")}
        />
        {errors.email ? <p className="text-sm text-destructive">{ta("email.invalid")}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="signup-password">{t("password")}</Label>
        <PasswordField
          id="signup-password"
          autoComplete="new-password"
          aria-invalid={errors.password ? true : undefined}
          {...form.register("password")}
        />
        <p className="text-caption text-ink-3">{t("passwordHelp")}</p>
        {errors.password ? <p className="text-sm text-destructive">{t("errors.weak")}</p> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="signup-confirm">{t("confirm")}</Label>
        <PasswordField
          id="signup-confirm"
          autoComplete="new-password"
          aria-invalid={errors.confirm ? true : undefined}
          {...form.register("confirm")}
        />
        {errors.confirm ? <p className="text-sm text-destructive">{t("errors.mismatch")}</p> : null}
      </div>

      <Button type="submit" size="xl" disabled={form.formState.isSubmitting || pending}>
        {form.formState.isSubmitting || pending ? <Spinner /> : <UserPlusIcon />}
        {t("submit")}
      </Button>

      <p className="text-caption text-ink-3">{t("legal")}</p>
      <p className="text-caption text-ink-2">
        {t("haveAccount")}{" "}
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          {t("signIn")}
        </Link>
      </p>
    </form>
  );
}
