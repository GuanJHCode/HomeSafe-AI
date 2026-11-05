import assert from 'node:assert/strict';

const { default: puppeteer } = await import('/workspace/homesafe-test-tools/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js');
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 1000 });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:4173/preview/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.querySelector('.report .hash') &&
    document.querySelector('[aria-label="检查结果"]')?.getAttribute('aria-busy') === 'false');
  const initial = await page.$eval('.report .hash', element => element.textContent);
  const bounds = await page.$eval('.viewport canvas', element => {
    element.scrollIntoView({ block: 'center' });
    const { left, top, width, height } = element.getBoundingClientRect();
    return { left, top, width, height };
  });
  const eye = [-2.76, 5.16, -3.92];
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const dot = (a, b) => a.reduce((n, v, i) => n + v * b[i], 0);
  const unit = a => a.map(v => v / Math.hypot(...a));
  const cross = ([x, y, z], [a, b, c]) => [y * c - z * b, z * a - x * c, x * b - y * a];
  const forward = unit(sub([3, 0.45, 2.24], eye));
  const right = unit(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  const offset = sub([5.3, 0.4, 3.3], eye);
  const scale = bounds.height / (2 * Math.tan(24 * Math.PI / 180) * dot(offset, forward));
  const x = bounds.left + bounds.width / 2 + scale * dot(offset, right);
  const y = bounds.top + bounds.height / 2 - scale * dot(offset, up);
  const state = () => page.evaluate(() => {
    const canvas = document.querySelector('.viewport canvas');
    const report = document.querySelector('.report');
    return { dragging: canvas?.dataset.dragging === 'true',
      reportVisible: !!report && report.getClientRects().length > 0,
      status: [...document.querySelectorAll('[role="status"]')].some(node => node.textContent?.includes('正在预览家具位置')) };
  });
  await page.mouse.move(x, y);
  await page.mouse.down();
  assert.deepEqual(await state(), { dragging: true, reportVisible: false, status: true });
  await page.mouse.up();
  await page.waitForFunction(() => document.querySelector('.report')?.getClientRects().length > 0);
  assert.deepEqual(await state(), { dragging: false, reportVisible: true, status: false });
  assert.equal(await page.$eval('.report .hash', element => element.textContent), initial);
  await page.mouse.down();
  assert.equal((await state()).dragging, true);
  await page.select('.toolbar select', 'cabinet');
  await page.waitForFunction(() => document.querySelector('.report')?.getClientRects().length > 0);
  assert.deepEqual(await state(), { dragging: false, reportVisible: true, status: false });
  assert.equal(await page.$eval('.report .hash', element => element.textContent), initial);
  await page.mouse.up();
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', browser: await browser.version(),
    cases: ['stationary pointer hold gates output', 'stationary release restores unchanged report',
      'selection change cancels drag and restores unchanged report'], input_hash: initial }, null, 2));
} finally { await browser.close(); }
