const { test, expect } = require('@playwright/test');

test('all graph groups render in the real browser', async ({ page }) => {
  test.setTimeout(120000);
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto('http://127.0.0.1:8000/graph/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Plotly && typeof window.Plotly.newPlot === 'function');
  await page.waitForSelector('#manualTable tbody input', { state: 'attached' });

  const groups = await page.locator('#chartGroup option').evaluateAll((options) =>
    options.map((o) => o.value).filter(Boolean)
  );

  const results = [];
  for (const group of groups) {
    await page.selectOption('#chartGroup', group);
    await page.click('#generateBtn');
    await page.waitForTimeout(700);

    const cards = await page.locator('.chart-card').count();
    const errors = await page.locator('.plot-error').allTextContents();
    const rendered = await page.locator('.plot').evaluateAll((plots) =>
      plots.filter((plot) => Array.isArray(plot.data) && plot.data.length >= 0 && plot._fullLayout).length
    );
    results.push({ group, cards, rendered, errors });
  }

  console.log('E2E_RESULTS=' + JSON.stringify(results));
  console.log('PAGE_ERRORS=' + JSON.stringify(pageErrors));
  console.log('CONSOLE_ERRORS=' + JSON.stringify(consoleErrors));

  for (const item of results) {
    expect(item.cards, item.group + ' should produce at least one chart card').toBeGreaterThan(0);
    expect(item.errors, item.group + ' plot errors: ' + item.errors.join(' | ')).toEqual([]);
    expect(item.rendered, item.group + ' should render all chart cards').toBe(item.cards);
  }
  expect(pageErrors, 'page errors: ' + pageErrors.join('\n')).toEqual([]);
});


test('publication palette presets and manual colors work in the real browser', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto('http://127.0.0.1:8000/graph/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Plotly && typeof window.Plotly.newPlot === 'function');

  await page.selectOption('#chartGroup', 'BAR');
  await page.click('#generateBtn');
  await page.waitForSelector('.chart-card.is-selected .plot');

  const paletteCount = await page.locator('.g2-palette-card').count();
  expect(paletteCount).toBeGreaterThanOrEqual(10);

  await page.locator('.g2-palette-card[data-palette="단색 · Navy"]').click();
  await page.waitForTimeout(250);

  const navyColors = await page.locator('.chart-card.is-selected .plot').evaluate((plot) =>
    plot.data.map((trace) => trace.marker?.color).filter(Boolean)
  );
  expect(navyColors.length).toBeGreaterThan(1);
  navyColors.forEach((color) => expect(String(color).toUpperCase()).toBe('#1F3A5F'));

  const firstColor = page.locator('.g2-color-input').first();
  await expect(firstColor).toBeAttached();
  await firstColor.evaluate((input) => {
    input.value = '#A61B1B';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(250);

  const firstTraceColor = await page.locator('.chart-card.is-selected .plot').evaluate((plot) =>
    plot.data[0].marker?.color || plot.data[0].line?.color || null
  );
  expect(String(firstTraceColor).toUpperCase()).toBe('#A61B1B');

  expect(pageErrors, 'page errors: ' + pageErrors.join('\n')).toEqual([]);
});
