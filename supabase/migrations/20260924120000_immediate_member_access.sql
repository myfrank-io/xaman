-- 20260924120000_immediate_member_access.sql — D151: members are granted access immediately,
-- instead of through a token e-mailed to an address that then signs in with a 6-digit code.
--
-- The old shape had two bugs and no way to tell members apart once they were in: the OTP send
-- from /invite/[token] failed far too often (mailbox scanners burning the one-time token before
-- its owner read it — the same class of bug D76/D78 already fixed for sign-in and recovery, never
-- fixed here), and every invitation offered the same undifferentiated "code par e-mail" regardless
-- of the role it carried. `grant_boat_access` replaces `accept_invitation`: the *inviter* grants
-- the row, in the same call that creates the invitee's account server-side (`src/lib/actions/
-- members.ts`), so there is no second visit, no token, and no code to lose in transit.
--
-- `boat_invitations` itself is kept, deliberately, rather than dropped: real pending rows already
-- exist (sent under the old flow) and the Membres screen's "Relancer" now drains them — one
-- conversion to an account, then the row is deleted — instead of resending the token e-mail. Once
-- that backlog is empty the table receives no more rows; a later migration can drop it. Its
-- `token` column, unique and secret, is dropped now: nothing reads it any more, this migration's
-- own conversion path included, and a live secret column nobody uses is a liability rule 2 does
-- not allow to linger.

-- ---------------------------------------------------------------------------------------------
-- grant_boat_access: the inviter grants the row, right away — no accept step, no token.
-- ---------------------------------------------------------------------------------------------
-- Same authorisation `boat_invitations_insert` (0004, D28) used to check on the row an invitee
-- would later accept: an owner may grant any role; an editor only a fresh pro/viewer, always
-- dated (<= 90 days) and never on someone already aboard (an editor adds, it does not touch a
-- peer or a superior — the old insert policy could not even express that, because the row it
-- guarded was never the membership itself).
create or replace function public.grant_boat_access(
  p_boat_id uuid,
  p_user_id uuid,
  p_role public.boat_role,
  p_valid_until date
)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_actor_role public.boat_role := public.boat_role(p_boat_id);
  v_valid_until date := p_valid_until;
  v_already_member boolean;
begin
  if v_actor_role = 'owner'::public.boat_role then
    -- D89: an owner never expires, whatever the caller passed.
    if p_role = 'owner'::public.boat_role then
      v_valid_until := null;
    end if;
  elsif v_actor_role = 'editor'::public.boat_role then
    if p_role not in ('pro'::public.boat_role, 'viewer'::public.boat_role) then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    if v_valid_until is null or v_valid_until > current_date + 90 then
      raise exception 'forbidden' using errcode = '42501';
    end if;
    select exists (
      select 1 from public.boat_members where boat_id = p_boat_id and user_id = p_user_id
    ) into v_already_member;
    if v_already_member then
      raise exception 'forbidden' using errcode = '42501';
    end if;
  else
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into public.boat_members (boat_id, user_id, role, valid_until, invited_by)
  values (p_boat_id, p_user_id, p_role, v_valid_until, auth.uid())
  on conflict (boat_id, user_id) do update
    set role = excluded.role, valid_until = excluded.valid_until;
end;
$$;

revoke all on function public.grant_boat_access(uuid, uuid, public.boat_role, date) from public;
grant execute on function public.grant_boat_access(uuid, uuid, public.boat_role, date)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------------------------
-- The token accept flow: gone. /invite/[token] no longer exists, and nothing else called these.
-- ---------------------------------------------------------------------------------------------
drop function if exists public.accept_invitation(text);
drop function if exists public.get_invitation_preview(text);

alter table public.boat_invitations drop column if exists token;
