"use client";

import { useState } from "react";

import { InstallDialog } from "@/components/pwa/InstallDialog";
import { Button } from "@/components/ui/button";

/**
 * The install dialog on its own, with a stubbed browser state: it is the one dialog nobody
 * can open on demand (it depends on `beforeinstallprompt`), and it shipped with its text cut
 * in half by the action bar. Mounting it here puts it under the touch audit like the rest.
 */
export function DevInstallDialog() {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex flex-col gap-3">
      <Button type="button" variant="outline" className="self-start" onClick={() => setOpen(true)}>
        Ouvrir le dialogue d’installation
      </Button>
      <InstallDialog
        open={open}
        onOpenChange={setOpen}
        prompt={{
          ready: true,
          standalone: false,
          platform: "ios",
          ios: true,
          sessions: 2,
          dismissed: false,
          promptEvent: null,
          installable: true,
          bannerEligible: false,
          install: async () => false,
          dismiss: () => undefined,
        }}
      />
    </div>
  );
}
