-- D151: instant membership replaces the invitation-token flow entirely. An invite now creates
-- (or resets) an auth account and upserts `boat_members` directly from the Server Action; nothing
-- is pending, so there is nothing left for this table, these two functions or this view to do.
drop view if exists public.boat_invitations_safe;
drop function if exists public.accept_invitation(text);
drop function if exists public.get_invitation_preview(text);
drop table if exists public.boat_invitations;
