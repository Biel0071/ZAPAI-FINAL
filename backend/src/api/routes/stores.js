const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { query } = require('../../infrastructure/config/database');
const aiAgentService = require('../../ai/agents/services/aiAgentService');

function getTenantId(req) {
  return String(req.authTenantId || req.user?.company_id || 'default').trim();
}

// GET /api/stores - List all stores for tenant with connected numbers and attendants
router.get('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const storesResult = await query(
      `SELECT * FROM ai_stores WHERE company_id = $1 ORDER BY created_at ASC`,
      [tenantId]
    );

    const agents = await aiAgentService.listAgents(tenantId);
    const sessionsResult = await query(
      `SELECT s.id, s.session_id, s.session_name, s.phone_number, s.status, p.store_id
       FROM sessions s
       LEFT JOIN session_ai_profiles p ON p.company_id = s.company_id AND p.session_id = s.session_id
       WHERE s.company_id = $1 AND s.status <> 'deleted'`,
      [tenantId]
    );

    const stores = storesResult.rows.map(store => {
      const storeSessions = sessionsResult.rows
        .filter(s => s.store_id === store.id)
        .map(s => {
          const matchedAgent = agents.find(a => Array.isArray(a.sessionIds) && a.sessionIds.includes(s.session_id));
          return {
            id: s.id,
            sessionId: s.session_id,
            sessionName: s.session_name || s.session_id,
            phone: s.phone_number,
            status: s.status,
            attendant: matchedAgent ? {
              key: matchedAgent.key,
              name: matchedAgent.name,
              role: matchedAgent.role,
              active: matchedAgent.active !== false,
              avatar: matchedAgent.avatar,
            } : null,
          };
        });

      const storeAttendants = agents.filter(a => a.storeId === store.id);

      return {
        ...store,
        numbers: storeSessions,
        attendants: storeAttendants,
        numbersCount: storeSessions.length,
        attendantsCount: storeAttendants.length,
      };
    });

    return res.status(200).json({ stores, success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Falha ao listar lojas.' });
  }
});

// GET /api/stores/:id - Store details
router.get('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const storeResult = await query(
      `SELECT * FROM ai_stores WHERE company_id = $1 AND id = $2`,
      [tenantId, req.params.id]
    );

    if (!storeResult.rows[0]) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    const store = storeResult.rows[0];
    const agents = await aiAgentService.listAgents(tenantId);
    const sessionsResult = await query(
      `SELECT s.id, s.session_id, s.session_name, s.phone_number, s.status, p.store_id
       FROM sessions s
       LEFT JOIN session_ai_profiles p ON p.company_id = s.company_id AND p.session_id = s.session_id
       WHERE s.company_id = $1 AND p.store_id = $2 AND s.status <> 'deleted'`,
      [tenantId, store.id]
    );

    const numbers = sessionsResult.rows.map(s => {
      const matchedAgent = agents.find(a => Array.isArray(a.sessionIds) && a.sessionIds.includes(s.session_id));
      return {
        ...s,
        attendant: matchedAgent || null,
      };
    });

    const attendants = agents.filter(a => a.storeId === store.id);

    return res.status(200).json({
      store: {
        ...store,
        numbers,
        attendants,
        storeVisualDNA: store.settings?.storeVisualDNA || {
          storeId: store.id,
          storeName: store.name,
          primaryColor: store.theme_color || '#10b981',
          secondaryColor: '#0f172a',
          accentColor: '#00f090',
          logo: store.name || 'ZAI',
          defaultClothing: 'polo_zai_black',
          defaultAccessories: ['headset_zai_green', 'badge_zai_lanyard'],
          defaultBadge: true,
          defaultShoes: 'sneakers_zai_green',
          visualStyle: 'pixel_isometric',
        },
      },
      success: true,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro ao carregar loja.' });
  }
});

// GET /api/stores/:id/visual-dna - Get Store Visual DNA
router.get('/:id/visual-dna', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const storeResult = await query(
      `SELECT id, name, theme_color, settings FROM ai_stores WHERE company_id = $1 AND id = $2`,
      [tenantId, req.params.id]
    );

    if (!storeResult.rows[0]) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    const store = storeResult.rows[0];
    const settings = store.settings || {};
    const defaultDNA = {
      storeId: store.id,
      storeName: store.name,
      primaryColor: store.theme_color || '#10b981',
      secondaryColor: '#0f172a',
      accentColor: '#00f090',
      logo: store.name || 'ZAI',
      defaultClothing: 'polo_zai_black',
      defaultAccessories: ['headset_zai_green', 'badge_zai_lanyard'],
      defaultBadge: true,
      defaultShoes: 'sneakers_zai_green',
      visualStyle: 'pixel_isometric',
    };

    const visualDNA = {
      ...defaultDNA,
      ...(settings.storeVisualDNA || {}),
      storeId: store.id,
      storeName: store.name,
    };

    return res.status(200).json({ success: true, visualDNA });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro ao obter DNA Visual da loja.' });
  }
});

