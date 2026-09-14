"use client";

import { InboxBatchReview, type InboxBatchReviewProps } from "@/components/inbox/InboxBatchReview";

/**
 * The gallery's client edge. The screen takes an `onSubmit`, which a Server Component may not
 * hand it; here it does nothing, because the preview exists to be looked at and measured, not to
 * write a carnet.
 */
export function DevBatch(props: Omit<InboxBatchReviewProps, "onSubmit">) {
  return <InboxBatchReview {...props} onSubmit={() => undefined} />;
}
