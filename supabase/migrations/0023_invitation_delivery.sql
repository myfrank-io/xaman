-- 0023_invitation_delivery.sql — an invitation that never reached anyone says so (D79).
--
-- Signalled in use, from the mailer's dashboard and not from the app: « Vous êtes invité à bord
-- — Xaman », `Sent` at 19:00, `Bounced` at 19:00, `Suppressed` at 19:00 — « Recipient not found:
-- the recipient address doesn't exist ». A typo in the address, one letter.
--
-- The app said « En attente ». It would have said « En attente » for fourteen days, then
-- « Expirée » — the same two words it shows for an invitation somebody is reading right now.
-- The one fact the owner needed (nobody will ever receive this, go and fix the address) was
-- known three seconds after the send, by the mailer alone.
--
-- Five columns carry what the mailer knows:
--   * `email_id`            — the provider's own id for the message; a webhook event names it,
--                             and it is what lets the app ask « and this one? ». Never granted
--                             to `authenticated`: no screen has anything to do with it.
--   * `delivery_status`     — sent → delivered · bounced · complained · delayed · failed.
--   * `delivery_reason`     — why it failed, in the app's own closed vocabulary, mapped from the
--                             provider's bounce classification. The UI keys its French sentence
--                             off this; provider English never reaches a screen (rule 7).
--   * `delivery_detail`     — the provider's own sentence, verbatim, for whoever opens the table.
--                             Not granted either: it is a log line, not a message.
--   * `delivery_updated_at` — the event's own timestamp. This is what makes an out-of-order
--                             webhook harmless: a write only lands if it is not older than what
--                             is already stored.
--
-- Nothing here is required for an invitation to work. All five stay null when no mailer is
-- configured (Supabase Auth sends it, D75) and the screen falls back to what it says today.

alter table public.boat_invitations
  add column if not exists email_id            text,
  add column if not exists delivery_status     text,
  add column if not exists delivery_reason     text,
  add column if not exists delivery_detail     text,
  add column if not exists delivery_updated_at timestamptz;

alter table public.boat_invitations
  drop constraint if exists boat_invitations_delivery_status_check;
alter table public.boat_invitations
  add constraint boat_invitations_delivery_status_check
  check (
    delivery_status is null
    or delivery_status in ('sent', 'delivered', 'bounced', 'complained', 'delayed', 'failed')
  );

alter table public.boat_invitations
  drop constraint if exists boat_invitations_delivery_reason_check;
alter table public.boat_invitations
  add constraint boat_invitations_delivery_reason_check
  check (
    delivery_reason is null
    or delivery_reason in (
      'no_email', 'mailbox_full', 'suppressed', 'blocked', 'content', 'spam', 'temporary', 'unknown'
    )
  );

comment on column public.boat_invitations.email_id is
  'Message id at the mail provider (Resend). Written when the app sends the invitation itself '
  '(D75); the delivery webhook and the catch-up poll both find the row by it.';
comment on column public.boat_invitations.delivery_status is
  'What became of that message: sent, delivered, bounced, complained, delayed, failed. Null when '
  'the app did not send it (no mailer configured) — unknown, not delivered.';
comment on column public.boat_invitations.delivery_reason is
  'Why it failed, in the app''s vocabulary (no_email, mailbox_full, suppressed, blocked, content, '
  'spam, temporary, unknown). The UI maps it to a French sentence; see src/lib/email/delivery-status.ts.';
comment on column public.boat_invitations.delivery_detail is
  'The provider''s own explanation, verbatim. Server-side only: never granted to authenticated, '
  'never printed on a screen.';
comment on column public.boat_invitations.delivery_updated_at is
  'Timestamp of the event this status comes from (not of the write). A write is refused when it '
  'is older than the stored value, so webhooks arriving out of order cannot go backwards.';

-- Only rows the app actually sent are ever looked up by message id.
create index if not exists boat_invitations_email_id_idx
  on public.boat_invitations (email_id)
  where email_id is not null;

-- ---------------------------------------------------------------------------------------------
-- Column privileges (rule 2): the three columns a screen reads, and only those.
-- `email_id` and `delivery_detail` stay out, like `token` before them — the browser has no use
-- for either, and the writer of all five is the service key (webhook, catch-up poll).
-- ---------------------------------------------------------------------------------------------
grant select (delivery_status, delivery_reason, delivery_updated_at)
  on public.boat_invitations to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 6.4 boat_invitations_safe — the delivery is part of what an owner reads about an invitation.
-- Recreated whole (still without the token, still security_invoker).
-- ---------------------------------------------------------------------------------------------
drop view if exists public.boat_invitations_safe;

create view public.boat_invitations_safe
with (security_invoker = true) as
select
  i.id,
  i.boat_id,
  i.email,
  i.role,
  i.invited_by,
  coalesce(p.full_name, p.email) as invited_by_name,
  i.expires_at,
  i.valid_until,
  i.accepted_at,
  i.accepted_by,
  i.revoked_at,
  i.created_at,
  i.delivery_status,
  i.delivery_reason,
  i.delivery_updated_at,
  case
    when i.accepted_at is not null then 'accepted'
    when i.revoked_at is not null then 'revoked'
    when i.expires_at < now() then 'expired'
    else 'pending'
  end as status
from public.boat_invitations i
left join public.profiles p on p.id = i.invited_by;

comment on view public.boat_invitations_safe is
  'Invitations without the token, with the computed status, the inviter name and what became of '
  'the e-mail (D79).';
