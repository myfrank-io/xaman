-- 0009_function_privileges.sql — tighten EXECUTE on the functions of schema public
-- (Supabase security advisors 0028 / 0029). Supabase's default privileges grant EXECUTE to
-- anon, authenticated and service_role when a function is created, and the
-- `revoke … from public` statements of 0002 / 0003 did not remove that explicit anon grant.
--   * every function of `public` loses EXECUTE for PUBLIC and anon;
--   * trigger functions and the service-only functions (purge_trash, weekly_digest_payload,
--     enqueue_weekly_digest) also lose it for authenticated: triggers fire whatever the caller's
--     EXECUTE privilege, the cron jobs run as postgres and the Edge Function uses the service role;
--   * the two anonymous entry points keep anon: get_invitation_preview (masked preview of an
--     invitation by token) and boat_id_from_storage_path (pure helper used by Storage policies).
-- Re-runnable.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig,
           pg_get_function_result(p.oid) = 'trigger' as is_trigger,
           p.proname
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
  loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.is_trigger or f.proname in ('purge_trash', 'weekly_digest_payload', 'enqueue_weekly_digest') then
      execute format('revoke execute on function %s from authenticated', f.sig);
    end if;
  end loop;
end;
$$;

grant execute on function public.get_invitation_preview(text) to anon;
grant execute on function public.boat_id_from_storage_path(text) to anon;

-- functions created from now on: no EXECUTE for PUBLIC either (anon was already handled in 0003)
alter default privileges for role postgres in schema public revoke execute on functions from public;
