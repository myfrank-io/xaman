-- D154: the Membres screen says, for someone who has not signed in yet, when their credentials
-- went out and how many times they were sent again — what the old invitation list showed before
-- D151 removed it. Counted per membership: re-inviting onto another boat is a separate count.
alter table public.boat_members
  add column credentials_sent_count integer not null default 0,
  add column credentials_sent_at timestamptz;

comment on column public.boat_members.credentials_sent_count is
  'D154: credentials e-mails actually accepted by the mailer for this membership (1 = first send, each more = one relance).';
comment on column public.boat_members.credentials_sent_at is
  'D154: when the last credentials e-mail for this membership was accepted by the mailer.';
