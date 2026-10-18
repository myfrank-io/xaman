"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MailIcon, LogInIcon } from "lucide-react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { passwordSignInSchema, type PasswordSignInInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Sign-in, one way: a password (D151). The 6-digit code used to be the second mode, and the path
 * an invitee's account was created on — both gone: an invitee now receives their password by
 * e-mail the moment an owner grants them access (`src/lib/actions/members.ts`), and signs in
 * exactly like everyone else. Nothing left to differentiate, nothing left to fail in transit.
 */
export function LoginForm({
  next,
  initialEmail,
  linkError,
}: {
  next: string;
  initialEmail?: string;
  linkError?: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [error, setError] = useState<string | null>(linkError ? t("errors.link") : null);
  const [pending, startTransition] = useTransition();

  const passwordForm = useForm<PasswordSignInInput>({
    resolver: zodResolver(passwordSignInSchema),
    defaultValues: { email: initialEmail ?? "", password: "" },
  });

  function enter() {
    startTransition(() => {
      router.replace(next as Route);
      router.refresh();
    });
  }

  async function signIn(values: PasswordSignInInput) {
    setError(null);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword(values);
    if (signInError) {
      const message = signInError.message;
      if (/email not confirmed/i.test(message)) setError(t("errors.unconfirmed"));
      else if (/invalid login credentials/i.test(message)) setError(t("errors.credentials"));
      else if (/rate limit|too many/i.test(message)) setError(t("errors.rateLimited"));
      else setError(t("errors.unexpected"));
      passwordForm.setValue("password", "");
      return;
    }
    enter();
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <Alert variant="destructive">
          <MailIcon />
          <AlertTitle>{error}</AlertTitle>
        </Alert>
      ) : null}

      <form onSubmit={passwordForm.handleSubmit(signIn)} className="flex flex-col gap-5" noValidate>
        <div className="grid gap-2">
          <Label htmlFor="email">{t("email.label")}</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("email.placeholder")}
            autoFocus={!initialEmail}
            aria-invalid={passwordForm.formState.errors.email ? true : undefined}
            {...passwordForm.register("email")}
          />
          {passwordForm.formState.errors.email ? (
            <p className="text-sm text-destructive">{t("email.invalid")}</p>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Label htmlFor="password">{t("password.label")}</Label>
          <PasswordField
            id="password"
            autoComplete="current-password"
            placeholder={t("password.placeholder")}
            aria-invalid={passwordForm.formState.errors.password ? true : undefined}
            {...passwordForm.register("password")}
          />
          <Button asChild variant="link" className="justify-self-start px-0">
            <Link href="/forgot-password">{t("password.forgot")}</Link>
          </Button>
        </div>
        <Button type="submit" size="lg" disabled={passwordForm.formState.isSubmitting || pending}>
          {passwordForm.formState.isSubmitting || pending ? <Spinner /> : <LogInIcon />}
          {t("password.submit")}
        </Button>
      </form>

      <p className="text-caption text-ink-2">
        {t("password.noAccount")}{" "}
        <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
          {t("password.createAccount")}
        </Link>
      </p>
    </div>
  );
}
