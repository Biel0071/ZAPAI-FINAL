const { chromium } = require('../../frontend-official/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--ignore-certificate-errors'] });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto('https://209.50.241.22:1000/login');
  await page.locator('#login-username').fill('zapadmin');
  await page.locator('#login-password').fill('zapadmin1010');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(3000);
  await page.goto('https://209.50.241.22:1000/inbox');
  await page.waitForTimeout(3000);

  // Click on "Andrade" specifically by text or selector
  const andradeP = page.locator('text=Andrade').first();
  await andradeP.click();
  await page.waitForTimeout(3000);

  const data = await page.evaluate(() => {
    const bubbles = Array.from(document.querySelectorAll('[data-message-id], .message-bubble, p'));
    const checks = Array.from(document.querySelectorAll('[aria-label*="1V"], [aria-label*="2V"], svg')).map(el => ({
      ariaLabel: el.getAttribute('aria-label'),
      title: el.getAttribute('title'),
      className: el.getAttribute('class')
    })).filter(x => x.ariaLabel || (x.className && x.className.includes('Check')));

    return {
      activeContactName: document.querySelector('header h2, header h3, header span.font-semibold, .font-medium')?.textContent,
      checksSample: checks.slice(0, 10),
      totalChecksFound: checks.length
    };
  });

  console.log('DOM INSPECTION RESULT:', JSON.stringify(data, null, 2));
  await browser.close();
})();
