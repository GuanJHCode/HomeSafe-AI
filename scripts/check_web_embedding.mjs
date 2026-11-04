// Controlled iframe compatibility probe. This does not prove a hosting platform's embedding policy.
// node scripts/check_web_embedding.mjs APP_URL OTHER_ORIGIN_PARENT_URL CHROMIUM PUPPETEER_ENTRY
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const [appUrl, parentUrl, chrome, driver] = process.argv.slice(2);
if (!appUrl || !parentUrl || !chrome || !driver) throw new Error('Pass app URL, separate-origin parent URL, isolated Chromium and driver.');
assert.notEqual(new URL(appUrl).origin, new URL(parentUrl).origin, 'Cross-origin parent must actually differ');
const { launch } = await import(pathToFileURL(resolve(driver)).href);
const browser = await launch({ executablePath: chrome, headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...(process.env.CI ? ['--no-sandbox'] : [])] });
const results = [];
try {
  for (const [kind, parent] of [['same-origin', appUrl], ['cross-origin', parentUrl]]) {
    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1280, height: 1000 });
      const response = await page.goto(parent, { waitUntil: 'domcontentloaded' });
      assert.ok(response?.ok());
      // Replaces this temporary parent document only; no server or product modification.
      await page.evaluate(src => {
        document.body.replaceChildren();
        const frame = document.createElement('iframe'); frame.src = src;
        frame.width = '1200'; frame.height = '900'; frame.title = 'Controlled HomeSafe compatibility probe';
        document.body.append(frame);
      }, appUrl);
      await page.waitForSelector('iframe');
      const element = await page.$('iframe');
      const frame = await element.contentFrame();
      assert.ok(frame, 'Controlled iframe context is available');
      await frame.waitForFunction(() => document.querySelector('.report .hash') &&
        document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false', { timeout: 120000 });
      const firstHash = await frame.$eval('.report .hash', node => node.textContent);
      await frame.select('.toolbar select', 'chair');
      await frame.click('button[aria-label="向前移动"]');
      await frame.waitForFunction(before => {
        const hash = document.querySelector('.report .hash')?.textContent?.trim();
        const panel = document.querySelector('[aria-label="检查结果"]');
        return Boolean(hash && hash !== before.trim() && panel?.getAttribute('aria-busy') === 'false' &&
          !panel.querySelector('[role="alert"]'));
      }, { timeout: 60000 }, firstHash);
      assert.ok(await frame.$('canvas'));
      results.push({ kind, parent_origin: new URL(parent).origin, child_origin: new URL(appUrl).origin,
        result: 'PASS', cases: ['frame loads', 'real Worker/WASM accepted assessment', 'button move recomputes current report'] });
    } finally { await page.close(); }
  }
  console.log(JSON.stringify({ scope: 'CONTROLLED_LOCAL_IFRAME_PROBE', measured_at: new Date().toISOString(),
    browser: await browser.version(), app_url: appUrl, results,
    limitation: 'Temporary unsandboxed parent documents; does not prove target platform CSP/sandbox/HTTPS or other-network behavior.' }, null, 2));
} finally { await browser.close(); }
