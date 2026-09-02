"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckIcon } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { acceptInvitation } from "@/lib/actions/members";
import { useErrorMessage } from "@/lib/i18n/use-error-message";

export function AcceptInvitation({ token, boatName }: { token: string; boatName: string }) {
  const t = useTranslations("invite");
  const errorMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-4">
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{errorMessage(error)}</AlertTitle>
        </Alert>
      ) : null}
      <Button
        size="lg"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await acceptInvitation({ token });
            if (result && !result.ok) setError(result.error);
          })
        }
      >
        {pending ? <Spinner /> : <CheckIcon />}
        {t("accept", { boat: boatName })}
      </Button>
    </div>
  );
}
