import type { FieldErrors, FieldValues, Resolver } from "react-hook-form";
import type { z } from "zod";

function setPath(target: Record<string, unknown>, path: PropertyKey[], value: unknown) {
  let node = target;
  path.forEach((segment, index) => {
    const key = String(segment);
    if (index === path.length - 1) {
      if (!(key in node)) node[key] = value;
      return;
    }
    const next = node[key];
    if (typeof next !== "object" || next === null) {
      node[key] = typeof path[index + 1] === "number" ? [] : {};
    }
    node = node[key] as Record<string, unknown>;
  });
}

/**
 * react-hook-form resolver over a shared zod schema (CLAUDE.md rule 6). The form holds text
 * (what the keyboard produces); the schema turns it into the typed payload sent to the Server
 * Action. Issue codes and messages are kept raw: `useFieldError()` translates them.
 */
export function formResolver<TForm extends FieldValues, TOutput>(
  schema: z.ZodType<TOutput>,
): Resolver<TForm, unknown, TOutput> {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.length ? issue.path : ["root"];
      setPath(errors, path as PropertyKey[], { type: issue.code, message: issue.message });
    }
    return { values: {}, errors: errors as FieldErrors<TForm> };
  };
}
