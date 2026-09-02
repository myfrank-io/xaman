// The /dev/ui gallery mounts the real components with sample data. It exists in development
// and on Vercel preview deployments (visual acceptance without a database), never in production.
export function devUiEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.VERCEL_ENV === "preview" || process.env.NEXT_PUBLIC_DEV_UI === "1";
}
