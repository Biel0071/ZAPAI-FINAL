const mediaService = require('../../../services/enterprise/media-service');

function verifiedTenant(req) {
  if (req.authTenantId) return String(req.authTenantId);
  const allowDevBypass = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DEV_AUTH_BYPASS === 'true';
  return allowDevBypass ? String(req.tenantId || req.companyId || '') : '';
}

function decodeBase64Payload(value = '') {
  const raw = String(value || '').trim();

  if (!raw) {
    return null;
  }

  const dataUrlMatch = raw.match(/^data:([^;]+);base64,(.+)$/s);
  const mimeType = dataUrlMatch?.[1] || null;
  const base64 = dataUrlMatch?.[2] || raw;

  return {
    buffer: Buffer.from(base64.replace(/\s+/g, ''), 'base64'),
    mimeType,
  };
}

async function upload(req, res) {
  try {
    const tenantId = verifiedTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Authentication is required.' });
    const type = String(req.body?.type || 'document').trim();
    const sourceFileName = String(req.body?.fileName || '').trim() || null;
    const decoded = decodeBase64Payload(req.body?.base64 || req.body?.data || '');

    if (!decoded?.buffer || decoded.buffer.length === 0) {
      return res.status(400).json({
        error: 'base64 payload is required.',
      });
    }

    const uploaded = await mediaService.saveBuffer({
      buffer: decoded.buffer,
      mimeType: req.body?.mimeType || decoded.mimeType || null,
      sourceFileName,
      tenantId,
      type,
    });

    return res.status(201).json(uploaded);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Failed to upload media.',
    });
  }
}

async function getMetadata(req, res) {
  try {
    const tenantId = verifiedTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Authentication is required.' });
    const mediaId = String(req.params?.mediaId || '').trim();
    const metadata = await mediaService.getMetadata(mediaId);

    if (!metadata || String(metadata.companyId || metadata.tenantId) !== tenantId) {
      return res.status(404).json({ error: 'Media not found.' });
    }

    return res.status(200).json({
      id: metadata.id,
      mimeType: metadata.mimeType,
      size: metadata.size,
      thumbnail: metadata.thumbnail,
      type: metadata.type,
      url: metadata.url,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load media metadata.' });
  }
}

async function stream(req, res) {
  try {
    const tenantId = verifiedTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Authentication is required.' });
    req.authTenantId = tenantId;
    const mediaId = String(req.params?.mediaId || '').trim();
    await mediaService.streamMediaById({ mediaId, req, res });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to stream media.' });
  }
}

async function issueAccess(req, res) {
  try {
    const tenantId = verifiedTenant(req);
    if (!tenantId) return res.status(401).json({ error: 'Authentication is required.' });
    const reference = mediaService.normalizeMediaReference(req.body?.path);
    if (!await mediaService.canAccessMedia(reference, tenantId)) return res.status(404).json({ error: 'Media not found.' });
    if (!await mediaService.findMediaFile(reference)) return res.status(404).json({ error: 'Media file is unavailable.' });
    res.setHeader('Cache-Control', 'no-store');
    return res.json(mediaService.createMediaAccess(reference, tenantId));
  } catch (error) {
    return res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to authorize media.' });
  }
}

module.exports = {
  getMetadata,
  issueAccess,
  stream,
  upload,
};
