"use client";

import { useState } from "react";
import { FlameIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import type { ContactOption } from "@/components/contacts/specialties";
import { GasBottleDialog, type GasDefaults } from "@/components/supplies/GasBottleDialog";
import { Button } from "@/components/ui/button";
import type { GasFacts } from "@/lib/gas";

/**
 * Named shortcut of the gas view (E5-3), not a second « + »: the app's « + » creates a
 * purchase, this one records a bottle change in five taps. `defaultOpen` is what
 * `?tab=gas` (the « + » sheet entry) lands on.
 */
export function GasBottleEntry({
  boatId,
  contacts,
  defaults,
  facts,
  defaultOpen = false,
}: {
  boatId: string;
  contacts: ContactOption[];
  defaults: GasDefaults;
  facts: GasFacts;
  defaultOpen?: boolean;
}) {
  const t = useTranslations("supplies.gas");
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      {/* self-start: a column layout would otherwise stretch it into a heavy full-width bar. */}
      <Button type="button" size="lg" className="self-start" onClick={() => setOpen(true)}>
        <FlameIcon />
        {t("open")}
      </Button>
      <GasBottleDialog
        boatId={boatId}
        open={open}
        onOpenChange={setOpen}
        contacts={contacts}
        defaults={defaults}
        facts={facts}
      />
    </>
  );
}
