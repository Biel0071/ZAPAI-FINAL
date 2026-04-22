-- Conversation-level AI controls and rolling summaries for Inbox
CREATE TABLE IF NOT EXISTS public.conversation_controls (
  conversation_id TEXT PRIMARY KEY,
  ai_enabled BOOLEAN NOT NULL DEFAULT true,
  summary TEXT,
  summarized_message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.conversation_controls ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_controls'
      AND policyname = 'Allow read conversation_controls'
  ) THEN
    CREATE POLICY "Allow read conversation_controls"
    ON public.conversation_controls
    FOR SELECT
    TO public
    USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_controls'
      AND policyname = 'Allow upsert conversation_controls'
  ) THEN
    CREATE POLICY "Allow upsert conversation_controls"
    ON public.conversation_controls
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (
      current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon', 'authenticated'])
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'conversation_controls'
      AND policyname = 'Allow update conversation_controls'
  ) THEN
    CREATE POLICY "Allow update conversation_controls"
    ON public.conversation_controls
    FOR UPDATE
    TO anon, authenticated
    USING (
      current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon', 'authenticated'])
    )
    WITH CHECK (
      current_setting('request.jwt.claim.role', true) = ANY (ARRAY['anon', 'authenticated'])
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_conversation_controls_updated_at'
  ) THEN
    CREATE TRIGGER set_conversation_controls_updated_at
    BEFORE UPDATE ON public.conversation_controls
    FOR EACH ROW
    EXECUTE FUNCTION public.touch_updated_at_column();
  END IF;
END $$;