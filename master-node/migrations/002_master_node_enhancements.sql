-- ============================================================================
-- MASTER NODE ENHANCEMENTS - CLIENT LINK + COMMAND TRACKING
-- ============================================================================

ALTER TABLE remote_commands
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE TABLE IF NOT EXISTS clients (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS client_nodes (
    id SERIAL PRIMARY KEY,
    client_id VARCHAR(255) NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    node_id VARCHAR(255) NOT NULL REFERENCES nodes(node_id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (client_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_client_id ON clients(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_client_nodes_client_id ON client_nodes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_nodes_node_id ON client_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_remote_commands_updated_at ON remote_commands(updated_at);
