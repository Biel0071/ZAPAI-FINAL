import { chromium } from 'playwright';
import { writeFileSync } from 'fs';

const BRAIN = 'C:\\Users\\Dell\\.gemini\\antigravity\\brain\\db0b0bae-04cc-4436-b07c-b73a824dacdf';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 1440, height: 900 });

// Login
await page.goto('http://209.50.241.22/login', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForTimeout(2000);

// Fill login
const emailInput = page.locator('input').first();
await emailInput.fill('zapadmin');
await page.locator('input[type="password"]').fill('zapadmin1010');
await page.locator('button[type="submit"]').click();
await page.waitForTimeout(5000);

// Navigate to evolution tab
await page.goto('http://209.50.241.22/ai?tab=evolution', { waitUntil: 'domcontentloaded', timeout: 40000 });
await page.waitForTimeout(5000);

const shot1 = await page.screenshot({ fullPage: false });
writeFileSync(`${BRAIN}\\vps_evolution_final_fixed.png`, shot1);
console.log('Viewport screenshot saved');

const shot2 = await page.screenshot({ fullPage: true });
writeFileSync(`${BRAIN}\\vps_evolution_final_fixed_full.png`, shot2);
console.log('Full page screenshot saved');

await browser.close();
console.log('DONE');
