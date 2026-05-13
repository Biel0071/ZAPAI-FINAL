DROP POLICY IF EXISTS "Allow full access contacts" ON public.contacts;
DROP POLICY IF EXISTS "Allow full access sessions" ON public.sessions;
DROP POLICY IF EXISTS "Allow full access conversations" ON public.conversations;
DROP POLICY IF EXISTS "Allow full access messages" ON public.messages;

CREATE POLICY "Allow contacts for anon and authenticated"
ON public.contacts
FOR ALL
TO anon, authenticated
USING (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
)
WITH CHECK (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
);

CREATE POLICY "Allow sessions for anon and authenticated"
ON public.sessions
FOR ALL
TO anon, authenticated
USING (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
)
WITH CHECK (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
);

CREATE POLICY "Allow conversations for anon and authenticated"
ON public.conversations
FOR ALL
TO anon, authenticated
USING (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
)
WITH CHECK (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
);

CREATE POLICY "Allow messages for anon and authenticated"
ON public.messages
FOR ALL
TO anon, authenticated
USING (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
)
WITH CHECK (
  current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon','authenticated'])
);