/**
 * Migration 032 — Realtime Engines State Tables
 *
 * Adds persistence tables for the new EventBus-driven architecture:
 * flow_execution, flow_step_execution, message_ack, sync_checkpoint,
 * connection_state, queue_job, and event_log.
 */

const REALTIME_TABLES_SQL = `
  CREATE TABLE IF NOT EXISTS flow_execution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id VARCHAR(255) NOT NULL,
    tenant_id VARCHAR(255) DEFAULT 'default',
    flow_name VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'RUNNING',
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL DEFAULT 1,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    paused_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    context_json JSONB DEFAULT '{}'::jsonb
  );

  CREATE TABLE IF NOT EXISTS flow_step_execution (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_execution_id UUID NOT NULL REFERENCES flow_execution(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    type VARCHAR(50),
    value TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    step_metadata JSONB DEFAULT '{}'::jsonb
  );

  CREATE TABLE IF NOT EXISTS message_ack (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'LOCAL',
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    details JSONB DEFAULT '{}'::jsonb
  );

  CREATE TABLE IF NOT EXISTS sync_checkpoint (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    checkpoint_data JSONB DEFAULT '{}'::jsonb
  );

  CREATE TABLE IF NOT EXISTS connection_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb
  );

  CREATE TABLE IF NOT EXISTS queue_job (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_name VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'QUEUED',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    next_attempt_at TIMESTAMPTZ DEFAULT NOW(),
    last_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ
  );

  CREATE TABLE IF NOT EXISTS event_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    source VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Indexes for fast querying
  CREATE INDEX IF NOT EXISTS idx_flow_exec_conv ON flow_execution(conversation_id);
  CREATE INDEX IF NOT EXISTS idx_flow_exec_status ON flow_execution(status);
  CREATE INDEX IF NOT EXISTS idx_message_ack_msg_id ON message_ack(message_id);
  CREATE INDEX IF NOT EXISTS idx_queue_job_status_next ON queue_job(status, next_attempt_at);
  CREATE INDEX IF NOT EXISTS idx_event_log_type_created ON event_log(event_type, created_at DESC);
`;

module.exports = {
  version: '032_realtime_engines_state',
  description: 'Tables for FlowRunner, QueueEngine, AckEngine, EventBus, and Sync persistence.',
  up: async (client) => {
    await client.query(REALTIME_TABLES_SQL);
  },
};
