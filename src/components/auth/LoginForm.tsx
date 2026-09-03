"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MailIcon, KeyRoundIcon, ArrowLeftIcon, LogInIcon } from "lucide-react";

import { PasswordField } from "@/components/auth/PasswordField";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { callbackUrl } from "@/lib/auth/redirect";
import {
  emailSchema,
  otpSchema,
  passwordSignInSchema,
  type EmailInput,
  type OtpInput,
  type PasswordSignInInput,
} from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

type Step = { name: "form" } | { name: "code"; email: string };
/** Password is the default: it is the sign-in everyone already knows (D26). */
type Mode = "password" | "code";

/**
 * Sign-in, two ways. A password, like everywhere else, or a 6-digit code sent by e-mail for
 * anyone who would rather not have one — the code path also serves the people invited onto a
 * boat, whose account is created on their first sign-in.
 */
export function LoginForm({
  next,
  initialEmail,
  linkError,
  allowSignup = false,
  initialMode = "password",
}: {
  next: string;
  initialEmail?: string;
  linkError?: boolean;
  /** true on the invitation page: the invitee's account is created on first sign-in */
  allowSignup?: boolean;
  initialMode?: Mode;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  // An invitee has no password yet, so the invitation page opens on the code.
  const [mode, setMode] = useState<Mode>(allowSignup ? "code" : initialMode);
  const [step, setStep] = useState<Step>({ name: "form" });
  const [error, setError] = useState<string | null>(linkError ? t("errors.link") : null);
  const [pending, startTransition] = useTransition();

  const passwordForm = useForm<PasswordSignInInput>({
    resolver: zodResolver(passwordSignInSchema),
    defaultValues: { email: initialEmail ?? "", password: "" },
  });
  const emailForm = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialEmail ?? "" },
  });
  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email: initialEmail ?? "", token: "" },
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

  async function sendCode(values: EmailInput) {
    setError(null);
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        shouldCreateUser: allowSignup,
        emailRedirectTo: callbackUrl(next),
      },
    });
    if (sendError) {
      setError(
        /signups not allowed/i.test(sendError.message) ? t("errors.noAccount") : t("errors.send"),
      );
      return;
    }
    otpForm.setValue("email", values.email);
    otpForm.setValue("token", "");
    setStep({ name: "code", email: values.email });
  }

  async function verifyCode(values: OtpInput) {
    setError(null);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: values.email,
      token: values.token,
      type: "email",
    });
    if (verifyError) {
      setError(t("errors.code"));
      otpForm.setValue("token", "");
      return;
    }
    enter();
  }

  if (step.name === "code") {
    return (
      <form onSubmit={otpForm.handleSubmit(verifyCode)} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold">{t("code.title")}</h2>
          <p className="text-sm text-muted-foreground">{t("code.help", { email: step.email })}</p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <KeyRoundIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : null}
        <div className="grid gap-2">
          <Label htmlFor="otp">{t("code.label")}</Label>
          <Input
            id="otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            autoFocus
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            aria-invalid={otpForm.formState.errors.token ? true : undefined}
            {...otpForm.register("token")}
          />
        </div>
        <Button type="submit" size="lg" disabled={otpForm.formState.isSubmitting || pending}>
          {otpForm.formState.isSubmitting || pending ? <Spinner /> : null}
          {t("code.submit")}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setStep({ name: "form" });
            }}
          >
            <ArrowLeftIcon />
            {t("code.back")}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={emailForm.formState.isSubmitting}
            onClick={() => sendCode({ email: step.email })}
          >
            {t("code.resend")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("code.linkHint")}</p>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <span id="signin-mode" className="text-label text-ink-2">
          {t("modes.label")}
        </span>
        <ToggleGroup
          type="single"
          value={mode}
          aria-labelledby="signin-mode"
          onValueChange={(value) => {
            if (value === "password" || value === "code") {
              setError(null);
              setMode(value);
            }
          }}
        >
          <ToggleGroupItem value="password">{t("modes.password")}</ToggleGroupItem>
          <ToggleGroupItem value="code">{t("modes.code")}</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {error ? (
        <Alert variant="destructive">
          <MailIcon />
          <AlertTitle>{error}</AlertTitle>
          <AlertDescription>{t("errors.hint")}</AlertDescription>
        </Alert>
      ) : null}

      {mode === "password" ? (
        <form
          onSubmit={passwordForm.handleSubmit(signIn)}
          className="flex flex-col gap-5"
          noValidate
        >
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
      ) : (
        <form
          onSubmit={emailForm.handleSubmit(sendCode)}
          className="flex flex-col gap-5"
          noValidate
        >
          <div className="grid gap-2">
            <Label htmlFor="email-code">{t("email.label")}</Label>
            <Input
              id="email-code"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder={t("email.placeholder")}
              aria-invalid={emailForm.formState.errors.email ? true : undefined}
              {...emailForm.register("email")}
            />
            {emailForm.formState.errors.email ? (
              <p className="text-sm text-destructive">{t("email.invalid")}</p>
            ) : null}
          </div>
          <Button type="submit" size="lg" disabled={emailForm.formState.isSubmitting}>
            {emailForm.formState.isSubmitting ? <Spinner /> : <MailIcon />}
            {t("email.submit")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("email.help")}</p>
        </form>
      )}

      {allowSignup ? null : (
        <p className="text-caption text-ink-2">
          {t("password.noAccount")}{" "}
          <Link href="/signup" className="font-medium text-foreground underline underline-offset-4">
            {t("password.createAccount")}
          </Link>
        </p>
      )}
    </div>
  );
}
