-- 0031_invitation_reminders.sql — une invitation se relance à la main, sans en créer une seconde
-- (D112).
--
-- Signalled in use: two invitations sitting on the Membres screen, « En attente », for people who
-- simply never opened the message. The screen had exactly two ways out — « Annuler », which
-- throws the invitation away, and « Réinviter », which is the bounce path of D79 and writes a
-- *second* pending row for the same address. Neither is « renvoie-lui le même message ».
--
-- Two columns carry what a reminder leaves behind:
--   * `reminded_at`    — when the last reminder went out. It is what the cooldown reads (an hour,
--                        `src/lib/invitations.ts`) and what the row says out loud, so an owner
--                        knows whether they already tried.
--   * `reminder_count` — how many times. « Relancée 3 fois » is the fact that ends the waiting:
--                        the address is fine, the message is read by nobody, go and call them.
--
-- Neither is granted in update to `authenticated`: `revoked_at` stays the only column a browser
-- may write on this table (0002). A reminder is a Server Action — it reads the token with the
-- service key, sends the message, and writes these two columns plus `expires_at` in the same
-- statement, so nothing is bumped when nothing left.
--
-- `expires_at` moves with the reminder, and that is the point of doing this in one place: the
-- message says the link is valid fourteen days, so the link *is* valid fourteen days from the
-- reminder — a relance sent on day thirteen must not hand out a link that dies tomorrow. It is
-- also what revives an invitation already expired, instead of leaving a dead row behind and
-- creating a fresh one beside it.

alter table public.boat_invitations
  add column if not exists reminded_at    timestamptz,
  add column if not exists reminder_count integer not null default 0;

alter table public.boat_invitations
  drop constraint if exists boat_invitations_reminder_count_check;
alter table public.boat_invitations
  add constraint boat_invitations_reminder_count_check check (reminder_count >= 0);

comment on column public.boat_invitations.reminded_at is
  'When the invitation was last resent by hand (D112). Null when it never was. Written by the '
  'service key only; the cooldown between two reminders is read from it.';
comment on column public.boat_invitations.reminder_count is
  'How many manual reminders went out for this invitation (D112). Shown on the Membres screen: '
  'an invitation relaunched three times is a person to telephone, not an address to re-type.';

-- ---------------------------------------------------------------------------------------------
-- Column privileges (rule 2): both are read on the Membres screen, neither is ever written from
-- a browser — `revoked_at` remains the single column `authenticated` may update (0002).
-- ---------------------------------------------------------------------------------------------
grant select (reminded_at, reminder_count) on public.boat_invitations to authenticated;

-- ---------------------------------------------------------------------------------------------
-- boat_invitations_safe — the reminder is part of what an owner reads about an invitation.
-- Recreated whole (still without the token, still security_invoker), as 0023 did.
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
  i.reminded_at,
  i.reminder_count,
  case
    when i.accepted_at is not null then 'accepted'
    when i.revoked_at is not null then 'revoked'
    when i.expires_at < now() then 'expired'
    else 'pending'
  end as status
from public.boat_invitations i
left join public.profiles p on p.id = i.invited_by;

comment on view public.boat_invitations_safe is
  'Invitations without the token, with the computed status, the inviter name, what became of the '
  'e-mail (D79) and the manual reminders sent since (D112).';

-- 0004 granted this view to `authenticated` and took it away from `anon`; a dropped view takes
-- both with it, and Supabase's default privileges hand the fresh one back to all three roles.
-- Stated again here rather than left to a default (rule 2). Nothing would leak either way — the
-- view is `security_invoker`, so RLS on `boat_invitations` answers `anon` with no rows — but the
-- posture of 0004 is what the next reader of this schema expects to find.
grant select on public.boat_invitations_safe to authenticated, service_role;
revoke all on public.boat_invitations_safe from anon;
