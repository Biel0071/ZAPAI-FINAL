const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../../infrastructure/config/database');

const router = express.Router();

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function getDefaultRole() {
  const role = String(process.env.AUTH_DEFAULT_ROLE || 'admin').trim().toLowerCase();
  if (!role) return 'admin';
  if (role === 'master_admin') return 'master_admin';
  return 'admin';
}

function signHs256Jwt(payload, secret) {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signedData = `${encodedHeader}.${encodedPayload}`;
  const encodedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedData)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${signedData}.${encodedSignature}`;
}

function fromBase64Url(value) {
  const normalized = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function getBearerToken(req) {
  const authorizationHeader = String(req.headers?.authorization || '').trim();
  if (authorizationHeader.toLowerCase().startsWith('bearer ')) {
    return authorizationHeader.slice(7).trim();
  }
  const queryToken = String(req.query?.token || '').trim();
  if (queryToken) return queryToken;
  return '';
}

function verifyHs256Jwt(token, secret) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) {
    return { error: 'Invalid token format.', payload: null };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;

  let header;
  let payload;
  try {
    header = JSON.parse(fromBase64Url(encodedHeader));
    payload = JSON.parse(fromBase64Url(encodedPayload));
  } catch {
    return { error: 'Invalid token payload.', payload: null };
  }

  if (!header || header.alg !== 'HS256') {
    return { error: 'Unsupported token algorithm.', payload: null };
  }

  const signedData = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedData)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  if (!safeEquals(expectedSignature, encodedSignature)) {
    return { error: 'Invalid token signature.', payload: null };
  }

  const nowInSeconds = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === 'number' && nowInSeconds >= payload.exp) {
    return { error: 'Token has expired.', payload: null };
  }

  return { error: null, payload };
}

function safeEquals(a, b) {
  const left = Buffer.from(String(a || ''), 'utf8');
  const right = Buffer.from(String(b || ''), 'utf8');

  if (left.length !== right.length) {
    return false;
  }

  return crypto.timingSafeEqual(left, right);
}

function getConfiguredCredentials() {
  const username = String(process.env.AUTH_DEFAULT_USERNAME || '').trim();
  const password = String(process.env.AUTH_DEFAULT_PASSWORD || '').trim();

  if (!username || !password) {
    return null;
  }

  return {
    password,
    username,
  };
}

function isProductionEnvironment() {
  return String(process.env.NODE_ENV || 'development').trim().toLowerCase() === 'production';
}

function isEnvAuthFallbackAllowed() {
  if (!isProductionEnvironment()) {
    return true;
  }

  return String(process.env.AUTH_ALLOW_ENV_FALLBACK || '').trim().toLowerCase() === 'true';
}

function getFrontendBaseUrl() {
  const rawValue = String(process.env.FRONTEND_URL || '').trim();
  if (!rawValue) {
    return '';
  }

  try {
    const parsed = new URL(rawValue);
    if (!parsed.protocol || !parsed.host) {
      return '';
    }
    return rawValue.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

router.post('/auth/login', async (req, res) => {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';

  if (!secret) {
    return res.status(503).json({
      error: 'Authentication is not configured.',
    });
  }

  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const requestedTenant = String(body.tenantId || body.companyId || '').trim();
  const tenantId = String(process.env.AUTH_DEFAULT_TENANT_ID || process.env.DEFAULT_COMPANY_ID || 'default').trim();

  if (requestedTenant && requestedTenant !== tenantId) {
    return res.status(403).json({
      error: 'Requested tenant is not allowed for this login.',
    });
  }

  if (!username || !password) {
    return res.status(400).json({
      error: 'username and password are required.',
    });
  }

  let dbLookupFailed = false;
  let dbUserExists = false;

  // Try database authentication first (production path)
  try {
    const result = await query(
      'SELECT username, password_hash, tenant_id, role, is_active, blocked FROM users WHERE username = $1 LIMIT 1',
      [username]
    );

    if (result.rows.length > 0) {
      dbUserExists = true;
      const user = result.rows[0];

      if (!user.is_active) {
        return res.status(401).json({ error: 'Account is deactivated.' });
      }
      if (user.blocked) {
        return res.status(401).json({ error: 'Account is blocked.' });
      }

      const passwordValid = await bcrypt.compare(password, user.password_hash);
      if (passwordValid) {
        const ttlSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 8 * 60 * 60);
        const issuedAt = Math.floor(Date.now() / 1000);
        const expiresAt = issuedAt + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 8 * 60 * 60);
        const payload = {
          sub: user.username,
          username: user.username,
          tenantId: user.tenant_id || tenantId,
          companyId: user.tenant_id || tenantId,
          role: user.role || getDefaultRole(),
          iat: issuedAt,
          exp: expiresAt,
        };

        const token = signHs256Jwt(payload, secret);
        return res.status(200).json({
          success: true,
          token,
          tokenType: 'Bearer',
          expiresIn: expiresAt - issuedAt,
          expiresAt,
          tenantId: user.tenant_id || tenantId,
          user: {
            username: user.username,
            role: user.role || getDefaultRole(),
          },
        });
      }

      return res.status(401).json({
        error: 'Invalid credentials.',
      });
    }
  } catch (dbError) {
    dbLookupFailed = true;
    console.error('[AUTH] Database login error:', dbError.message);
  }

  // Fallback: environment credentials (development by default, production only with explicit flag)
  const configuredCredentials = getConfiguredCredentials();
  if (configuredCredentials && !dbUserExists && (dbLookupFailed || isEnvAuthFallbackAllowed())) {
    const expectedUsername = configuredCredentials.username;
    const expectedPassword = configuredCredentials.password;

    if (safeEquals(username, expectedUsername) && safeEquals(password, expectedPassword)) {
      const ttlSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 8 * 60 * 60);
      const defaultRole = getDefaultRole();
      const issuedAt = Math.floor(Date.now() / 1000);
      const expiresAt = issuedAt + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 8 * 60 * 60);
      const payload = {
        sub: username,
        username,
        tenantId,
        companyId: tenantId,
        role: defaultRole,
        iat: issuedAt,
        exp: expiresAt,
      };

      const token = signHs256Jwt(payload, secret);
      return res.status(200).json({
        success: true,
        token,
        tokenType: 'Bearer',
        expiresIn: expiresAt - issuedAt,
        expiresAt,
        tenantId,
        user: {
          username,
          role: defaultRole,
        },
      });
    }
  }

  return res.status(401).json({
    error: 'Invalid credentials.',
  });
});

router.get('/auth/me', (req, res) => {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';

  if (!secret) {
    return res.status(503).json({
      error: 'Authentication is not configured.',
    });
  }

  const token = getBearerToken(req);
  if (!token) {
    return res.status(401).json({
      error: 'Authentication token is required.',
    });
  }

  const verification = verifyHs256Jwt(token, secret);
  if (verification.error || !verification.payload) {
    return res.status(401).json({
      error: verification.error || 'Invalid token.',
    });
  }

  const payload = verification.payload;
  const tenantId = String(payload.tenantId || payload.companyId || '').trim();

  return res.status(200).json({
    authenticated: true,
    tenantId,
    user: {
      username: payload.username || payload.sub || 'unknown',
      role: payload.role || 'admin',
    },
    expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
  });
});

const { sendEmail, isEmailConfigured } = require('../../../services/emailService');

// POST /api/auth/forgot-password — password recovery
router.post('/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (!email || !String(email).includes('@')) {
    return res.status(400).json({ error: 'Valid e-mail is required.' });
  }

  // Check if email exists in database before sending
  let userExists = false;
  try {
    const result = await query('SELECT id FROM users WHERE email = $1 LIMIT 1', [String(email).trim().toLowerCase()]);
    userExists = result.rows.length > 0;
  } catch (dbErr) {
    // If DB error, still return generic message (security)
    console.error('[AUTH] DB error checking email:', dbErr.message);
  }

  // If email configured and user exists, send real recovery email
  if (isEmailConfigured() && userExists) {
    const frontendBaseUrl = getFrontendBaseUrl();

    if (!frontendBaseUrl) {
      console.error('[AUTH] Password recovery skipped: FRONTEND_URL is missing or invalid.');
    } else {
      try {
        const resetLink = `${frontendBaseUrl}/reset-password?email=${encodeURIComponent(email)}`;
        await sendEmail({
          to: email,
          subject: 'Recuperação de senha — ZapAI CRM',
          text: `Olá,\n\nVocê solicitou a recuperação de senha.\n\nClique no link para redefinir: ${resetLink}\n\nSe não foi você, ignore este e-mail.`,
          html: `<p>Olá,</p><p>Você solicitou a recuperação de senha.</p><p><a href="${resetLink}">Clique aqui para redefinir sua senha</a></p><p>Se não foi você, ignore este e-mail.</p>`,
        });
        console.log('[AUTH] Password recovery email sent to:', email);
      } catch (emailErr) {
        console.error('[AUTH] Failed to send recovery email:', emailErr.message);
        // Return generic success anyway to avoid leaking info
      }
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Se o e-mail existir, voce recebera um link de recuperacao.',
  });
});

module.exports = router;
