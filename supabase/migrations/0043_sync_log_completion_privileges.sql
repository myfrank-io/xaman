-- 0043_sync_log_completion_privileges.sql — the functions of 0042 lose EXECUTE for anon and
-- authenticated (Supabase security advisors 0028 / 0029), the way 0009 did for every internal
-- function before them.
--
-- `sync_log_completion(uuid)` is `security definer` and is only ever called by its two triggers.
-- Supabase's default privileges nonetheless grant EXECUTE to anon, authenticated and service_role
-- the moment a function is created, which exposed it at `/rest/v1/rpc/sync_log_completion` to any
-- signed-in user. It re-derives a completion from the line's own data and leaks nothing, but a
-- write path reachable without membership of the boat is not one this schema keeps (rule 2). The
-- two trigger functions and the boat check cannot be called through PostgREST in any useful way;
-- they lose the grant all the same, as 0009 did for their elders. Triggers fire whatever the
-- caller's EXECUTE privilege. Re-runnable.

revoke execute on function public.sync_log_completion(uuid) from public, anon, authenticated;
revoke execute on function public.sync_log_completion_from_log() from public, anon, authenticated;
revoke execute on function public.sync_log_completion_from_reading() from public, anon, authenticated;
revoke execute on function public.maintenance_logs_check_item_boat() from public, anon, authenticated;
