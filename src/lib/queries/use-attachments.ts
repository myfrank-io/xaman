"use client";

import { useQuery } from "@tanstack/react-query";

import { hasSupabaseEnv } from "@/lib/env";
import { listAttachments, type AttachmentItem } from "@/lib/queries/attachments";
import { boatKeys } from "@/lib/queries/keys";
import type { AttachmentOwner } from "@/lib/schemas/attachments";
import { createClient } from "@/lib/supabase/client";

export type { AttachmentItem };

const STALE_MS = 10 * 60_000;
/** Shorter than the hour a signed URL lives, so a restored cache never serves a dead link. */
const GC_MS = 50 * 60_000;

/**
 * Documents of one intervention or one purchase (E10-1). `initial` is what the server already
 * rendered — the gallery is never empty for a blink — and the query refreshes it (and its
 * signed URLs) in the background. Without Supabase configured (the /dev/ui gallery) it simply
 * never runs and `initial` is all there is.
 */
export function useAttachments({
  boatId,
  owner,
  initial,
  enabled = true,
}: {
  boatId: string;
  owner: AttachmentOwner | null;
  initial?: AttachmentItem[];
  enabled?: boolean;
}) {
  const query = useQuery({
    queryKey: boatKeys.attachments(boatId, owner?.type ?? "", owner?.id ?? ""),
    queryFn: () => listAttachments(createClient(), boatId, owner as AttachmentOwner),
    enabled: enabled && Boolean(owner) && hasSupabaseEnv(),
    initialData: initial,
    staleTime: STALE_MS,
    gcTime: GC_MS,
  });
  return { ...query, items: query.data ?? initial ?? [] };
}
