import { z } from "zod";

import { expectedUpdatedAt, nullableText, requiredText, uuid } from "@/lib/schemas/common";

// Closed list of suggestions (DATA-MODEL §3.11); the column stays free text, « Autre » opens it.
export const CONTACT_SPECIALTIES = [
  "yard",
  "sailmaker",
  "electronics",
  "engine",
  "rigger",
  "outboard",
  "chandlery",
  "other",
] as const;
export type ContactSpecialty = (typeof CONTACT_SPECIALTIES)[number];

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export const upsertContactSchema = z.object({
  id: uuid,
  boatId: uuid,
  expectedUpdatedAt,
  name: requiredText(120),
  /**
   * Optional: a provider written down with a phone number and no trade is still worth having,
   * and the trade is a filter rather than an identity. The column is NOT NULL, so an unanswered
   * question is stored as an empty string — which every screen already reads as « Autre »
   * (`groupBySpecialty`), with no migration and no null to guard against.
   */
  specialty: z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : ""),
    z.string().max(60),
  ),
  company: nullableText(120),
  phone: nullableText(40),
  email: z.preprocess(emptyToNull, z.string().trim().email().max(160).nullable()),
  address: nullableText(300),
  notes: nullableText(2000),
});
export type UpsertContactInput = z.input<typeof upsertContactSchema>;

/** Move a provider to the trash, or bring them back from « Annuler » (D41). */
export const trashContactSchema = z.object({
  boatId: uuid,
  contactId: uuid,
});
