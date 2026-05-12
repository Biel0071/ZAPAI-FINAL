CREATE OR REPLACE FUNCTION public.verify_admin_credentials(_username TEXT, _password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role
    INTO v_role
  FROM public.admin_accounts
  WHERE lower(username) = lower(trim(_username))
    AND is_active = true
    AND password_hash = extensions.crypt(_password, password_hash)
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'role', v_role);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_admin_credentials(TEXT, TEXT) FROM anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_credentials(TEXT, TEXT) TO service_role;