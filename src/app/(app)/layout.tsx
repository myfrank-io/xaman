import { QueryProvider } from "@/components/providers/QueryProvider";

// Everything under (app) depends on the session cookie: never prerendered.
export const dynamic = "force-dynamic";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
