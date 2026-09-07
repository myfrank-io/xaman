"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, KeyRoundIcon, SendIcon, TriangleAlertIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { requestPasswordReset } from "@/lib/actions/auth";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import {
  OTP_MAX,
  emailSchema,
  otpSchema,
  type EmailInput,
  type OtpInput,
} from "@/lib/schemas/auth";
import { createClient } from "@/lib/supabase/client";

/**
 * Asking for a new password.
 *
 * A code typed here, not a link followed from the inbox (D78). The recovery link and the
 * recovery code are one one-time token, and a mailbox's anti-phishing scanner opens every URL in
 * a message seconds after it arrives — which is what « le mail de mot de passe oublié ne
 * fonctionne pas » was: the token consumed before its owner read it. The same fix as the sign-in
 * code (D76), and the same shape of screen: an address, then the code.
 *
 * The answer is the same whether the account exists or not: telling a stranger which addresses
 * have an account here is telling them who sails with whom.
 */
export function ForgotPasswordForm({
  /**
   * Pins the step instead of starting on the address. Only `/dev/ui/forgot-password` passes it:
   * the second face is only reachable with an e-mail in hand, so without the seam neither the
   * preview nor the touch audit could ever see it.
   */
  initialStep,
}: {
  initialStep?: { name: "code"; email: string };
} = {}) {
  const t = useTranslations("auth.forgot");
  const ta = useTranslations("auth");
  const errorMessage = useErrorMessage();
  const router = useRouter();
  const [step, setStep] = useState<{ name: "email" } | { name: "code"; email: string }>(
    initialStep ?? { name: "email" },
  );
  const [error, setError] = useState<string | null>(null);
  /**
   * « Renvoyer le code » is not a form submit, so react-hook-form never marks it busy — and a
   * second code cancels the first (rule 11, and the warning under the field).
   */
  const [resending, setResending] = useState(false);
  const [pending, startTransition] = useTransition();

  const emailForm = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: initialStep?.email ?? "" },
  });
  const otpForm = useForm<OtpInput>({
    resolver: zodResolver(otpSchema),
    defaultValues: { email: initialStep?.email ?? "", token: "" },
  });

  async function send(values: EmailInput) {
    setError(null);
    const result = await requestPasswordReset(values);
    if (!result.ok) {
      setError(errorMessage(result.error));
      return;
    }
    otpForm.setValue("email", values.email);
    otpForm.setValue("token", "");
    setStep({ name: "code", email: values.email });
  }

  async function verify(values: OtpInput) {
    setError(null);
    const supabase = createClient();
    // The recovery code opens a session, and only that: `/reset-password` is where the new
    // password is written, and it refuses to show itself without this session.
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: values.email,
      token: values.token,
      type: "recovery",
    });
    if (verifyError) {
      setError(t("errors.code"));
      otpForm.setValue("token", "");
      return;
    }
    startTransition(() => {
      router.replace("/reset-password");
      router.refresh();
    });
  }

  if (step.name === "code") {
    return (
      <form onSubmit={otpForm.handleSubmit(verify)} className="flex flex-col gap-5" noValidate>
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
          <Label htmlFor="recovery-otp">{t("code.label")}</Label>
          <Input
            id="recovery-otp"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={OTP_MAX}
            autoFocus
            // Ten digits have to fit on a 320 px screen: the tracking is what gives way, not
            // the 16 px floor on the text.
            className="h-14 text-center font-mono text-2xl tracking-[0.3em]"
            aria-invalid={otpForm.formState.errors.token ? true : undefined}
            {...otpForm.register("token")}
          />
        </div>
        <Button type="submit" size="lg" disabled={otpForm.formState.isSubmitting || pending}>
          {otpForm.formState.isSubmitting || pending ? <Spinner /> : <KeyRoundIcon />}
          {t("code.submit")}
        </Button>
        <div className="flex flex-wrap items-center justify-between gap-2">
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
            disabled={resending}
            onClick={async () => {
              setResending(true);
              try {
                await send({ email: step.email });
              } finally {
                setResending(false);
              }
            }}
          >
            {resending ? <Spinner /> : null}
            {t("code.resend")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t("code.linkHint")}</p>
      </form>
    );
  }

  return (
    <form onSubmit={emailForm.handleSubmit(send)} className="flex flex-col gap-5" noValidate>
      {error ? (
        <Alert variant="destructive">
          <TriangleAlertIcon />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="grid gap-2">
        <Label htmlFor="forgot-email">{ta("email.label")}</Label>
        <Input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          placeholder={ta("email.placeholder")}
          autoFocus
          aria-invalid={emailForm.formState.errors.email ? true : undefined}
          {...emailForm.register("email")}
        />
        {emailForm.formState.errors.email ? (
          <p className="text-sm text-destructive">{ta("email.invalid")}</p>
        ) : null}
      </div>
      <Button type="submit" size="lg" disabled={emailForm.formState.isSubmitting}>
        {emailForm.formState.isSubmitting ? <Spinner /> : <SendIcon />}
        {t("submit")}
      </Button>
      <Button asChild variant="ghost" className="self-start">
        <Link href="/login">
          <ArrowLeftIcon />
          {t("back")}
        </Link>
      </Button>
    </form>
  );
}
