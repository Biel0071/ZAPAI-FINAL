const { query } = require('../config/database');

function getCompanyId(companyId) {
  return companyId || process.env.DEFAULT_COMPANY_ID || 'default';
}

function parseJson(value, fallback) {
  if (value == null) {
    return fallback;
  }

  if (typeof value === 'object') {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapFlow(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    trigger: row.trigger,
    response: row.response,
    nodes: parseJson(row.nodes, []),
    edges: parseJson(row.edges, []),
    rules: parseJson(row.rules, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listFlows(companyId) {
  const result = await query(
    `
      SELECT *
      FROM flows
      WHERE company_id = $1
      ORDER BY created_at DESC
    `,
    [getCompanyId(companyId)]
  );

  return result.rows.map(mapFlow);
}

async function getFlowById(id, companyId) {
  const result = await query(
    `
      SELECT *
      FROM flows
      WHERE id = $1
        AND company_id = $2
      LIMIT 1
    `,
    [id, getCompanyId(companyId)]
  );

  return mapFlow(result.rows[0]);
}

async function persistFlowNodes(flowId, nodes) {
  await query('DELETE FROM flow_nodes WHERE flow_id = $1', [flowId]);

  for (const node of nodes) {
    await query(
      `
        INSERT INTO flow_nodes (flow_id, node_id, type, label, position, config, created_at)
        VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,NOW())
      `,
      [
        flowId,
        String(node.id || '').trim(),
        String(node.type || 'message').trim(),
        String(node.label || '').trim(),
        JSON.stringify(node.position || { x: 0, y: 0 }),
        JSON.stringify(node.config || {}),
      ]
    );
  }
}

async function createFlow(payload, companyId) {
  const result = await query(
    `
      INSERT INTO flows (
        id,
        company_id,
        name,
        status,
        trigger,
        response,
        nodes,
        edges,
        rules,
        created_at,
        updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb,NOW(),NOW())
      RETURNING *
    `,
    [
      payload.id,
      getCompanyId(companyId),
      payload.name,
      payload.status,
      payload.trigger || '',
      payload.response || '',
      JSON.stringify(payload.nodes || []),
      JSON.stringify(payload.edges || []),
      JSON.stringify(payload.rules || []),
    ]
  );

  await persistFlowNodes(payload.id, payload.nodes || []);
  return mapFlow(result.rows[0]);
}

async function updateFlow(id, payload, companyId) {
  const existing = await getFlowById(id, companyId);

  if (!existing) {
    return null;
  }

  const next = {
    ...existing,
    ...payload,
    id,
  };

  const result = await query(
    `
      UPDATE flows
      SET
        name = $3,
        status = $4,
        trigger = $5,
        response = $6,
        nodes = $7::jsonb,
        edges = $8::jsonb,
        rules = $9::jsonb,
        updated_at = NOW()
      WHERE id = $1
        AND company_id = $2
      RETURNING *
    `,
    [
      id,
      getCompanyId(companyId),
      next.name,
      next.status,
      next.trigger || '',
      next.response || '',
      JSON.stringify(next.nodes || []),
      JSON.stringify(next.edges || []),
      JSON.stringify(next.rules || []),
    ]
  );

  await persistFlowNodes(id, next.nodes || []);
  return mapFlow(result.rows[0]);
}

async function deleteFlow(id, companyId) {
  await query('DELETE FROM flow_nodes WHERE flow_id = $1', [id]);

  const result = await query(
    `
      DELETE FROM flows
      WHERE id = $1
        AND company_id = $2
    `,
    [id, getCompanyId(companyId)]
  );

  return result.rowCount > 0;
}

module.exports = {
  createFlow,
  deleteFlow,
  getFlowById,
  listFlows,
  updateFlow,
};
