import { PageHeader } from "@/components/common/PageHeader";

import { DevShell } from "../DevShell";
import { DevDialogs, type DevDialogKey } from "./DevDialogs";

const KEYS: DevDialogKey[] = ["complete", "hours", "edit-reading", "contact", "recurring"];

/**
 * Visual acceptance of the dialogs. Each is closed on load, so the touch audit had never
 * measured one — and they are where the app asks for a date, a counter and a note at once, in
 * a box that has to fit above a phone keyboard. `?d=` opens exactly one.
 */
export default async function DevDialogsPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const which = KEYS.includes(d as DevDialogKey) ? (d as DevDialogKey) : null;

  return (
    <DevShell>
      <div className="flex flex-col gap-6 pb-16">
        <PageHeader
          title="Dialogues"
          subtitle="Ajoutez ?d=complete, hours, edit-reading, contact ou recurring."
        />
        <DevDialogs which={which} />
      </div>
    </DevShell>
  );
}
