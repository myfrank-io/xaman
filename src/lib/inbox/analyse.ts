import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import { extractText, isExtractable } from "@/lib/inbox/extract";
import { heuristicSuggestion } from "@/lib/inbox/heuristics";
import {
  ANALYSABLE_IMAGE_TYPES,
  INBOX_SYSTEM_PROMPT,
  contextText,
  inboxModelOutputSchema,
  isAnalysable,
  normaliseSuggestion,
  type InboxContext,
} from "@/lib/inbox/prompt";
import { todayString } from "@/lib/format";
import { ATTACHMENT_BUCKET } from "@/lib/schemas/attachments";
import type { InboxErrorKey, InboxSuggestion } from "@/lib/schemas/inbox";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Reads one document of the inbox and writes what it proposes (D91, D92).
 *
 * Runs with the service key, because it runs where there is no session: after the webhook has
 * answered the mailer, or behind a Server Action on behalf of the person who took the photo. The
 * row was created by a path that already checked the right to create it; this function only
 * reads the boat's vocabulary and fills `suggestion`.
 *
 * Two readers, one outcome. The local reader — the PDF's text layer or Tesseract on a photo,
 * then the rules of `heuristics.ts` — is always there and costs nothing (D92). Claude reads
 * instead when `ANTHROPIC_API_KEY` is set, and the local reader takes over if that call fails:
 * a document nobody can validate is a document lost, so the row comes out `ready` whatever
 * happens — with a suggestion, or with an `error_key` that says why there is none, and a person
 * can always file it by hand from the same card. It never ends on an exception and never leaves
 * a row in `analysing`.
 */
export const INBOX_MODEL = "claude-opus-5";

/** Whether the model reads the documents; without the key, the local reader does. */
export function claudeConfigured(): boolean {
  return (process.env.ANTHROPIC_API_KEY ?? "") !== "";
}

export type AnalysisOutcome = { suggestion: InboxSuggestion | null; error: InboxErrorKey | null };

type InboxRow = {
  id: string;
  boat_id: string;
  file_name: string;
  mime_type: string;
  subject: string | null;
  sender_name: string | null;
  sender_email: string | null;
};

