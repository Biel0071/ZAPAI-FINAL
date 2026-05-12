-- RLS hardening for admin_accounts
DROP POLICY IF EXISTS "deny_all_authenticated_admin_accounts" ON public.admin_accounts;
DROP POLICY IF EXISTS "deny_all_anon_admin_accounts" ON public.admin_accounts;

CREATE POLICY "deny_all_authenticated_admin_accounts"
ON public.admin_accounts
FOR ALL
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny_all_anon_admin_accounts"
ON public.admin_accounts
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- Restrict credential function execution to service role only
REVOKE ALL ON FUNCTION public.verify_admin_credentials(TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_credentials(TEXT, TEXT) TO service_role;