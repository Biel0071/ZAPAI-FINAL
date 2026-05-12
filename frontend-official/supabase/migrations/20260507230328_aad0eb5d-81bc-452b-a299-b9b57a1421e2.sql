CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.admin_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'master',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_admin_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_accounts_updated_at ON public.admin_accounts;
CREATE TRIGGER trg_admin_accounts_updated_at
BEFORE UPDATE ON public.admin_accounts
FOR EACH ROW
EXECUTE FUNCTION public.set_admin_accounts_updated_at();

CREATE OR REPLACE FUNCTION public.verify_admin_credentials(_username TEXT, _password TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role
    INTO v_role
  FROM public.admin_accounts
  WHERE lower(username) = lower(trim(_username))
    AND is_active = true
    AND password_hash = crypt(_password, password_hash)
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;

  RETURN jsonb_build_object('ok', true, 'role', v_role);
END;
$$;

REVOKE ALL ON FUNCTION public.verify_admin_credentials(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_credentials(TEXT, TEXT) TO anon, authenticated;

INSERT INTO public.admin_accounts (username, password_hash, role, is_active)
VALUES ('zapadmin', crypt('zapadmin1010', gen_salt('bf')), 'master', true)
ON CONFLICT (username)
DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  updated_at = now();