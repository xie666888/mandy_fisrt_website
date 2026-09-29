// Usage: node scripts/test_seo_browser.cjs URL OUTPUT_DIRECTORY
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const base = process.argv[2] || 'http://127.0.0.1:4189';
  const output = process.argv[3];
  if (!output) throw new Error('An output directory outside the repository is required');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.locator('[data-action="search"]').waitFor();
    const search = page.locator('[data-action="search"]');
    await search.pressSequentially('lip', { delay: 120 });
    assert.equal(await page.locator('[data-action="search"]').inputValue(), 'lip');
    assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'search');
    assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /noindex/);
    await page.keyboard.press('Escape');
    await page.locator('[data-clear-filter="all"]').click();
    await page.locator('.brand-rail a[data-filter-brand]').first().click();
    assert.match(await page.locator('link[rel="canonical"]').getAttribute('href'), /^https:\/\/bebeauty.top\/\?brand=/);
    await page.screenshot({ path: path.join(output, 'catalog-desktop.png'), fullPage: false });
    const first = await page.locator('a[data-detail]').first().getAttribute('data-detail');
    await page.locator('a[data-detail]').first().click();
    await page.locator('[data-add]').waitFor();
    const schema = await page.evaluate(() => JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent));
    const product = schema['@graph'].find((value) => value['@type'] === 'Product');
    assert.equal(product.url, 'https://bebeauty.top/product/' + encodeURIComponent(first));
    await page.locator('[data-add]').click();
    assert.equal(new URL(page.url()).pathname, '/product/' + encodeURIComponent(first));
    assert.equal(await page.locator('.cart-count').innerText(), '1');
    await page.waitForFunction(() => {
      const image = document.querySelector('.gallery .product-image img');
      return image?.complete && image.naturalWidth > 0;
    }, null, { timeout: 60000 });
    await page.screenshot({ path: path.join(output, 'product-desktop.png'), fullPage: false });
    await page.locator('.nav [data-view="catalog"]').click();
    assert.equal(await page.locator('meta[property="og:image"]').count(), 0);
    assert.equal(await page.evaluate(() => document.head.textContent.includes('"@type":"Product"')), false);
    await page.locator('.nav [data-view="admin"]').click();
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow');
    assert.equal(await page.locator('script[type="application/ld+json"]').count(), 0);
    await page.goto(base);
    await page.locator('[data-action="search"]').waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(output, 'catalog-mobile.png'), fullPage: false });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('a[data-detail]').first().click();
    await page.locator('[data-add]').waitFor();
    await page.screenshot({ path: path.join(output, 'product-mobile.png'), fullPage: false });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.goto(base + '/ordering');
    assert.match(await page.locator('h1').innerText(), /Ordering/);
    assert.equal(await page.locator('script[src*="app.js"]').count(), 0);
    assert.deepEqual(errors, []);
    console.log('PASS: desktop/mobile, search focus, canonical/schema navigation, images, cart, admin noindex, ordering.');
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
