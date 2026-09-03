"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Field } from "@/components/forms/Field";
import { useFieldError } from "@/components/forms/use-field-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { upsertPart } from "@/lib/actions/parts";
import { useErrorMessage } from "@/lib/i18n/use-error-message";
import { upsertPartSchema } from "@/lib/schemas/parts";

/**
 * « Noter une pièce à racheter » (D63): a one-field door to add a spare part straight from the
 * restock checklist, without leaving the screen for Bateau. The note *is* the stock line —
 * there is no separate to-buy list — so it enters `parts` with 0 in reserve and a threshold of
 * 1, which puts it at once in « À racheter » and in the stock (JAMAIS de double saisie). The
 * rest of the sheet (real threshold, place aboard, supplier) is filled later from Bateau.
 */
export function QuickRestockAdd({ boatId }: { boatId: string }) {
  const t = useTranslations("restock");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <PlusIcon />
          {t("add")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addTitle")}</DialogTitle>
          <DialogDescription>{t("addHelp")}</DialogDescription>
        </DialogHeader>
        {/* Mounted with the dialog: fresh field and a fresh id at every opening. */}
        {open ? <QuickRestockForm boatId={boatId} onClose={() => setOpen(false)} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function QuickRestockForm({ boatId, onClose }: { boatId: string; onClose: () => void }) {
  const t = useTranslations("restock");
  const tc = useTranslations("common");
  const errorMessage = useErrorMessage();
  const fieldError = useFieldError();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = upsertPartSchema.safeParse({
      // A fresh id per opening (rule 11): a double tap on the trigger is still one row.
      id: crypto.randomUUID(),
      boatId,
      name,
      reference: null,
      // 0 in reserve under a threshold of 1: the line is « à racheter » the instant it exists.
      quantity: 0,
      minQuantity: 1,
      unit: "pc",
      location: null,
      categoryId: null,
      supplierContactId: null,
      notes: null,
    });
    if (!parsed.success) {
      const issue = parsed.error.issues.find((candidate) => candidate.path[0] === "name");
      setError(
        issue
          ? fieldError({ type: issue.code, message: issue.message })
          : errorMessage("errors.invalid"),
      );
      return;
    }
    setError(undefined);
    startTransition(async () => {
      const result = await upsertPart(parsed.data);
      if (!result.ok) {
        toast.error(errorMessage(result.error));
        return;
      }
      toast.success(t("added", { name: parsed.data.name }));
      router.refresh();
      onClose();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field id="quick-restock-name" label={t("nameLabel")} required error={error}>
        <Input
          id="quick-restock-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          autoComplete="off"
          autoFocus
          enterKeyHint="done"
          aria-invalid={error ? true : undefined}
        />
      </Field>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            {tc("cancel")}
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <Spinner className="size-4" /> : null}
          {pending ? tc("saving") : tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
