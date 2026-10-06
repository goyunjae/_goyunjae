const { test, expect } = require('@playwright/test');

test('all graph groups render in the real browser', async ({ page }) => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto('http://127.0.0.1:8000/graph/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Plotly && typeof window.Plotly.newPlot === 'function');
  await page.waitForSelector('#manualTable tbody input');

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
