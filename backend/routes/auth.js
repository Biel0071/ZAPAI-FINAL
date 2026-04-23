const crypto = require('crypto');
const express = require('express');

const router = express.Router();

function toBase64Url(value) {
  return Buffer.from(value)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
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

router.post('/auth/login', (req, res) => {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';
  const configuredCredentials = getConfiguredCredentials();

  if (!secret) {
    return res.status(503).json({
      error: 'Authentication is not configured.',
    });
  }

  if (!configuredCredentials) {
    return res.status(503).json({
      error: 'Authentication credentials are not configured.',
    });
  }

  const body = req.body || {};
  const username = String(body.username || '').trim();
  const password = String(body.password || '').trim();
  const requestedTenant = String(body.tenantId || body.companyId || '').trim();

  const expectedUsername = configuredCredentials.username;
  const expectedPassword = configuredCredentials.password;
  const tenantId = String(process.env.AUTH_DEFAULT_TENANT_ID || process.env.DEFAULT_COMPANY_ID || 'default').trim();

  if (requestedTenant && requestedTenant !== tenantId) {
    return res.status(403).json({
      error: 'Requested tenant is not allowed for this login.',
    });
  }

  const ttlSeconds = Number(process.env.AUTH_TOKEN_TTL_SECONDS || 8 * 60 * 60);

  if (!username || !password) {
    return res.status(400).json({
      error: 'username and password are required.',
    });
  }

  if (!safeEquals(username, expectedUsername) || !safeEquals(password, expectedPassword)) {
    return res.status(401).json({
      error: 'Invalid credentials.',
    });
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + (Number.isFinite(ttlSeconds) && ttlSeconds > 0 ? ttlSeconds : 8 * 60 * 60);
  const payload = {
    sub: username,
    username,
    tenantId,
    companyId: tenantId,
    role: 'admin',
    iat: issuedAt,
    exp: expiresAt,
  };

  const token = signHs256Jwt(payload, secret);

  return res.status(200).json({
    token,
    tokenType: 'Bearer',
    expiresIn: expiresAt - issuedAt,
    expiresAt,
    tenantId,
    user: {
      username,
      role: 'admin',
    },
  });
});

module.exports = router;