// PUT /api/stores/:id/visual-dna - Update Store Visual DNA
router.put('/:id/visual-dna', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const storeId = req.params.id;
    const incomingDNA = req.body?.visualDNA || req.body || {};

    const storeResult = await query(
      `SELECT id, name, theme_color, settings FROM ai_stores WHERE company_id = $1 AND id = $2`,
      [tenantId, storeId]
    );

    if (!storeResult.rows[0]) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    const store = storeResult.rows[0];
    const currentSettings = store.settings || {};

    const updatedDNA = {
      storeId,
      storeName: store.name,
      primaryColor: incomingDNA.primaryColor || store.theme_color || '#10b981',
      secondaryColor: incomingDNA.secondaryColor || '#0f172a',
      accentColor: incomingDNA.accentColor || '#00f090',
      logo: incomingDNA.logo || store.name || 'ZAI',
      defaultClothing: incomingDNA.defaultClothing || 'polo_zai_black',
      defaultAccessories: Array.isArray(incomingDNA.defaultAccessories)
        ? incomingDNA.defaultAccessories
        : ['headset_zai_green', 'badge_zai_lanyard'],
      defaultBadge: incomingDNA.defaultBadge !== false,
      defaultShoes: incomingDNA.defaultShoes || 'sneakers_zai_green',
      visualStyle: incomingDNA.visualStyle || 'pixel_isometric',
      updatedAt: new Date().toISOString(),
    };

    const newSettings = {
      ...currentSettings,
      storeVisualDNA: updatedDNA,
    };

    await query(
      `UPDATE ai_stores SET settings = $3::jsonb, theme_color = $4 WHERE company_id = $1 AND id = $2`,
      [tenantId, storeId, JSON.stringify(newSettings), updatedDNA.primaryColor]
    );

    return res.status(200).json({ success: true, visualDNA: updatedDNA, message: 'DNA visual da loja atualizado com sucesso.' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Erro ao atualizar DNA Visual da loja.' });
  }
});

// POST /api/stores - Create new store
router.post('/', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const {
      name,
      segment = '',
      address = '',
      phone = '',
      website = '',
      business_hours = '',
      policies = '',
      catalog_summary = '',
      knowledge = '',
      theme_color = '#10b981',
      attendant_name = '',
      attendant_role = 'Assistente de Vendas',
      attendant_config = {},
      settings = {},
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da loja é obrigatório.' });
    }

    const id = `store-${crypto.randomUUID().slice(0, 8)}`;

    await query(
      `INSERT INTO ai_stores (
        company_id, id, name, segment, address, phone, website, business_hours,
        policies, catalog_summary, knowledge, theme_color, attendant_name, attendant_role,
        attendant_config, settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::jsonb)`,
      [
        tenantId, id, name.trim(), String(segment).slice(0, 200), String(address).slice(0, 300),
        String(phone).slice(0, 50), String(website).slice(0, 200), String(business_hours).slice(0, 200),
        String(policies).slice(0, 5000), String(catalog_summary).slice(0, 10000), String(knowledge).slice(0, 30000),
        String(theme_color || '#10b981').slice(0, 50), String(attendant_name).slice(0, 100),
        String(attendant_role).slice(0, 100), JSON.stringify(attendant_config || {}), JSON.stringify(settings || {})
      ]
    );

    return res.status(201).json({ id, success: true, message: 'Loja criada com sucesso.' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Falha ao criar loja.' });
  }
});

// PUT /api/stores/:id - Update store
router.put('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const storeId = req.params.id;
    const {
      name,
      segment = '',
      address = '',
      phone = '',
      website = '',
      business_hours = '',
      policies = '',
      catalog_summary = '',
      knowledge = '',
      theme_color = '#10b981',
      attendant_name = '',
      attendant_role = 'Assistente de Vendas',
      attendant_config = {},
      settings = {},
    } = req.body || {};

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'O nome da loja é obrigatório.' });
    }

    const result = await query(
      `UPDATE ai_stores SET
        name = $3, segment = $4, address = $5, phone = $6, website = $7,
        business_hours = $8, policies = $9, catalog_summary = $10, knowledge = $11,
        theme_color = $12, attendant_name = $13, attendant_role = $14,
        attendant_config = $15::jsonb, settings = $16::jsonb
      WHERE company_id = $1 AND id = $2
      RETURNING id, name`,
      [
        tenantId, storeId, name.trim(), String(segment).slice(0, 200), String(address).slice(0, 300),
        String(phone).slice(0, 50), String(website).slice(0, 200), String(business_hours).slice(0, 200),
        String(policies).slice(0, 5000), String(catalog_summary).slice(0, 10000), String(knowledge).slice(0, 30000),
        String(theme_color || '#10b981').slice(0, 50), String(attendant_name).slice(0, 100),
        String(attendant_role).slice(0, 100), JSON.stringify(attendant_config || {}), JSON.stringify(settings || {})
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    return res.status(200).json({ success: true, store: result.rows[0] });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Falha ao atualizar loja.' });
  }
});

// DELETE /api/stores/:id - Delete store
router.delete('/:id', async (req, res) => {
  try {
    const tenantId = getTenantId(req);
    const storeId = req.params.id;

    // Check if sessions or profiles reference it
    await query(`UPDATE session_ai_profiles SET store_id = NULL WHERE company_id = $1 AND store_id = $2`, [tenantId, storeId]);

    const result = await query(`DELETE FROM ai_stores WHERE company_id = $1 AND id = $2 RETURNING id`, [tenantId, storeId]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Loja não encontrada.' });
    }

    return res.status(200).json({ success: true, message: 'Loja excluída com sucesso.' });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Falha ao excluir loja.' });
  }
});

module.exports = router;
