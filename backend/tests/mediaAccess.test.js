const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const { createJwtAuthMiddleware } = require('../src/api/middleware/jwtAuth');
const media = require('../services/enterprise/media-service');

process.env.MEDIA_URL_SECRET = 'test-media-secret-not-for-production';

test('media paths reject traversal, metadata paths and unsupported schemes', () => {
  for (const input of ['/media/../secret', '/media/%2e%2e/secret', '/media/a/%252e%252e/secret', '/media/.metadata/id.json', 'file:///etc/passwd', '/media/a/../b/test.jpg']) {
    assert.throws(() => media.normalizeMediaReference(input));
  }
  assert.equal(media.normalizeMediaReference('C:\\app\\backend\\uploads\\old.pdf?token=old'), '/uploads/old.pdf');
  assert.equal(media.normalizeMediaReference('https://old-host/media/a/images/old.jpg?token=old'), '/media/a/images/old.jpg');
});

test('temporary media capability is bound to path, tenant, signature and expiry', () => {
  const signed = media.createMediaAccess('/media/a/images/pic.jpg', 'a', { now: 1000, ttlSeconds: 60 });
  assert.ok(!signed.url.includes('token='));
  const access = new URL(signed.url, 'http://localhost').searchParams.get('access');
  assert.equal(media.verifyMediaAccess(access, '/media/a/images/pic.jpg', { now: 1059 }).tenantId, 'a');
  assert.throws(() => media.verifyMediaAccess(access, '/media/b/images/pic.jpg', { now: 1059 }));
  assert.throws(() => media.verifyMediaAccess(access, '/media/a/images/pic.jpg', { now: 1060 }));
  assert.throws(() => media.verifyMediaAccess(`${access}x`, '/media/a/images/pic.jpg', { now: 1001 }));
});

test('legacy authorization checks only references belonging to the authenticated tenant', async () => {
  const calls = [];
  const query = async (sql, params) => { calls.push({ sql, params }); return { rows: params[0] === 'a' ? [{ media_path: 'C:\\app\\uploads\\old.pdf' }] : [] }; };
  const quickReplies = async () => [];
  assert.equal(await media.canAccessMedia('/uploads/old.pdf', 'a', { query, quickReplies }), true);
  assert.equal(await media.canAccessMedia('/uploads/old.pdf', 'b', { query, quickReplies }), false);
  assert.equal(await media.canAccessMedia('/media/a/images/photo.jpg', 'b', { query, quickReplies }), false);
  for (const call of calls) {
    assert.match(call.sql, /company_id\s*=\s*\$1/);
    assert.ok(['a', 'b'].includes(call.params[0]));
  }
});

test('new quick reply uploads can be previewed only by their owning company', async () => {
  const folder = crypto.createHash('sha256').update('a').digest('hex').slice(0, 24);
  const reference = `/upload/quick-replies/${folder}/preview.jpg`;
  assert.equal(await media.canAccessMedia(reference, 'a'), true);
  assert.equal(await media.canAccessMedia(reference, 'b'), false);
});

test('protected delivery requires signature and supports HEAD, Range and expired links', async () => {
  const root = path.resolve(__dirname, '../../storage/media');
  const tenant = `media-test-${crypto.randomUUID()}`;
  const directory = path.join(root, tenant, 'documents');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'sample.txt'), '0123456789');
  const reference = `/media/${tenant}/documents/sample.txt`;
  const app = express();
  app.use('/media', media.deliverProtectedMedia);
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal((await fetch(`${base}${reference}`)).status, 401);
    const access = media.createMediaAccess(reference, tenant);
    const head = await fetch(`${base}${access.url}`, { method: 'HEAD' });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), '10');
    assert.match(head.headers.get('cache-control'), /private/);
    const partial = await fetch(`${base}${access.url}`, { headers: { Range: 'bytes=2-5' } });
    assert.equal(partial.status, 206);
    assert.equal(await partial.text(), '2345');
    const expired = media.createMediaAccess(reference, tenant, { now: Math.floor(Date.now() / 1000) - 100, ttlSeconds: 60 });
    assert.equal((await fetch(`${base}${expired.url}`)).status, 401);
    assert.equal((await fetch(`${base}${access.url.replace('sample.txt', 'other.txt')}`)).status, 401);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(path.join(root, tenant), { recursive: true, force: true });
  }
});

