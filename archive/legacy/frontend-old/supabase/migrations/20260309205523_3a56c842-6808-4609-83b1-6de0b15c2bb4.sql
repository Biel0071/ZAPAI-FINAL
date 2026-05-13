-- AI Learning Engine tables
CREATE TABLE IF NOT EXISTS public.ai_learning_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  issue_type TEXT NOT NULL,
  problem_detected TEXT NOT NULL,
  suggested_response TEXT,
  suggested_prompt_improvement TEXT,
  suggested_new_flow TEXT,
  suggested_improvement TEXT,
  frequent_question TEXT,
  drop_off_moment TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  source_run_date DATE NOT NULL DEFAULT CURRENT_DATE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_learning_logs_unique_daily_issue
  ON public.ai_learning_logs (conversation_id, issue_type, source_run_date);
CREATE INDEX IF NOT EXISTS idx_ai_learning_logs_status ON public.ai_learning_logs (status);
CREATE INDEX IF NOT EXISTS idx_ai_learning_logs_issue_type ON public.ai_learning_logs (issue_type);
CREATE INDEX IF NOT EXISTS idx_ai_learning_logs_created_at ON public.ai_learning_logs (created_at DESC);

CREATE TABLE IF NOT EXISTS public.prompt_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_content TEXT NOT NULL,
  applied_from_log_id UUID REFERENCES public.ai_learning_logs(id) ON DELETE SET NULL,
  version_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prompt_history_created_at ON public.prompt_history (created_at DESC);

CREATE TABLE IF NOT EXISTS public.ai_learning_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL UNIQUE DEFAULT CURRENT_DATE,
  total_conversations_analyzed INTEGER NOT NULL DEFAULT 0,
  missing_responses INTEGER NOT NULL DEFAULT 0,
  lost_leads INTEGER NOT NULL DEFAULT 0,
  frequent_questions INTEGER NOT NULL DEFAULT 0,
  failed_conversations INTEGER NOT NULL DEFAULT 0,
  drop_off_points INTEGER NOT NULL DEFAULT 0,
  conversion_rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  prompt_improvements_applied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_learning_runs_run_date ON public.ai_learning_runs (run_date DESC);

CREATE OR REPLACE FUNCTION public.update_timestamp_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ai_learning_runs_updated_at ON public.ai_learning_runs;
CREATE TRIGGER trg_ai_learning_runs_updated_at
BEFORE UPDATE ON public.ai_learning_runs
FOR EACH ROW
EXECUTE FUNCTION public.update_timestamp_updated_at();

ALTER TABLE public.ai_learning_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_learning_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read ai_learning_logs" ON public.ai_learning_logs;
DROP POLICY IF EXISTS "Allow insert ai_learning_logs" ON public.ai_learning_logs;
DROP POLICY IF EXISTS "Allow update ai_learning_logs" ON public.ai_learning_logs;
CREATE POLICY "Allow read ai_learning_logs"
ON public.ai_learning_logs
FOR SELECT
USING (true);
CREATE POLICY "Allow insert ai_learning_logs"
ON public.ai_learning_logs
FOR INSERT
WITH CHECK (true);
CREATE POLICY "Allow update ai_learning_logs"
ON public.ai_learning_logs
FOR UPDATE
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read prompt_history" ON public.prompt_history;
DROP POLICY IF EXISTS "Allow insert prompt_history" ON public.prompt_history;
CREATE POLICY "Allow read prompt_history"
ON public.prompt_history
FOR SELECT
USING (true);
CREATE POLICY "Allow insert prompt_history"
ON public.prompt_history
FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read ai_learning_runs" ON public.ai_learning_runs;
DROP POLICY IF EXISTS "Allow insert ai_learning_runs" ON public.ai_learning_runs;
DROP POLICY IF EXISTS "Allow update ai_learning_runs" ON public.ai_learning_runs;
CREATE POLICY "Allow read ai_learning_runs"
ON public.ai_learning_runs
FOR SELECT
USING (true);
CREATE POLICY "Allow insert ai_learning_runs"
ON public.ai_learning_runs
FOR INSERT
WITH CHECK (true);
CREATE POLICY "Allow update ai_learning_runs"
ON public.ai_learning_runs
FOR UPDATE
USING (true)
WITH CHECK (true);