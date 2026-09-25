const { chromium } = require('../frontend-official/node_modules/playwright');
const crypto = require('crypto');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://209.50.241.22/');
  const secret = '73d1ef96dde5afc4938e0b71a5978b2666f1885fb0d2febc4bd52cc7a1cd9e15';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 'admin', companyId: 'default', tenantId: 'default', role: 'admin', exp: Math.floor(Date.now() / 1000) + 86400 })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(header + '.' + payload).digest('base64url');
  const token = header + '.' + payload + '.' + sig;
  const authSession = {
    token,
    username: 'admin',
    role: 'admin',
    tenantId: 'default',
    companyId: 'default',
    issuedAt: Date.now(),
    expiresAt: Date.now() + 86400000,
    remember: true
  };
  await page.evaluate((session) => {
    localStorage.setItem('zapai_admin_auth_session', JSON.stringify(session));
  }, authSession);

  await page.goto('http://209.50.241.22/ai?tab=evolution');
  await page.waitForTimeout(4000);
  
  const pageDom = await page.evaluate(() => {
    const stage = document.querySelector('.zai-character-stage');
    const stageChildren = stage ? Array.from(stage.children).map(c => ({
      tag: c.tagName,
      className: c.className,
      rect: c.getBoundingClientRect()
    })) : [];

    const character3d = document.querySelector('.zai-character-3d');
    const character3dHtml = character3d ? character3d.innerHTML.slice(0, 500) : null;

    const svgs = Array.from(document.querySelectorAll('svg')).map(s => ({
      parentClass: s.parentElement?.className,
      viewBox: s.getAttribute('viewBox'),
      rect: s.getBoundingClientRect()
    }));

    return {
      url: window.location.href,
      titles: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.innerText),
      stageFound: Boolean(stage),
      stageChildren,
      character3dHtml,
      svgCount: svgs.length,
      svgs
    };
  });
  console.log('PAGE DOM:', JSON.stringify(pageDom, null, 2));
  await browser.close();
})();
