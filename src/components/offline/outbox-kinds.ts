"use client";

import { completeChecklistItem } from "@/lib/actions/checklist";
import { saveLog } from "@/lib/actions/logs";
import { upsertPart } from "@/lib/actions/parts";
import { upsertPurchase } from "@/lib/actions/purchases";
import type { ActionResult } from "@/lib/actions/result";
import type { OutboxKind } from "@/lib/outbox";

/**
 * Which Server Action replays a queued creation (E9-1b). All four upsert on the id drawn by
 * the form, so an entry that did reach the server before the tab was closed replays as a no-op.
 * Only creations are listed: replaying an edit could overwrite someone else's change (D25).
 */
export const OUTBOX_ACTIONS: Record<
  OutboxKind,
  (input: unknown) => Promise<ActionResult<unknown>>
> = {
  log: saveLog,
  purchase: upsertPurchase,
  part: upsertPart,
  completion: completeChecklistItem,
};
