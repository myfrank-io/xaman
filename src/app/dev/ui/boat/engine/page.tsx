import { EngineSheet } from "@/components/engines/EngineSheet";

import { DEV_BOAT_ID, DevShell } from "../../DevShell";
import {
  SAMPLE_ENGINE_DETAIL,
  SAMPLE_ENGINE_ITEMS,
  SAMPLE_ENGINE_LOGS,
  SAMPLE_ENGINE_READINGS,
} from "../sample";

export default function DevEnginePage() {
  return (
    <DevShell>
      <EngineSheet
        boatId={DEV_BOAT_ID}
        engine={SAMPLE_ENGINE_DETAIL}
        currentHours={1256}
        currentReadAt="2026-08-28"
        currentByName="Xavier Marin"
        items={SAMPLE_ENGINE_ITEMS}
        readings={SAMPLE_ENGINE_READINGS}
        logs={SAMPLE_ENGINE_LOGS}
        linkedCount={6}
        hasTemplate
        canWrite
        canContribute
      />
    </DevShell>
  );
}