export async function analyseInboxItem(itemId: string): Promise<AnalysisOutcome> {
  const admin = createAdminClient();
  const { data: item, error: readError } = await admin
    .from("inbox_items")
    .select(
      "id, boat_id, status, file_name, mime_type, storage_path, subject, sender_name, sender_email",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (readError || !item) {
    console.error("inbox: item not found for analysis", itemId, readError?.message);
    return { suggestion: null, error: "analysis" };
  }
  // A validated or dismissed document is never re-read: the person has spoken.
  if (item.status === "validated" || item.status === "dismissed") {
    return { suggestion: null, error: null };
  }

  const finish = async (outcome: AnalysisOutcome) => {
    const { error } = await admin
      .from("inbox_items")
      .update({ status: "ready", suggestion: outcome.suggestion, error_key: outcome.error })
      .eq("id", itemId);
    if (error) console.error("inbox: could not store the analysis", error.message);
    return outcome;
  };

  const claude = claudeConfigured();
  if (!(claude ? isAnalysable(item.mime_type) : isExtractable(item.mime_type))) {
    return finish({ suggestion: null, error: "unsupportedFormat" });
  }

  await admin.from("inbox_items").update({ status: "analysing" }).eq("id", itemId);

  try {
    const [context, file] = await Promise.all([
      loadContext(admin, item.boat_id),
      admin.storage.from(ATTACHMENT_BUCKET).download(item.storage_path),
    ]);
    if (file.error || !file.data) {
      console.error("inbox: could not download the document", file.error?.message);
      return finish({ suggestion: null, error: "download" });
    }
    const bytes = Buffer.from(await file.data.arrayBuffer());

    if (claude) {
      const outcome = await readWithClaude(item, bytes, context);
      // A refusal is an answer; anything else is a reason to read locally instead.
      if (outcome.suggestion || outcome.error === "refused") return finish(outcome);
      if (!isExtractable(item.mime_type)) return finish(outcome);
    }
    return finish(await readLocally(item, bytes, context));
  } catch (error) {
    console.error("inbox: analysis failed", error);
    return finish({ suggestion: null, error: "analysis" });
  }
}

/** The local reader: the document's text, then the rules (D92). */
async function readLocally(
  item: InboxRow,
  bytes: Buffer,
  context: InboxContext,
): Promise<AnalysisOutcome> {
  try {
    const extracted = await extractText(bytes, item.mime_type);
    const suggestion = heuristicSuggestion(
      {
        text: extracted.text,
        fileName: item.file_name,
        subject: item.subject,
        senderName: item.sender_name,
        senderEmail: item.sender_email,
        ocrConfidence: extracted.ocrConfidence,
      },
      context,
    );
    return { suggestion, error: suggestion ? null : "noText" };
  } catch (error) {
    console.error("inbox: local reading failed", error);
    return { suggestion: null, error: "analysis" };
  }
}

/** Claude Opus 5, structured output, medium effort: reading, not reasoning, checked afterwards. */
async function readWithClaude(
  item: InboxRow,
  bytes: Buffer,
  context: InboxContext,
): Promise<AnalysisOutcome> {
  const data = bytes.toString("base64");
  const document: Anthropic.ContentBlockParam =
    item.mime_type === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : {
          type: "image",
          source: {
            type: "base64",
            media_type: item.mime_type as (typeof ANALYSABLE_IMAGE_TYPES)[number],
            data,
          },
        };
  try {
    const client = new Anthropic();
    const response = await client.messages.parse({
      model: INBOX_MODEL,
      max_tokens: 4096,
      system: [{ type: "text", text: INBOX_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [
        {
          role: "user",
          content: [document, { type: "text", text: contextText(context, item.file_name) }],
        },
      ],
      output_config: { effort: "medium", format: zodOutputFormat(inboxModelOutputSchema) },
    });

    if (response.stop_reason === "refusal") {
      console.error("inbox: reading refused", response.stop_details?.category);
      return { suggestion: null, error: "refused" };
    }
    const output = response.parsed_output;
    if (!output) {
      console.error("inbox: no structured output", response.stop_reason);
      return { suggestion: null, error: "analysis" };
    }
    const suggestion = normaliseSuggestion(output, context);
    return { suggestion, error: suggestion ? null : "analysis" };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      console.error("inbox: invalid ANTHROPIC_API_KEY");
      return { suggestion: null, error: "notConfigured" };
    }
    if (error instanceof Anthropic.APIError) {
      console.error(`inbox: claude ${error.status}`, error.message);
    } else {
      console.error("inbox: claude reading failed", error);
    }
    return { suggestion: null, error: "analysis" };
  }
}

/** The boat's own vocabulary: what the reading is asked to land on. */
async function loadContext(
  admin: ReturnType<typeof createAdminClient>,
  boatId: string,
): Promise<InboxContext> {
  const [{ data: boat }, { data: categories }, { data: engines }, { data: contacts }] =
    await Promise.all([
      admin.from("boats").select("name, type").eq("id", boatId).maybeSingle(),
      admin
        .from("boat_categories")
        .select("id, name, external_ref")
        .eq("boat_id", boatId)
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("engines")
        .select("id, label, propulsion")
        .eq("boat_id", boatId)
        .eq("is_active", true)
        .order("sort_order"),
      admin
        .from("contacts")
        .select("id, name, company, specialty")
        .eq("boat_id", boatId)
        .is("deleted_at", null)
        .order("name"),
    ]);
  return {
    boatName: boat?.name ?? "",
    boatType: boat?.type ?? "other",
    today: todayString(),
    categories: (categories ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      externalRef: row.external_ref,
    })),
    engines: (engines ?? []).map((row) => ({
      id: row.id,
      label: row.label,
      propulsion: row.propulsion,
    })),
    contacts: (contacts ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      company: row.company,
      specialty: row.specialty,
    })),
  };
}
