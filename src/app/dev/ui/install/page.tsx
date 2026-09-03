import { PageHeader } from "@/components/common/PageHeader";

import { DEV_BOAT_ID, DevShell } from "../DevShell";
import { DevInstallDialog } from "./DevInstallDialog";

/** Visual acceptance of the install dialog (E7-2) at any viewport height. */
export default function DevInstallPage() {
  void DEV_BOAT_ID;
  return (
    <DevShell>
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Installer l’application"
          subtitle="Le dialogue seul, pour vérifier qu’aucun texte ne passe sous la barre d’actions."
        />
        <DevInstallDialog />
      </div>
    </DevShell>
  );
}
