-- ZAPAI Enterprise Sync Engine Migration
-- Event Store & Operations Metrics Tables

CREATE TABLE IF NOT EXISTS event_store (
    id VARCHAR(64) PRIMARY KEY,
    event_type VARCHAR(128) NOT NULL,
    version VARCHAR(16) DEFAULT '1.0',
    tenant_id VARCHAR(64) NOT NULL,
    company_id VARCHAR(64),
    correlation_id VARCHAR(64),
    payload JSONB NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_event_store_tenant ON event_store(tenant_id);
CREATE INDEX IF NOT EXISTS idx_event_store_correlation ON event_store(correlation_id);
CREATE INDEX IF NOT EXISTS idx_event_store_type ON event_store(event_type);

CREATE TABLE IF NOT EXISTS event_failures (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(64) REFERENCES event_store(id) ON DELETE CASCADE,
    event_type VARCHAR(128) NOT NULL,
    tenant_id VARCHAR(64),
    error_message TEXT NOT NULL,
    stack_trace TEXT,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_replay (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(64) REFERENCES event_store(id) ON DELETE CASCADE,
    replayed_by VARCHAR(64),
    status VARCHAR(32) DEFAULT 'PENDING',
    replayed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
