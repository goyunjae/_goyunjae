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
    const expectedCards = await page.evaluate((selectedGroup) =>
      window.chartSpecs().filter((spec) => spec.group === selectedGroup).length,
      group
    );

    await page.click('#generateBtn');
    await expect(page.locator('.chart-card')).toHaveCount(expectedCards, { timeout: 30000 });
    await page.waitForFunction(
      (expected) => {
        const plots = Array.from(document.querySelectorAll('.chart-card .plot'));
        return plots.length === expected &&
          plots.every((plot) => Boolean(plot._fullLayout) || Boolean(plot.querySelector('.plot-error')));
      },
      expectedCards,
      { timeout: 30000 }
    );

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
  navyColors.forEach((color) => expect(String(color).toUpperCase()).toBe('#526B86'));

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


test('Grapher-style object manager edits individual chart objects', async ({ page }) => {
  test.setTimeout(60000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto('http://127.0.0.1:8000/graph/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Plotly && typeof window.Plotly.newPlot === 'function');

  await page.selectOption('#chartGroup', 'BAR');
  await page.click('#generateBtn');
  await page.waitForSelector('.chart-card.is-selected .plot .barlayer');

  const objectRows = page.locator('.g2-object-row');
  await expect(objectRows.first()).toBeVisible();
  expect(await objectRows.count()).toBeGreaterThan(3);

  const itemRow = page.locator('.g2-object-row[data-kind="point"][data-trace-index="0"][data-point-index="1"]');
  await expect(itemRow).toBeVisible();
  await itemRow.click();

  const selectedColor = page.locator('#g2SelectedObjectColor');
  await expect(selectedColor).toHaveAttribute('data-kind', 'point');
  await expect(selectedColor).toHaveAttribute('data-point-index', '1');

  await selectedColor.evaluate((input) => {
    input.value = '#B423A8';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);

  const editedBarColors = await page.locator('.chart-card.is-selected .plot').evaluate((plot) => plot.data[0].marker?.color);
  expect(Array.isArray(editedBarColors)).toBeTruthy();
  expect(String(editedBarColors[1]).toUpperCase()).toBe('#B423A8');

  const bars = page.locator('.chart-card.is-selected .plot .barlayer .point');
  expect(await bars.count()).toBeGreaterThan(2);
  await bars.nth(2).click({ force: true });
  await page.waitForTimeout(150);

  await expect(page.locator('#g2SelectedObjectColor')).toHaveAttribute('data-kind', 'point');
  await expect(page.locator('#g2SelectedObjectColor')).toHaveAttribute('data-point-index', '2');

  await page.locator('#g2SelectedObjectColor').evaluate((input) => {
    input.value = '#18794E';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.waitForTimeout(200);

  const directClickColors = await page.locator('.chart-card.is-selected .plot').evaluate((plot) => plot.data[0].marker?.color);
  expect(String(directClickColors[2]).toUpperCase()).toBe('#18794E');

  expect(pageErrors, 'page errors: ' + pageErrors.join('\n')).toEqual([]);
});


test('editor sections collapse and pastel GEO/PCA controls render correctly', async ({ page }) => {
  test.setTimeout(90000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto('http://127.0.0.1:8000/graph/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Plotly && typeof window.Plotly.newPlot === 'function');

  // Collapsible editor sections
  await page.selectOption('#chartGroup', 'BAR');
  await page.click('#generateBtn');
  await page.waitForSelector('details[data-section-key="palette"]');
  expect(await page.locator('details[data-section-key]').count()).toBeGreaterThanOrEqual(4);

  const colorsSection = page.locator('details[data-section-key="palette"]');
  expect(await colorsSection.evaluate((node) => node.open)).toBeTruthy();
  await colorsSection.locator('summary').click();
  expect(await colorsSection.evaluate((node) => node.open)).toBeFalsy();
  await colorsSection.locator('summary').click();
  expect(await colorsSection.evaluate((node) => node.open)).toBeTruthy();

  // Grapher-like Property Manager: Plot / Symbol / Labels / Line / Fill
  const objectSection = page.locator('details[data-section-key="objects"]');
  await expect(objectSection).toBeVisible();
  const propertySections = objectSection.locator('details[data-object-section-key]');
  expect(await propertySections.count()).toBe(5);
  for (const key of ['plot','symbol','labels','line','fill']) {
    await expect(objectSection.locator(`details[data-object-section-key="${key}"]`)).toBeAttached();
  }
  const labelsSection = objectSection.locator('details[data-object-section-key="labels"]');
  expect(await labelsSection.evaluate((node) => node.open)).toBeFalsy();
  await labelsSection.locator('summary').click();
  expect(await labelsSection.evaluate((node) => node.open)).toBeTruthy();

  // GEO: use actual station labels so the precision engine can resolve exact coordinates.
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('#manualTable tbody tr:first-child input');
    const labels = ['사업 성과 추이', '서울', '부산', '대전'];
    labels.forEach((value, index) => {
      if (!inputs[index]) return;
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
  await page.selectOption('#chartGroup', 'GEO');
  await page.click('#generateBtn');
  await expect(page.locator('.chart-card')).toHaveCount(5, { timeout: 20000 });
  await page.locator('.chart-card', { hasText: '정밀 값 보간 등고선' }).click();
  await expect(page.locator('#g2ContourInterval')).toBeVisible();

  await page.locator('#g2ContourInterval').fill('5');
  await page.locator('#g2ContourPower').fill('3.5');
  await page.locator('#g2ContourLineWidth').fill('2');
  await page.locator('#g2ContourLineColor').evaluate((input) => {
    input.value = '#D99080';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#g2Regenerate').click();
  await expect(page.locator('.chart-card')).toHaveCount(5, { timeout: 20000 });

  const geoContourCard = page.locator('.chart-card', { hasText: '정밀 값 보간 등고선' });
  await expect(geoContourCard).toBeVisible();
  const geoState = await geoContourCard.locator('.plot').evaluate((plot) => {
    const trace = plot.data.find((item) => item.name === '보간 등고선');
    const lon = (trace?.lon || []).filter((value) => value != null);
    const lat = (trace?.lat || []).filter((value) => value != null);
    return {
      lineWidth: trace?.line?.width,
      lineColor: trace?.line?.color,
      points: lon.length,
      finite: lon.every(Number.isFinite) && lat.every(Number.isFinite),
      type: trace?.type,
    };
  });
  const contourInterval = await page.evaluate(() => window.G2ScienceSettings?.contourInterval);
  expect(contourInterval).toBe(5);
  expect(geoState.type).toBe('scattermap');
  expect(Number(geoState.lineWidth)).toBeCloseTo(2, 5);
  expect(String(geoState.lineColor).toUpperCase()).toBe('#D99080');
  expect(geoState.points).toBeGreaterThan(10);
  expect(geoState.finite).toBeTruthy();

  // PCA: automatic groups displayed with pastel ellipse regions
  await page.selectOption('#chartGroup', 'ANALYSIS');
  await page.click('#generateBtn');
  await page.waitForTimeout(700);
  await expect(page.locator('#g2RegionCount')).toBeVisible();
  await page.locator('#g2RegionCount').fill('2');
  await page.locator('#g2PcaEllipseScale').fill('1.8');
  await page.locator('#g2Regenerate').click();
  await page.waitForTimeout(800);

  const pcaCard = page.locator('.chart-card', { hasText: 'PCA 점수 · 그룹 타원' });
  await expect(pcaCard).toBeVisible();
  const pcaState = await pcaCard.locator('.plot').evaluate((plot) => {
    const ellipses = plot.data.filter((trace) => trace.fill === 'toself');
    const groups = plot.data.filter((trace) => /^Group \d+$/.test(String(trace.name || '')));
    return {
      ellipseCount: ellipses.length,
      groupCount: groups.length,
      pastelFills: ellipses.map((trace) => trace.fillcolor),
      groupNames: groups.map((trace) => trace.name),
    };
  });
  expect(pcaState.groupCount).toBe(2);
  expect(pcaState.ellipseCount).toBe(2);
  expect(pcaState.pastelFills.every((value) => String(value).startsWith('rgba('))).toBeTruthy();

  expect(pageErrors, 'page errors: ' + pageErrors.join('\n')).toEqual([]);
});


test('precision GEO uses MapLibre tile maps and geodesic overlays', async ({ page }) => {
  test.setTimeout(90000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

  await page.goto('http://127.0.0.1:8000/graph/', { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.Plotly && typeof window.Plotly.newPlot === 'function');

  // GEO uses column labels as station names. Grid Data is hidden in Preview, so update it through the DOM.
  await page.evaluate(() => {
    const inputs = document.querySelectorAll('#manualTable tbody tr:first-child input');
    const labels = ['사업 성과 추이', '서울', '부산', '대전'];
    labels.forEach((value, index) => {
      if (!inputs[index]) return;
      inputs[index].value = value;
      inputs[index].dispatchEvent(new Event('input', { bubbles: true }));
      inputs[index].dispatchEvent(new Event('change', { bubbles: true }));
    });
  });

  await page.selectOption('#chartGroup', 'GEO');
  await page.click('#generateBtn');

  const cards = page.locator('.chart-card');
  await expect(cards).toHaveCount(5, { timeout: 20000 });

  const bubble = page.locator('.chart-card', { hasText: '정밀 관측점 지도' });
  await expect(bubble).toBeVisible();
  const mapState = await bubble.locator('.plot').evaluate((plot) => ({
    traceTypes: plot.data.map((trace) => trace.type),
    mapStyle: plot.layout?.map?.style,
    zoom: plot.layout?.map?.zoom,
    hasGeoLayout: Boolean(plot.layout?.geo),
    latPrecision: plot.data[0]?.lat?.[0],
    lonPrecision: plot.data[0]?.lon?.[0],
  }));
  expect(mapState.traceTypes.every((type) => type === 'scattermap')).toBeTruthy();
  expect(mapState.mapStyle).toBe('carto-voyager');
  expect(mapState.hasGeoLayout).toBeFalsy();
  expect(Number(mapState.latPrecision)).toBeCloseTo(37.5665, 4);
  expect(Number(mapState.lonPrecision)).toBeCloseTo(126.9780, 4);

  // MapLibre canvas proves that this is a tile map, not the old outline-based scattergeo.
  await expect(bubble.locator('.maplibregl-canvas')).toBeVisible();

  // Change to a different detailed base map and explicit zoom.
  await bubble.click();
  await expect(page.locator('#g2MapStyle')).toBeVisible();
  await page.selectOption('#g2MapStyle', 'open-street-map');
  await page.locator('#g2MapZoom').fill('6.5');
  await page.locator('#g2Regenerate').click();
  await expect(page.locator('.chart-card')).toHaveCount(5, { timeout: 20000 });

  const restyled = await page.locator('.chart-card', { hasText: '정밀 관측점 지도' }).locator('.plot').evaluate((plot) => ({
    style: plot.layout?.map?.style,
    zoom: plot.layout?.map?.zoom,
  }));
  expect(restyled.style).toBe('open-street-map');
  expect(Number(restyled.zoom)).toBeCloseTo(6.5, 4);

  // Value contour must be drawn on the tile map in lon/lat.
  const contour = page.locator('.chart-card', { hasText: '정밀 값 보간 등고선' });
  await expect(contour).toBeVisible();
  const contourState = await contour.locator('.plot').evaluate((plot) => ({
    traceTypes: plot.data.map((trace) => trace.type),
    hasMap: Boolean(plot.layout?.map),
    contourPoints: plot.data[0]?.lon?.filter((value) => value != null).length || 0,
    finite: (plot.data[0]?.lon || []).filter((v) => v != null).every(Number.isFinite) &&
      (plot.data[0]?.lat || []).filter((v) => v != null).every(Number.isFinite),
  }));
  expect(contourState.traceTypes.every((type) => type === 'scattermap')).toBeTruthy();
  expect(contourState.hasMap).toBeTruthy();
  expect(contourState.contourPoints).toBeGreaterThan(10);
  expect(contourState.finite).toBeTruthy();

  expect(pageErrors, 'page errors: ' + pageErrors.join('\n')).toEqual([]);
});