test('media metadata and upload APIs require verified tenant and isolate media IDs', async () => {
  const controller = require('../src/api/controllers/mediaController');
  const metadata = media.getMetadata;
  const saved = media.saveBuffer;
  media.getMetadata = async () => ({ id: 'id', tenantId: 'a', url: '/media/a/documents/a.txt' });
  let uploads = 0;
  media.saveBuffer = async () => { uploads++; return {}; };
  const response = () => ({ code: 0, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  try {
    const unauth = response();
    await controller.upload({ body: { base64: 'aGVsbG8=', companyId: 'a' }, headers: { 'x-tenant-id': 'a' } }, unauth);
    assert.equal(unauth.code, 401);
    assert.equal(uploads, 0);
    const cross = response();
    await controller.getMetadata({ authTenantId: 'b', params: { mediaId: 'id' } }, cross);
    assert.equal(cross.code, 404);
  } finally { media.getMetadata = metadata; media.saveBuffer = saved; }
});

test('authenticated issuance denies other tenants and ignores JWTs in query strings', async () => {
  const root = path.resolve(__dirname, '../../storage/media');
  const tenant = `media-test-${crypto.randomUUID()}`;
  const directory = path.join(root, tenant, 'documents');
  await fs.mkdir(directory, { recursive: true });
  await fs.writeFile(path.join(directory, 'sample.pdf'), 'sample pdf');
  const reference = `/media/${tenant}/documents/sample.pdf`;
  const secret = 'test-auth-secret';
  const originalSecret = process.env.JWT_SECRET;
  const originalBypass = process.env.ALLOW_DEV_AUTH_BYPASS;
  process.env.JWT_SECRET = secret;
  delete process.env.ALLOW_DEV_AUTH_BYPASS;
  const jwt = companyId => {
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ tenantId: companyId, exp: Math.floor(Date.now() / 1000) + 60 })).toString('base64url');
    return `${header}.${payload}.${crypto.createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')}`;
  };
  const token = jwt(tenant);
  const app = express();
  app.use(express.json(), createJwtAuthMiddleware(), require('../src/api/routes/media'));
  const server = await new Promise(resolve => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (authorization, suffix = '') => fetch(`${base}/media/access${suffix}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}) }, body: JSON.stringify({ path: reference }) });
  try {
    assert.equal((await post(null)).status, 401);
    assert.equal((await post(null, `?token=${token}`)).status, 401);
    assert.equal((await post(jwt('another-tenant'))).status, 404);
    const response = await post(token);
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.ok(result.url.includes('access='));
    assert.ok(!result.url.includes(token));
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.rm(path.join(root, tenant), { recursive: true, force: true });
    if (originalSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = originalSecret;
    if (originalBypass === undefined) delete process.env.ALLOW_DEV_AUTH_BYPASS; else process.env.ALLOW_DEV_AUTH_BYPASS = originalBypass;
  }
});

test('upload metadata survives cache loss and process restart', async () => {
  const saved = await media.saveBuffer({ buffer: Buffer.from('persistent media'), tenantId: 'media-test-persistence', type: 'document', mimeType: 'text/plain', sourceFileName: 'persist.txt' });
  const cache = require('../services/enterprise/cache-service');
  const originalGet = cache.getJson;
  const servicePath = require.resolve('../services/enterprise/media-service');
  cache.getJson = async () => null;
  delete require.cache[servicePath];
  try {
    const freshService = require(servicePath);
    const metadata = await freshService.getMetadata(saved.id);
    assert.equal(metadata.tenantId, 'media-test-persistence');
    assert.equal(metadata.url, saved.url);
    assert.equal(await fs.readFile(metadata.absolutePath, 'utf8'), 'persistent media');
  } finally {
    cache.getJson = originalGet;
    const root = path.resolve(__dirname, '../../storage/media');
    await fs.rm(path.join(root, 'media-test-persistence'), { recursive: true, force: true });
    await fs.rm(path.join(root, '.metadata', `${saved.id}.json`), { force: true });
    delete require.cache[servicePath];
  }
});
