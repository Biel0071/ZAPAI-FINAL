-- Tighten RLS policies for AI Learning Engine tables
DROP POLICY IF EXISTS "Allow insert ai_learning_logs" ON public.ai_learning_logs;
DROP POLICY IF EXISTS "Allow update ai_learning_logs" ON public.ai_learning_logs;
CREATE POLICY "Allow insert ai_learning_logs"
ON public.ai_learning_logs
FOR INSERT
TO anon, authenticated
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));
CREATE POLICY "Allow update ai_learning_logs"
ON public.ai_learning_logs
FOR UPDATE
TO anon, authenticated
USING (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'))
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow insert prompt_history" ON public.prompt_history;
CREATE POLICY "Allow insert prompt_history"
ON public.prompt_history
FOR INSERT
TO anon, authenticated
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow insert ai_learning_runs" ON public.ai_learning_runs;
DROP POLICY IF EXISTS "Allow update ai_learning_runs" ON public.ai_learning_runs;
CREATE POLICY "Allow insert ai_learning_runs"
ON public.ai_learning_runs
FOR INSERT
TO anon, authenticated
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));
CREATE POLICY "Allow update ai_learning_runs"
ON public.ai_learning_runs
FOR UPDATE
TO anon, authenticated
USING (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'))
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));