import { z } from "zod";

import { nullableText, uuid } from "@/lib/schemas/common";

/** A message is a few lines for the yard, never a specification. */
export const HANDOFF_MESSAGE_MAX = 1000;

/**
 * « Confier au chantier » (E19-11, D141): a checklist point is handed to a provider of the
 * boat's directory. The Server Action writes a *planned* intervention that is the doing of the
 * point (`maintenance_logs.checklist_item_id`, D140) and mails the provider everything they
 * need to answer. `logId` is drawn when the sheet opens, so a double tap writes one line
 * (rule 11).
 */
export const handOverItemSchema = z.object({
  boatId: uuid,
  itemId: uuid,
  logId: uuid,
  contactId: uuid,
  message: nullableText(HANDOFF_MESSAGE_MAX),
});

export type HandOverItemInput = z.output<typeof handOverItemSchema>;
