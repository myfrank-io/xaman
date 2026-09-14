import { BoatModel3D } from "@/components/boat-3d/BoatModel3D";
import { Translations } from "@/i18n/Translations";
import { BOAT_SECTIONS } from "@/i18n/slices";

import { DEV_BOAT_ID, DevShell } from "../../DevShell";
import { SAMPLE_BOAT, SAMPLE_MODEL } from "../sample";

const OTHERS = [
  { key: "monohull", type: "monohull_sail", length: 12, beam: 3.9, draft: 1.9 },
  { key: "trimaran", type: "trimaran", length: 15, beam: 11, draft: 1.2 },
  { key: "motor", type: "motor", length: 11, beam: 3.6, draft: 0.9 },
  { key: "rib", type: "rib", length: 6.5, beam: 2.5, draft: 0.5 },
] as const;

/**
 * Visual acceptance of the 3D model (E2-8, D117). The catamaran first, with the real spread of
 * states, then one boat of each other type — the hull the builder draws when the carnet says
 * « monocoque » has to be checked as much as the one it draws for Xaman.
 */
export default async function DevBoatModelPage() {
  return (
    <DevShell>
      <Translations of={BOAT_SECTIONS.boat}>
        <div className="flex flex-col gap-8">
          <BoatModel3D boatId={DEV_BOAT_ID} boatName={SAMPLE_BOAT.name} data={SAMPLE_MODEL} />
          {OTHERS.map((other) => (
            <BoatModel3D
              key={other.key}
              boatId={DEV_BOAT_ID}
              boatName={other.key}
              data={{
                ...SAMPLE_MODEL,
                shape: {
                  type: other.type,
                  lengthM: other.length,
                  beamM: other.beam,
                  draftM: other.draft,
                  engines: [{ id: "dev-engine", position: "center" }],
                },
                engines: [{ id: "dev-engine", label: "Moteur" }],
              }}
            />
          ))}
        </div>
      </Translations>
    </DevShell>
  );
}
