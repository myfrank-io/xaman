-- 0007_invitation_privacy.sql — the public invitation page never exposes the invitee's address
-- (D29): the preview returns it masked; accept_invitation still checks the full address.

create or replace function public.get_invitation_preview(p_token text)
returns table (
  boat_name text,
  inviter_name text,
  email text,
  role public.boat_role,
  status text
)
language sql stable security definer
set search_path = ''
as $$
  select
    b.name as boat_name,
    coalesce(p.full_name, p.email) as inviter_name,
    regexp_replace(i.email, '^(.).*(@.*)$', '\1•••\2') as email,
    i.role,
    case
      when i.accepted_at is not null then 'accepted'
      when i.revoked_at is not null then 'revoked'
      when i.expires_at < now() then 'expired'
      else 'pending'
    end as status
  from public.boat_invitations i
  join public.boats b on b.id = i.boat_id
  left join public.profiles p on p.id = i.invited_by
  where i.token = p_token;
$$;
