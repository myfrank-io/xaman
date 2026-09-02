import type { PostgrestError } from "@supabase/supabase-js";
import type { z } from "zod";

// Uniform Server Action result: the UI never receives a thrown error, only a translatable key.
export type ActionResult<T = undefined> =
  { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

// Validates raw input with the shared zod schema (CLAUDE.md rule 6).
export function parseInput<S extends z.ZodType>(
  schema: S,
  input: unknown,
): { ok: true; data: z.output<S> } | { ok: false; result: ActionResult<never> } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { ok: true, data: parsed.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    (fieldErrors[key] ??= []).push(issue.message);
  }
  return { ok: false, result: fail("errors.invalid", fieldErrors) };
}

// Maps a Postgres / PostgREST error to an i18n key under `errors.*`.
export function dbErrorKey(error: PostgrestError | { code?: string; message: string }): string {
  const code = error.code ?? "";
  const message = error.message ?? "";
  if (code === "42501" || /row-level security/i.test(message)) return "errors.forbidden";
  if (code === "23505") return "errors.duplicate";
  if (code === "23503") return "errors.reference";
  if (code === "23514" || code === "22023") return "errors.invalid";
  if (code === "P0001" || code === "P0002") {
    const known = [
      "last_owner",
      "invitation_not_found",
      "invitation_accepted",
      "invitation_revoked",
      "invitation_expired",
      "invitation_email_mismatch",
      "engine_hours_required",
      "template_not_found",
      "log_not_found",
    ];
    const hit = known.find((k) => message.includes(k));
    if (hit) return `errors.${hit}`;
  }
  return "errors.unknown";
}
