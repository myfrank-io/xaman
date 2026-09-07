/**
 * Fills a Supabase Auth template with real values.
 *
 * Not a Go template engine: it understands exactly the two forms the templates use — a value,
 * and a guard around a value that may be missing (`{{ if .Data.boat_name }}…{{ else }}…{{ end }}`).
 * That is deliberate. A third form should surface here, loudly, rather than reach an inbox as
 * `<no value>`.
 *
 * Two callers: `/dev/ui/emails`, which fills the six with samples so they can be looked at, and
 * the invitation the app sends itself (D75), which fills the real one with the real boat.
 */
export type TemplateValues = Record<string, string>;

const GUARD = /\{\{ if (\.[\w.]+) \}\}([\s\S]*?)(?:\{\{ else \}\}([\s\S]*?))?\{\{ end \}\}/g;
const VALUE = /\{\{ (\.[\w.]+) \}\}/g;

export function renderTemplate(html: string, values: TemplateValues): string {
  return html
    .replace(GUARD, (_, name: string, then: string, otherwise = "") =>
      values[name] ? then : otherwise,
    )
    .replace(VALUE, (match, name: string) => values[name] ?? match);
}

/** Every placeholder left unfilled — what an inbox would print as `<no value>`. */
export function unresolvedPlaceholders(html: string, values: TemplateValues): string[] {
  return [...new Set(renderTemplate(html, values).match(/\{\{[^}]*\}\}/g) ?? [])];
}
