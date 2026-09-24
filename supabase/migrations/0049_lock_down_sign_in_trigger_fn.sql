-- The advisor flags handle_user_sign_in() as callable via RPC by anon/authenticated: it's a
-- trigger function only, relies on `new`, and must never be invoked directly.
revoke execute on function public.handle_user_sign_in() from public, anon, authenticated;
