-- 0008_weekly_digest.sql — E9-6: the weekly e-mail (Friday morning) for owners and editors.
-- The payload is built here (service role only); the Edge Function `weekly-digest` renders and
-- sends it. Scheduling uses pg_cron + pg_net when they exist, with the function URL and the
-- service key read from Vault (`xaman_digest_url`, `xaman_digest_key`) so nothing is stored in
-- the migration. Locally (no pg_cron) nothing is scheduled.

create or replace function public.weekly_digest_payload()
returns table (
  boat_id uuid,
  boat_name text,
  recipients jsonb,
  overdue jsonb,
  soon jsonb,
  logs jsonb
)
language sql stable security definer
set search_path = ''
as $$
  select
    b.id as boat_id,
    b.name as boat_name,
    coalesce((
      select jsonb_agg(jsonb_build_object('email', p.email, 'full_name', p.full_name) order by p.email)
      from public.boat_members m
      join public.profiles p on p.id = m.user_id
      where m.boat_id = b.id
        and m.role in ('owner', 'editor')
        and (m.valid_until is null or m.valid_until >= current_date)
    ), '[]'::jsonb) as recipients,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', s.label,
        'category', c.name,
        'due', case
          when s.days_remaining is not null then abs(s.days_remaining) || ' j de retard'
          else abs(s.hours_remaining)::int || ' h de retard'
        end,
        'state', 'overdue') order by s.days_remaining nulls last, s.hours_remaining nulls last)
      from public.checklist_item_status s
      join public.boat_categories c on c.id = s.category_id
      where s.boat_id = b.id and s.status = 'overdue'
    ), '[]'::jsonb) as overdue,
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'label', s.label,
        'category', c.name,
        'due', case
          when s.days_remaining is not null and (s.hours_remaining is null or s.days_remaining <= s.hours_remaining * 1.2)
            then 'dans ' || s.days_remaining || ' j'
          else 'dans ' || s.hours_remaining::int || ' h'
        end,
        'state', 'soon') order by s.days_remaining nulls last, s.hours_remaining nulls last)
      from public.checklist_item_status s
      join public.boat_categories c on c.id = s.category_id
      where s.boat_id = b.id and s.status = 'soon'
    ), '[]'::jsonb) as soon,
    coalesce((
      select jsonb_agg(jsonb_build_object('title', l.title, 'status', l.status, 'date', l.performed_at)
        order by case l.status when 'urgent' then 0 when 'in_progress' then 1 else 2 end, l.performed_at)
      from public.maintenance_logs l
      where l.boat_id = b.id
        and l.deleted_at is null
        and l.status in ('planned', 'in_progress', 'urgent')
        and l.performed_at <= current_date + 30
    ), '[]'::jsonb) as logs
  from public.boats b
  order by b.name;
$$;

revoke all on function public.weekly_digest_payload() from public;
grant execute on function public.weekly_digest_payload() to service_role;

-- Trigger the Edge Function through pg_net; the URL and key come from Vault at call time.
create or replace function public.enqueue_weekly_digest()
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  if to_regclass('vault.decrypted_secrets') is null or to_regproc('net.http_post') is null then
    raise notice 'weekly digest: vault or pg_net unavailable, nothing sent';
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'xaman_digest_url';
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'xaman_digest_key';
  if v_url is null or v_key is null then
    raise notice 'weekly digest: secrets xaman_digest_url / xaman_digest_key missing';
    return;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := '{}'::jsonb
  );
end;
$$;

revoke all on function public.enqueue_weekly_digest() from public;
grant execute on function public.enqueue_weekly_digest() to service_role;

-- Friday 06:30 UTC (08:30 in summer, 07:30 in winter, Paris time)
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule('xaman-weekly-digest', '30 6 * * 5', 'select public.enqueue_weekly_digest()');
  end if;
end;
$$;
