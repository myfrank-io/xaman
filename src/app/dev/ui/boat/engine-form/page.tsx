import { EngineForm } from "@/components/engines/EngineForm";

import { DEV_BOAT_ID, DevShell } from "../../DevShell";

export default function DevEngineFormPage() {
  return (
    <DevShell>
      <EngineForm boatId={DEV_BOAT_ID} engine={null} />
    </DevShell>
  );
}
