CREATE TABLE IF NOT EXISTS public.lead_intelligence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL UNIQUE,
  intent TEXT NOT NULL,
  lead_temperature TEXT NOT NULL,
  confidence NUMERIC(5,2) NOT NULL DEFAULT 0,
  next_action TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_intelligence_temp ON public.lead_intelligence(lead_temperature);

CREATE TABLE IF NOT EXISTS public.conversation_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id TEXT NOT NULL,
  summary TEXT,
  customer_interest_score INTEGER,
  objections JSONB NOT NULL DEFAULT '[]'::jsonb,
  questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  purchase_signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_action TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_insights_conversation ON public.conversation_insights(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_insights_created ON public.conversation_insights(created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lead_intelligence_updated_at ON public.lead_intelligence;
CREATE TRIGGER trg_lead_intelligence_updated_at
BEFORE UPDATE ON public.lead_intelligence
FOR EACH ROW
EXECUTE FUNCTION public.touch_updated_at_column();

ALTER TABLE public.lead_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow read lead_intelligence" ON public.lead_intelligence;
DROP POLICY IF EXISTS "Allow write lead_intelligence" ON public.lead_intelligence;
CREATE POLICY "Allow read lead_intelligence"
ON public.lead_intelligence
FOR SELECT
USING (true);
CREATE POLICY "Allow write lead_intelligence"
ON public.lead_intelligence
FOR ALL
TO anon, authenticated
USING (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'))
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));

DROP POLICY IF EXISTS "Allow read conversation_insights" ON public.conversation_insights;
DROP POLICY IF EXISTS "Allow write conversation_insights" ON public.conversation_insights;
CREATE POLICY "Allow read conversation_insights"
ON public.conversation_insights
FOR SELECT
USING (true);
CREATE POLICY "Allow write conversation_insights"
ON public.conversation_insights
FOR ALL
TO anon, authenticated
USING (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'))
WITH CHECK (current_setting('request.jwt.claim.role', true) IN ('anon', 'authenticated'));