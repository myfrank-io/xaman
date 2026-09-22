"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";

import { dueSentence } from "@/components/checklist/due-sentence";
import { dbErrorKey, fail, ok, parseInput, type ActionResult } from "@/lib/actions/result";
import { handOverEmail } from "@/lib/email/handoff";
import { mailerConfigured, sendMail } from "@/lib/email/send";
import { publicEnv } from "@/lib/env";
import { formatDate, formatHours, todayString } from "@/lib/format";
import { handOverItemSchema } from "@/lib/schemas/handoff";
import { createClient } from "@/lib/supabase/server";
import { currentUserId } from "@/lib/supabase/user";

export type HandedOver = {
  /** The planned intervention now carried by the point. */
  logId: string;
  contactName: string;
  /** `yyyy-MM-dd`: the point's due date, or today when it is already late. */
  plannedAt: string;
  /** Whether the provider has an address at all, and whether the mail left. */
  hasEmail: boolean;
  emailed: boolean;
};

/**
 * « Confier au chantier » (E19-11, D141).
 *
 * One tap on a due point hands the job to a provider of the boat's directory — the yard that
 * built the hull, most of the time. What it writes is not a new object: a *planned* intervention
 * that is the doing of the point (`checklist_item_id`, D140), assigned to the provider, dated at
 * the point's deadline. The point's line then says « Confié à … · prévu le … », the queue shows
 * it once, and the day the work is done — ticked by the owner, or written by the yard as an
 * invited pro — the same line turns « terminé » and the database ticks the point from it.
 *
 * The provider is told by e-mail with everything the phone call used to lack: the boat, the
 * hull, the system, how late, the engine hours, the last time, and who to answer. No account is
 * needed on their side; the reply-to is the owner. A provider without an address is still
 * handed the job — the carnet keeps the trace, the owner keeps the phone.
 */
export async function handOverItem(input: unknown): Promise<ActionResult<HandedOver>> {
  const parsed = parseInput(handOverItemSchema, input);
  if (!parsed.ok) return parsed.result;
  const { boatId, itemId, logId, contactId, message } = parsed.data;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return fail("errors.forbidden");

  const [{ data: item, error: itemError }, { data: contact, error: contactError }] =
    await Promise.all([
      supabase
        .from("checklist_item_status")
        .select(
          "id, label, category_id, category_ids, engine_id, interval_months, interval_hours, status, due_at, days_remaining, hours_remaining, current_hours, has_completion, last_completed_at, last_engine_hours, last_completed_by_name, open_log_id",
        )
        .eq("id", itemId)
        .eq("boat_id", boatId)
        .maybeSingle(),
      supabase
        .from("contacts")
        .select("id, name, company, email")
        .eq("id", contactId)
        .eq("boat_id", boatId)
        .is("deleted_at", null)
        .maybeSingle(),
    ]);
  if (itemError) return fail(dbErrorKey(itemError));
  if (!item?.id) return fail("errors.checklist_item_not_found");
  if (contactError) return fail(dbErrorKey(contactError));
  if (!contact) return fail("errors.contact_not_found");

  const today = todayString();
  // Dated at the deadline when it is still ahead — that is when the yard is wanted — and today
  // when the point is already late: a planned line in the past reads as late, which it is.
  const plannedAt = item.due_at && item.due_at > today ? item.due_at : today;

  // Already in someone's hands: one job, one line (rule 11). Nothing is written or sent twice.
  if (item.open_log_id) {
    revalidatePath(`/boats/${boatId}`, "layout");
    return ok({
      logId: item.open_log_id,
      contactName: contact.name,
      plannedAt,
      hasEmail: Boolean(contact.email),
      emailed: false,
    });
  }

  const { error: logError } = await supabase.from("maintenance_logs").upsert(
    {
      id: logId,
      boat_id: boatId,
      title: item.label ?? "",
      category_id: item.category_id,
      status: "planned",
      performed_at: plannedAt,
      contact_id: contact.id,
      notes: message,
      checklist_item_id: item.id,
      created_by: userId,
      updated_by: userId,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (logError) return fail(dbErrorKey(logError));

  if (item.category_id) {
    const { error: linkError } = await supabase.from("maintenance_log_categories").upsert(
      (item.category_ids ?? [item.category_id]).map((categoryId) => ({
        log_id: logId,
        category_id: categoryId,
        boat_id: boatId,
        created_by: userId,
      })),
      { onConflict: "log_id,category_id", ignoreDuplicates: true },
    );
    if (linkError) return fail(dbErrorKey(linkError));
  }

  let emailed = false;
  if (contact.email && mailerConfigured()) {
    const [{ data: boat }, { data: requester }, { data: category }, { data: engine }, td, ti] =
      await Promise.all([
        supabase
          .from("boats")
          .select("name, builder, model, hull_number")
          .eq("id", boatId)
          .maybeSingle(),
        supabase.from("profiles").select("full_name, email").eq("id", userId).maybeSingle(),
        item.category_id
          ? supabase.from("boat_categories").select("name").eq("id", item.category_id).maybeSingle()
          : Promise.resolve({ data: null }),
        item.engine_id
          ? supabase.from("engines").select("label").eq("id", item.engine_id).maybeSingle()
          : Promise.resolve({ data: null }),
        getTranslations("checklist.due"),
        getTranslations("checklist.item"),
      ]);

    // The deadline as the checklist says it — the same sentence, from the same rule (rule 7).
    const due = dueSentence({
      status: (item.status ?? "never") as "overdue" | "soon" | "ok" | "never",
      daysRemaining: item.days_remaining,
      hoursRemaining: item.hours_remaining,
      hasCounter: item.engine_id === null || item.current_hours !== null,
      punctual: item.interval_months === null && item.interval_hours === null,
      hasCompletion: item.has_completion ?? false,
    });
    const requesterEmail = requester?.email ?? "";
    const requesterName = requester?.full_name?.trim() || requesterEmail;
    const lastDone = item.last_completed_at
      ? [
          formatDate(item.last_completed_at),
          item.last_engine_hours !== null
            ? ti("atHours", { hours: formatHours(item.last_engine_hours) })
            : null,
          item.last_completed_by_name,
        ]
          .filter(Boolean)
          .join(" · ")
      : null;

    const mail = handOverEmail({
      boatName: boat?.name ?? "",
      boatModel:
        [boat?.builder, boat?.model, boat?.hull_number ? `n° ${boat.hull_number}` : null]
          .filter(Boolean)
          .join(" ") || null,
      itemLabel: item.label ?? "",
      categoryName: category?.name ?? null,
      dueLabel: td(due.key, due.values ?? {}),
      hoursLabel:
        item.engine_id && item.current_hours !== null
          ? [formatHours(item.current_hours), engine?.label].filter(Boolean).join(" · ")
          : null,
      lastDoneLabel: lastDone,
      message,
      requesterName,
      requesterEmail,
      appUrl: publicEnv.appUrl,
    });
    const sent = await sendMail({
      to: contact.email,
      subject: mail.subject,
      html: mail.html,
      replyTo: requesterEmail || undefined,
    });
    emailed = sent.sent;
  }

  revalidatePath(`/boats/${boatId}`, "layout");
  return ok({
    logId,
    contactName: contact.name,
    plannedAt,
    hasEmail: Boolean(contact.email),
    emailed,
  });
}
