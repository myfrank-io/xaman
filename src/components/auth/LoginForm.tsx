"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { MailIcon, KeyRoundIcon, ArrowLeftIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { publicEnv } from "@/lib/env";
import { emailSchema, otpSchema, type EmailInput, type OtpInput } from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

type Step = { name: "email" } | { name: "code"; email: string };

// Passwordless sign-in: e-mail → 6-digit code typed here (primary), magic link in the same e-mail (fallback).
export function LoginForm({
  next,
  initialEmail,
  linkError,
  allowSignup = false,
}: {
  next: string;
  initialEmail?: string;
  linkError?: boolean;
  /** true on the invitation page: the invitee's account is created on first sign-in */
  allowSignup?: boolean;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [step, setStep] = useState<Step>({ name: "email" });
  const [error, setError] = useState<string | null>(linkError ? t("errors.link") : null);
  const [pending, startTransition] = useTransition();

  const emailForm = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialEmail ?? "" },
  });
  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email: initialEmail ?? "", token: "" },
  });

  async function sendCode(values: EmailInput) {
    setError(null);
    const supabase = createClient();
    const { error: sendError } = await supabase.auth.signInWithOtp({
      email: values.email,
      options: {
        shouldCreateUser: allowSignup,
        emailRedirectTo: `${publicEnv.appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
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
    startTransition(() => {
      router.replace(next as Route);
      router.refresh();
    });
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
        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setError(null);
              setStep({ name: "email" });
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
    <form onSubmit={emailForm.handleSubmit(sendCode)} className="flex flex-col gap-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <MailIcon />
          <AlertTitle>{error}</AlertTitle>
          <AlertDescription>{t("errors.hint")}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="email">{t("email.label")}</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={t("email.placeholder")}
          autoFocus={!initialEmail}
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
  );
}
