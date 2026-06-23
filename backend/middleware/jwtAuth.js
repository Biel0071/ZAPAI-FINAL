const crypto = require('crypto');

function decodeBase64Url(input) {
  const normalized = String(input || '').replace(/-/g, '+').replace(/_/g, '/');
  const padLength = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLength), 'base64');
}

function safeJsonParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getTenantFromClaims(claims = {}) {
  return String(
    claims.tenantId || claims.companyId || claims.tenant || claims.tid || ''
  ).trim();
}

function verifyHs256Jwt(token, secret) {
  const parts = String(token || '').split('.');

  if (parts.length !== 3) {
    return { error: 'Malformed token.' };
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = safeJsonParse(decodeBase64Url(encodedHeader).toString('utf8'));
  const payload = safeJsonParse(decodeBase64Url(encodedPayload).toString('utf8'));

  if (!header || !payload) {
    return { error: 'Invalid token encoding.' };
  }

  if (header.alg !== 'HS256') {
    return { error: 'Unsupported token algorithm.' };
  }

  const signedData = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedData)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  const signatureBuffer = Buffer.from(expectedSignature);
  const providedBuffer = Buffer.from(String(encodedSignature || ''));

  if (
    signatureBuffer.length !== providedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, providedBuffer)
  ) {
    return { error: 'Invalid token signature.' };
  }

  const now = Math.floor(Date.now() / 1000);

  if (typeof payload.nbf === 'number' && now < payload.nbf) {
    return { error: 'Token is not active yet.' };
  }

  if (typeof payload.exp === 'number' && now >= payload.exp) {
    return { error: 'Token expired.' };
  }

  return { payload };
}

function getAuthToken(req) {
  const authorization = String(req.headers?.authorization || '').trim();

  if (authorization) {
    const [scheme, token] = authorization.split(/\s+/, 2);

    if (scheme && scheme.toLowerCase() === 'bearer' && token) {
      return token;
    }
  }

  if (req.query?.token) {
    return String(req.query.token).trim();
  }

  return '';
}

function hasTenantMismatch(req, tokenTenantId) {
  const candidates = [
    req.headers?.['x-tenant-id'],
    req.headers?.['x-company-id'],
    req.query?.tenantId,
    req.query?.companyId,
    req.body?.tenantId,
    req.body?.companyId,
  ]
    .map((value) => String(value || '').trim())
    .filter(Boolean);

  if (!candidates.length) {
    return false;
  }

  return candidates.some((tenantId) => tenantId !== tokenTenantId);
}

function createJwtAuthMiddleware(options = {}) {
  const publicPaths = new Set(options.publicPaths || []);
  const publicPrefixes = Array.from(
    new Set((options.publicPrefixes || []).filter(Boolean))
  );
  const protectedPrefixes = Array.from(
    new Set((options.protectedPrefixes || []).filter(Boolean))
  );
  let hasWarnedDevBypass = false;

  function isPublicRequest(req) {
    const currentPath = String(req.path || '');

    if (protectedPrefixes.some((prefix) => currentPath.startsWith(prefix))) {
      return false;
    }

    if (publicPaths.has(req.path)) {
      return true;
    }
    if (!publicPrefixes.length) {
      return false;
    }
    return publicPrefixes.some((prefix) => currentPath.startsWith(prefix));
  }

  return function jwtAuthMiddleware(req, res, next) {
    if (isPublicRequest(req)) {
      return next();
    }

    const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET || '';
    const nodeEnv = String(process.env.NODE_ENV || 'development').toLowerCase();
    const isProduction = nodeEnv === 'production';
    const allowDevBypass =
      !isProduction &&
      String(process.env.ALLOW_DEV_AUTH_BYPASS || '').toLowerCase() === 'true';

    if (allowDevBypass) {
      if (!hasWarnedDevBypass) {
        console.warn(
          '[AUTH] Dev auth bypass ENABLED via ALLOW_DEV_AUTH_BYPASS=true. ' +
            'Never set this in production.'
        );
        hasWarnedDevBypass = true;
      }
      return next();
    }

    if (!secret) {
      return res.status(503).json({ error: 'Authentication is not configured.' });
    }

    const token = getAuthToken(req);

    if (!token) {
      return res.status(401).json({ error: 'Authentication token is required.' });
    }

    const verification = verifyHs256Jwt(token, secret);

    if (verification.error || !verification.payload) {
      return res.status(401).json({ error: verification.error || 'Invalid token.' });
    }

    const tenantId = getTenantFromClaims(verification.payload);

    if (!tenantId) {
      return res.status(401).json({ error: 'Token does not include tenant information.' });
    }

    if (hasTenantMismatch(req, tenantId)) {
      return res.status(403).json({ error: 'Token tenant does not match request tenant.' });
    }

    req.auth = verification.payload;
    req.authTenantId = tenantId;

    return next();
  };
}

module.exports = {
  createJwtAuthMiddleware,
  getTenantFromClaims,
  verifyHs256Jwt,
};
