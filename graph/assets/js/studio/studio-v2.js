(function () {
  'use strict';

  const VERSION = '20261006.3';
  const state = {
    selectedCard: null,
    selectedPlot: null,
    selectedObject: null,
    view: 'preview',
    editorTimer: null,
  };

  const PALETTES = {
    '색각 안전': ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#F0E442', '#000000'],
    '논문 기본': ['#3B5BA7', '#D65F5F', '#3A923A', '#8C6BB1', '#E3A018', '#4C9FBE', '#8C564B', '#6B7280'],
    'Muted': ['#4C78A8', '#F58518', '#54A24B', '#E45756', '#72B7B2', '#B279A2', '#FF9DA6', '#9D755D'],
    'High contrast': ['#1F77B4', '#D62728', '#2CA02C', '#9467BD', '#FF7F0E', '#17BECF', '#8C564B', '#111111'],
    'Viridis': ['#440154', '#414487', '#2A788E', '#22A884', '#7AD151', '#FDE725'],
    'Gray scale': ['#111111', '#333333', '#555555', '#777777', '#999999', '#BBBBBB', '#DDDDDD'],
    'Blue scale': ['#0B1F33', '#123A5A', '#1E5A85', '#3478A9', '#5B96C3', '#8BB5D4', '#BDD3E6'],
    'Red scale': ['#3B0A0A', '#6D1616', '#982626', '#B83A3A', '#D65A5A', '#E78A8A', '#F3BABA'],
    'Green scale': ['#0B2E20', '#155239', '#1F7552', '#32966C', '#58B488', '#8DCEAD', '#C2E5D2'],
    'Purple scale': ['#21103A', '#3C1D62', '#5A2A86', '#7840A6', '#9666BD', '#B792D1', '#D8C4E5'],
    '단색 · Black': Array(12).fill('#222222'),
    '단색 · Navy': Array(12).fill('#1F3A5F'),
    '단색 · Blue': Array(12).fill('#2563EB'),
    '단색 · Red': Array(12).fill('#B42318'),
    '단색 · Green': Array(12).fill('#18794E'),
  };

  window.addEventListener('DOMContentLoaded', init);

  function init() {
    if (document.body.dataset.g2StudioV2 === VERSION) return;
    document.body.dataset.g2StudioV2 = VERSION;
    document.body.classList.add('g2-studio-v2');

    installTabs();
    installEditor();
    installChartSelection();
    installResizeHandling();
    installDataFeedback();
    updateTypeOptions();
    setView('preview');

    document.addEventListener('g2:charts-rendered', () => {
      updateTypeOptions();
      selectFirstChart();
      resizePlots();
    });

    const chartGroup = document.querySelector('#chartGroup');
    chartGroup?.addEventListener('change', () => updateTypeOptions(), { passive: true });
  }

  function installTabs() {
    if (document.querySelector('.g2-view-tabs')) return;
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    topbar.insertAdjacentHTML('beforebegin', `
      <nav class="g2-view-tabs" aria-label="보기 전환">
        <button type="button" class="g2-view-tab active" data-view="preview">Preview</button>
        <button type="button" class="g2-view-tab" data-view="data">Grid Data</button>
      </nav>
    `);
    document.querySelectorAll('.g2-view-tab').forEach((button) => {
      button.addEventListener('click', () => setView(button.dataset.view));
    });
  }

  function setView(view) {
    state.view = view === 'data' ? 'data' : 'preview';
    document.body.dataset.g2View = state.view;
    document.querySelectorAll('.g2-view-tab').forEach((button) => button.classList.toggle('active', button.dataset.view === state.view));

    const dataCard = document.querySelector('.data-editor-card');
    const summary = document.querySelector('#summary');
    const chartGrid = document.querySelector('#chartGrid');
    const empty = document.querySelector('#emptyState');

    if (dataCard) dataCard.hidden = state.view !== 'data';
    if (summary) summary.hidden = state.view !== 'preview';
    if (chartGrid) chartGrid.hidden = state.view !== 'preview';
    if (empty) empty.hidden = state.view !== 'preview' || Boolean(chartGrid?.children.length);

    document.querySelector('#g2EditorPanel')?.removeAttribute('hidden');
    setTimeout(resizePlots, 50);
  }

  function installEditor() {
    const workspace = document.querySelector('.workspace');
    if (!workspace || document.querySelector('#g2EditorPanel')) return;
    workspace.insertAdjacentHTML('beforeend', `
      <aside id="g2EditorPanel" class="panel g2-editor-panel" aria-label="그래프 편집 패널">
        <header class="g2-editor-header">
          <div><strong>Figure editor</strong><span>선택한 그래프를 실시간 수정합니다.</span></div>
          <span id="g2EditorBadge" class="g2-editor-badge">No chart</span>
        </header>
        <div id="g2EditorBody" class="g2-editor-body">
          <div class="g2-editor-empty">Preview에서 그래프를 선택하면 편집 옵션이 표시됩니다.</div>
        </div>
      </aside>
    `);
  }

  function installChartSelection() {
    const grid = document.querySelector('#chartGrid');
    if (!grid) return;

    grid.addEventListener('pointerdown', (event) => {
      if (event.target.closest('button,input,select,textarea,label,a')) return;
      const card = event.target.closest('.chart-card');
      if (card) selectCard(card);
    }, true);

    const observer = new MutationObserver(debounce(() => {
      wireCards();
      if (!state.selectedCard || !document.body.contains(state.selectedCard)) selectFirstChart();
    }, 80));
    observer.observe(grid, { childList: true });
    wireCards();
  }

  function wireCards() {
    document.querySelectorAll('.chart-card').forEach((card) => {
      if (card.dataset.g2Wired === VERSION) return;
      card.dataset.g2Wired = VERSION;
      card.tabIndex = 0;
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectCard(card);
        }
      });
    });
  }

  function selectFirstChart() {
    const first = document.querySelector('.chart-card');
    if (first) selectCard(first, false);
    else renderEmptyEditor();
  }

  function selectCard(card, focus = true) {
    if (!card) return;
    state.selectedCard = card;
    state.selectedPlot = card.querySelector('.plot');
    state.selectedObject = normalizeSelectedObject(state.selectedPlot, state.selectedPlot?._g2SelectedObject);
    if (state.selectedPlot) {
      state.selectedPlot._g2SelectedObject = state.selectedObject;
      wirePlotObjectEvents(state.selectedPlot);
    }
    document.querySelectorAll('.chart-card.is-selected').forEach((node) => node.classList.remove('is-selected'));
    card.classList.add('is-selected');
    renderEditor();
    if (focus && matchMedia('(max-width: 1180px)').matches) {
      document.querySelector('#g2EditorPanel')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }

  function renderEmptyEditor() {
    state.selectedCard = null;
    state.selectedPlot = null;
    state.selectedObject = null;
    const body = document.querySelector('#g2EditorBody');
    const badge = document.querySelector('#g2EditorBadge');
    if (badge) badge.textContent = 'No chart';
    if (body) body.innerHTML = '<div class="g2-editor-empty">그래프를 생성한 뒤 카드를 선택하세요.</div>';
  }

  function renderEditor() {
    const plot = state.selectedPlot;
    const body = document.querySelector('#g2EditorBody');
    const badge = document.querySelector('#g2EditorBadge');
    if (!plot || !body || !plot.data) return renderEmptyEditor();

    const cardTitle = state.selectedCard?.querySelector('.chart-card-header h3')?.textContent?.trim() || detectType(plot);
    if (badge) badge.textContent = cardTitle;
    const layout = plot._fullLayout || plot.layout || {};
    const title = stripHtml(layout.title?.text || '');
    const isGeo = plot.data.some((trace) => ['scattergeo', 'choropleth'].includes(trace.type));
    const isContour = plot.data.some((trace) => trace.type === 'contour');
    const isSpatialCard = /^GEO\b/i.test(cardTitle) || isGeo || isContour;
    const isAnalysisCard = /^ANALYSIS\b/i.test(cardTitle);
    const isLine = plot.data.some((trace) => trace.type === 'scatter' && String(trace.mode || '').includes('lines'));
    const hasMarkers = plot.data.some((trace) => String(trace.mode || '').includes('markers') || trace.type === 'scattergeo');

    body.innerHTML = `
      <section class="g2-editor-section open">
        <h3>Layout</h3>
        ${field('Title', `<input id="g2Title" type="text" value="${escapeHtml(title)}">`)}
        <div class="g2-editor-grid two">
          ${field('Height', `<input id="g2Height" type="number" min="280" max="900" step="20" value="${Math.round(layout.height || plot.clientHeight || 420)}">`)}
          ${field('Font size', `<input id="g2FontSize" type="number" min="8" max="24" step="1" value="${Number(layout.font?.size || 12)}">`)}
        </div>
        <div class="g2-editor-grid two">
          ${field('Canvas', '<select id="g2Canvas"><option value="#FFFFFF">White</option><option value="#F8FAFC">Soft</option><option value="#111827">Ink</option></select>')}
          ${field('Grid', '<select id="g2Grid"><option value="light">Light</option><option value="none">None</option><option value="strong">Strong</option></select>')}
        </div>
        <div class="g2-palette-block">
          <div class="g2-subhead"><span>Publication palette</span><small>색상 세트를 클릭하면 바로 적용됩니다.</small></div>
          <div id="g2PaletteGrid" class="g2-palette-grid">${paletteButtons(plot)}</div>
        </div>
        <div class="g2-object-editor">
          <div class="g2-subhead"><span>Objects</span><small>Grapher처럼 개체를 선택한 뒤 속성을 수정합니다.</small></div>
          <div id="g2ObjectManager" class="g2-object-manager">${objectManagerHtml(plot)}</div>
          <div id="g2ObjectProperties" class="g2-object-properties">${selectedObjectPropertiesHtml(plot)}</div>
        </div>
        <label class="g2-check"><input id="g2Legend" type="checkbox" ${layout.showlegend === false ? '' : 'checked'}> Show legend</label>
        <label class="g2-check"><input id="g2Labels" type="checkbox" checked> Show labels</label>
      </section>
      <section class="g2-editor-section">
        <h3>Marks</h3>
        <div class="g2-editor-grid two">
          ${field('Line width', `<input id="g2LineWidth" type="range" min="0.5" max="6" step="0.25" value="2.25" ${isLine ? '' : 'disabled'}>`)}
          ${field('Marker size', `<input id="g2MarkerSize" type="range" min="3" max="24" step="1" value="9" ${hasMarkers ? '' : 'disabled'}>`)}
        </div>
      </section>
      ${(isSpatialCard || isAnalysisCard) ? spatialEditorHtml(plot, isSpatialCard, isAnalysisCard) : ''}
      <section class="g2-editor-actions">
        <button type="button" id="g2Apply">Apply</button>
        <button type="button" id="g2Regenerate" class="secondary">Regenerate</button>
      </section>
    `;

    bindEditorEvents();
  }

  function field(label, control) { return `<div class="g2-field"><label>${label}</label>${control}</div>`; }

  function paletteButtons(plot) {
    const active = plot._g2PaletteName || '색각 안전';
    return Object.entries(PALETTES).map(([name, colors]) => {
      const swatches = colors.slice(0, 6).map((color) => `<span style="background:${color}"></span>`).join('');
      return `
        <button type="button" class="g2-palette-card ${name === active ? 'active' : ''}" data-palette="${escapeHtml(name)}" aria-pressed="${name === active}">
          <span class="g2-palette-swatches">${swatches}</span>
          <strong>${escapeHtml(name)}</strong>
        </button>
      `;
    }).join('');
  }

  function objectManagerHtml(plot) {
    const selected = normalizeSelectedObject(plot, state.selectedObject || plot._g2SelectedObject);
    const rows = [];

    Array.from(plot.data || []).forEach((trace, traceIndex) => {
      const traceLabel = trace.name || traceObjectLabel(trace, traceIndex);
      const traceTarget = { kind: 'trace', traceIndex, pointIndex: null, label: traceLabel };
      rows.push(objectRowHtml(plot, traceTarget, 0));

      const pointCount = editablePointCount(trace);
      if (pointCount > 0 && pointCount <= 40) {
        const labels = editablePointLabels(trace, pointCount);
        for (let pointIndex = 0; pointIndex < pointCount; pointIndex += 1) {
          rows.push(objectRowHtml(plot, {
            kind: 'point',
            traceIndex,
            pointIndex,
            label: labels[pointIndex] || `Item ${pointIndex + 1}`,
          }, 1));
        }
      } else if (pointCount > 40) {
        rows.push(`<div class="g2-object-note">${escapeHtml(traceLabel)}: ${pointCount}개 항목 · 그래프에서 원하는 점을 클릭해 선택</div>`);
      }
    });

    return rows.join('') || '<p class="g2-help">편집 가능한 개체가 없습니다.</p>';
  }

  function objectRowHtml(plot, target, depth) {
    const selected = sameObject(target, normalizeSelectedObject(plot, state.selectedObject || plot._g2SelectedObject));
    const color = objectColor(plot, target);
    const typeLabel = target.kind === 'point' ? 'item' : 'series';
    return `
      <button
        type="button"
        class="g2-object-row ${selected ? 'active' : ''} depth-${depth}"
        data-kind="${target.kind}"
        data-trace-index="${target.traceIndex}"
        ${target.pointIndex == null ? '' : `data-point-index="${target.pointIndex}"`}
        title="${escapeHtml(target.label)}"
      >
        <span class="g2-object-color" style="background:${color}"></span>
        <span class="g2-object-name">${escapeHtml(target.label)}</span>
        <small>${typeLabel}</small>
      </button>
    `;
  }

  function selectedObjectPropertiesHtml(plot) {
    const target = normalizeSelectedObject(plot, state.selectedObject || plot._g2SelectedObject);
    if (!target) return '<p class="g2-help">왼쪽 Objects 목록이나 그래프 개체를 클릭하세요.</p>';
    const trace = plot.data?.[target.traceIndex];
    if (!trace) return '<p class="g2-help">선택한 개체를 찾을 수 없습니다.</p>';

    const color = objectColor(plot, target);
    const kindText = target.kind === 'point' ? '개별 항목' : '시리즈 / 레이어';
    const detail = target.kind === 'point'
      ? `Trace ${target.traceIndex + 1} · Item ${Number(target.pointIndex) + 1}`
      : `Trace ${target.traceIndex + 1} · ${trace.type || 'plot'}`;

    return `
      <div class="g2-object-property-head">
        <div>
          <strong>${escapeHtml(target.label)}</strong>
          <span>${kindText} · ${escapeHtml(detail)}</span>
        </div>
        <button type="button" id="g2ResetObjectColor" class="g2-mini-button">Reset</button>
      </div>
      <label class="g2-object-color-control">
        <input
          id="g2SelectedObjectColor"
          class="g2-color-input"
          type="color"
          value="${color}"
          data-kind="${target.kind}"
          data-trace-index="${target.traceIndex}"
          ${target.pointIndex == null ? '' : `data-point-index="${target.pointIndex}"`}
          aria-label="${escapeHtml(target.label)} 색상"
        >
        <span class="g2-color-chip large" style="background:${color}"></span>
        <span>
          <b>Color</b>
          <code>${color.toUpperCase()}</code>
        </span>
      </label>
      <p class="g2-help">${objectHelp(trace, target)}</p>
    `;
  }

  function objectHelp(trace, target) {
    if (target.kind === 'point') {
      if (trace.type === 'bar' || trace.type === 'waterfall' || trace.type === 'funnel') return '이 항목의 채움색만 변경합니다.';
      if (['pie', 'treemap', 'sunburst'].includes(trace.type)) return '이 조각/영역의 채움색만 변경합니다.';
      return '이 데이터 포인트의 마커 색만 변경합니다.';
    }
    if (trace.type === 'indicator') return 'KPI 숫자 색상을 변경합니다.';
    if (['heatmap', 'contour', 'choropleth'].includes(trace.type)) return '연속형 레이어는 위 Publication palette에서 전체 색상 스케일을 변경합니다.';
    if (trace.fill && trace.fill !== 'none') return '이 시리즈의 선과 채움색을 함께 변경합니다.';
    return '이 시리즈의 선/마커/채움 기본색을 변경합니다.';
  }

  function normalizeSelectedObject(plot, candidate) {
    if (!plot?.data?.length) return null;
    const traceIndex = Number(candidate?.traceIndex);
    const validTraceIndex = Number.isInteger(traceIndex) && traceIndex >= 0 && traceIndex < plot.data.length ? traceIndex : 0;
    const trace = plot.data[validTraceIndex];
    const pointIndex = Number(candidate?.pointIndex);
    const wantsPoint = candidate?.kind === 'point' && supportsPointEditing(trace) &&
      Number.isInteger(pointIndex) && pointIndex >= 0 && pointIndex < editablePointCount(trace);

    return wantsPoint ? {
      kind: 'point',
      traceIndex: validTraceIndex,
      pointIndex,
      label: editablePointLabels(trace, editablePointCount(trace))[pointIndex] || `Item ${pointIndex + 1}`,
    } : {
      kind: 'trace',
      traceIndex: validTraceIndex,
      pointIndex: null,
      label: trace.name || traceObjectLabel(trace, validTraceIndex),
    };
  }

  function sameObject(a, b) {
    return Boolean(a && b && a.kind === b.kind && a.traceIndex === b.traceIndex &&
      (a.kind !== 'point' || a.pointIndex === b.pointIndex));
  }

  function traceObjectLabel(trace, traceIndex) {
    const type = String(trace.type || 'plot').replace(/scatter/i, 'series');
    return `${type} ${traceIndex + 1}`;
  }

  function supportsPointEditing(trace) {
    if (!trace) return false;
    if (['bar', 'waterfall', 'funnel', 'pie', 'treemap', 'sunburst'].includes(trace.type)) return true;
    if (['scatter', 'scattergeo', 'scatterpolar'].includes(trace.type)) {
      const mode = String(trace.mode || '');
      if (!mode.includes('markers')) return false;
      const colors = trace.marker?.color;
      const numericScale = Array.isArray(colors) && colors.length > 0 &&
        colors.every((value) => Number.isFinite(Number(value)));
      return !numericScale;
    }
    return false;
  }

  function editablePointCount(trace) {
    if (!supportsPointEditing(trace)) return 0;
    if (Array.isArray(trace.values)) return trace.values.length;
    if (Array.isArray(trace.labels)) return trace.labels.length;
    if (Array.isArray(trace.x)) return trace.x.length;
    if (Array.isArray(trace.y)) return trace.y.length;
    if (Array.isArray(trace.lat)) return trace.lat.length;
    return 0;
  }

  function editablePointLabels(trace, count) {
    let source = [];
    if (Array.isArray(trace.labels)) source = trace.labels;
    else if (trace.type === 'bar' && trace.orientation === 'h' && Array.isArray(trace.y)) source = trace.y;
    else if (Array.isArray(trace.text) && trace.text.length === count) source = trace.text;
    else if (Array.isArray(trace.x)) source = trace.x;
    else if (Array.isArray(trace.y)) source = trace.y;
    else if (Array.isArray(trace.lat)) source = trace.lat.map((lat, i) => `${lat}, ${trace.lon?.[i] ?? ''}`);
    return Array.from({ length: count }, (_, i) => stripHtml(String(source[i] ?? `Item ${i + 1}`)).split('\n')[0]);
  }

  function objectColor(plot, target) {
    const palette = PALETTES[plot._g2PaletteName || '색각 안전'] || PALETTES['색각 안전'];
    const trace = plot.data?.[target.traceIndex];
    const fallback = palette[target.traceIndex % palette.length] || '#2563EB';
    if (!trace) return fallback;

    if (target.kind === 'point') {
      return plot._g2PointColors?.[target.traceIndex]?.[target.pointIndex] ||
        currentPointColor(trace, target.pointIndex, plot._g2TraceColors?.[target.traceIndex] || fallback);
    }
    return plot._g2TraceColors?.[target.traceIndex] || currentTraceColor(trace, fallback);
  }

  function currentTraceColor(trace, fallback) {
    const candidates = [trace.line?.color, trace.marker?.color, trace.fillcolor, trace.number?.font?.color];
    for (const value of candidates) {
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value;
    }
    return fallback;
  }

  function currentPointColor(trace, pointIndex, fallback) {
    const values = trace.marker?.colors || trace.marker?.color;
    if (Array.isArray(values)) {
      const value = values[pointIndex];
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) return value;
    }
    return fallback;
  }

  function selectObject(plot, target, rerender = true) {
    const normalized = normalizeSelectedObject(plot, target);
    if (!normalized) return;
    plot._g2SelectedObject = normalized;
    if (state.selectedPlot === plot) state.selectedObject = normalized;
    if (rerender && state.selectedPlot === plot) renderEditor();
  }

  function wirePlotObjectEvents(plot) {
    if (!plot || plot._g2ObjectEventsBound || typeof plot.on !== 'function') return;
    plot._g2ObjectEventsBound = true;
    plot.classList?.add('g2-object-clickable');
    plot.on('plotly_click', (event) => {
      const point = event?.points?.[0];
      if (!point) return;
      const traceIndex = Number(point.curveNumber);
      const trace = plot.data?.[traceIndex];
      if (!trace) return;
      const rawPointIndex = Array.isArray(point.pointNumber) ? point.pointNumber[0] : point.pointNumber;
      const pointIndex = Number(rawPointIndex);
      const target = supportsPointEditing(trace) && Number.isInteger(pointIndex)
        ? { kind: 'point', traceIndex, pointIndex }
        : { kind: 'trace', traceIndex, pointIndex: null };
      selectObject(plot, target, true);
    });
  }

  function setObjectColor(plot, target, color) {
    if (!plot || !target || !/^#[0-9a-f]{6}$/i.test(color)) return;
    const normalized = normalizeSelectedObject(plot, target);
    if (!normalized) return;
    if (normalized.kind === 'point') {
      plot._g2PointColors = plot._g2PointColors || {};
      plot._g2PointColors[normalized.traceIndex] = plot._g2PointColors[normalized.traceIndex] || {};
      plot._g2PointColors[normalized.traceIndex][normalized.pointIndex] = color.toUpperCase();
    } else {
      plot._g2TraceColors = plot._g2TraceColors || {};
      plot._g2TraceColors[normalized.traceIndex] = color.toUpperCase();
    }
    plot._g2SelectedObject = normalized;
    state.selectedObject = normalized;
    applyEditor();
  }

  function resetObjectColor(plot, target) {
    const normalized = normalizeSelectedObject(plot, target);
    if (!normalized) return;
    if (normalized.kind === 'point') {
      if (plot._g2PointColors?.[normalized.traceIndex]) {
        delete plot._g2PointColors[normalized.traceIndex][normalized.pointIndex];
      }
    } else if (plot._g2TraceColors) {
      delete plot._g2TraceColors[normalized.traceIndex];
    }
    applyEditor();
    renderEditor();
  }

  function spatialEditorHtml(plot, isSpatial, isAnalysis) {
    const science = window.G2ScienceSettings || {};
    const stationText = science.stationText || stationsFromPlot(plot);
    const rings = Array.isArray(science.ringDistances) ? science.ringDistances.join(', ') : '25, 50, 100';
    const interval = Number(science.contourInterval || 25);
    const regionCount = Number(science.regionCount || 3);
    const spatialFields = isSpatial ? `
        ${field('Station coordinates', `<textarea id="g2Stations" spellcheck="false" placeholder="서울,37.5665,126.9780">${escapeHtml(stationText)}</textarea>`)}
        <div class="g2-editor-grid two">
          ${field('Ring distances (km)', `<input id="g2Rings" type="text" value="${escapeHtml(rings)}">`)}
          ${field('Contour interval (km)', `<input id="g2ContourInterval" type="number" min="1" step="1" value="${interval}">`)}
        </div>
      ` : '';
    const analysisFields = isAnalysis ? field('Automatic PCA regions', `<input id="g2RegionCount" type="number" min="2" max="6" step="1" value="${regionCount}">`) : '';
    return `
      <section class="g2-editor-section g2-map-editor">
        <h3>${isSpatial ? 'Map & spatial analysis' : 'PCA analysis'}</h3>
        ${spatialFields}
        ${analysisFields}
        <p class="g2-help">${isSpatial ? '거리 링은 지정한 반경(km)을 표시하고, 거리 등고선은 관측점까지의 최근접 거리장을 km 단위로 계산합니다. 값을 바꾼 뒤 Regenerate를 누르세요.' : '영역 수를 바꾼 뒤 Regenerate를 누르면 PCA 점수 공간에서 k-means 영역을 다시 계산합니다.'}</p>
      </section>
    `;
  }

  function bindEditorEvents() {
    const panel = document.querySelector('#g2EditorPanel');
    const plot = state.selectedPlot;
    if (!panel || !plot) return;

    panel.querySelector('#g2Apply')?.addEventListener('click', applyEditor);
    panel.querySelector('#g2Regenerate')?.addEventListener('click', () => document.querySelector('#generateBtn')?.click());

    panel.querySelectorAll('.g2-palette-card').forEach((button) => {
      button.addEventListener('click', () => {
        const name = button.dataset.palette;
        if (!PALETTES[name]) return;
        plot._g2PaletteName = name;
        plot._g2TraceColors = {};
        plot._g2PointColors = {};
        applyEditor();
        renderEditor();
      });
    });

    panel.querySelectorAll('.g2-object-row').forEach((button) => {
      button.addEventListener('click', () => {
        selectObject(plot, {
          kind: button.dataset.kind,
          traceIndex: Number(button.dataset.traceIndex),
          pointIndex: button.dataset.pointIndex == null ? null : Number(button.dataset.pointIndex),
        }, true);
      });
    });

    panel.querySelector('#g2SelectedObjectColor')?.addEventListener('input', (event) => {
      const input = event.currentTarget;
      const target = {
        kind: input.dataset.kind,
        traceIndex: Number(input.dataset.traceIndex),
        pointIndex: input.dataset.pointIndex == null ? null : Number(input.dataset.pointIndex),
      };
      const color = input.value.toUpperCase();
      setObjectColor(plot, target, color);
      input.closest('.g2-object-color-control')?.querySelector('.g2-color-chip')?.style.setProperty('background', color);
      const code = input.closest('.g2-object-color-control')?.querySelector('code');
      if (code) code.textContent = color;
      const activeRow = panel.querySelector('.g2-object-row.active .g2-object-color');
      if (activeRow) activeRow.style.background = color;
    });

    panel.querySelector('#g2ResetObjectColor')?.addEventListener('click', () => {
      resetObjectColor(plot, state.selectedObject || plot._g2SelectedObject);
    });

    panel.querySelectorAll('input,select,textarea').forEach((control) => {
      if (control.id === 'g2SelectedObjectColor') return;
      const eventName = control.tagName === 'TEXTAREA' ? 'change' : 'input';
      control.addEventListener(eventName, () => {
        if (control.matches('#g2Stations,#g2Rings,#g2ContourInterval,#g2RegionCount')) {
          writeScienceSettings();
          return;
        }
        clearTimeout(state.editorTimer);
        state.editorTimer = setTimeout(applyEditor, 90);
      });
      if (control.tagName === 'SELECT') control.addEventListener('change', applyEditor);
    });
  }

  function applyEditor() {
    const plot = state.selectedPlot;
    const panel = document.querySelector('#g2EditorPanel');
    if (!plot || !panel || !window.Plotly || !plot.data) return;

    const title = panel.querySelector('#g2Title')?.value || '';
    const height = finite(panel.querySelector('#g2Height')?.value, plot.clientHeight || 420);
    const fontSize = finite(panel.querySelector('#g2FontSize')?.value, 12);
    const canvas = panel.querySelector('#g2Canvas')?.value || '#FFFFFF';
    const showLegend = panel.querySelector('#g2Legend')?.checked !== false;
    const showLabels = panel.querySelector('#g2Labels')?.checked !== false;
    const grid = panel.querySelector('#g2Grid')?.value || 'light';
    const gridColor = grid === 'none' ? 'rgba(0,0,0,0)' : grid === 'strong' ? '#CBD5E1' : '#E8EDF3';

    const layoutUpdate = {
      'title.text': title,
      height,
      paper_bgcolor: canvas,
      plot_bgcolor: canvas === '#111827' ? '#111827' : '#FFFFFF',
      'font.size': fontSize,
      'font.color': canvas === '#111827' ? '#F8FAFC' : '#1F2937',
      showlegend: showLegend,
      'xaxis.gridcolor': gridColor,
      'yaxis.gridcolor': gridColor,
      'xaxis.zerolinecolor': gridColor,
      'yaxis.zerolinecolor': gridColor,
    };

    try { Plotly.relayout(plot, layoutUpdate); } catch (_) {}

    const paletteName = plot._g2PaletteName || '색각 안전';
    const palette = PALETTES[paletteName] || PALETTES['색각 안전'];
    const lineWidth = finite(panel.querySelector('#g2LineWidth')?.value, 2.25);
    const markerSize = finite(panel.querySelector('#g2MarkerSize')?.value, 9);

    plot.data.forEach((trace, index) => {
      const baseColor = palette[index % palette.length];
      const color = plot._g2TraceColors?.[index] || baseColor;
      const pointOverrides = plot._g2PointColors?.[index] || {};
      const update = {};
      if (trace.type === 'bar' || trace.type === 'waterfall') {
        const count = Math.max(trace.x?.length || 0, trace.y?.length || 0);
        const hasPointOverrides = Object.keys(pointOverrides).length > 0;
        update['marker.color'] = hasPointOverrides
          ? [Array.from({ length: count }, (_, i) => pointOverrides[i] || color)]
          : color;
        update['marker.line.color'] = '#FFFFFF';
        update['marker.line.width'] = 0.8;
        update.textposition = showLabels ? (trace.orientation === 'h' ? 'outside' : 'auto') : 'none';
      } else if (trace.type === 'pie' || trace.type === 'treemap' || trace.type === 'sunburst') {
        const length = trace.values?.length || trace.labels?.length || palette.length;
        update['marker.colors'] = [Array.from({ length }, (_, i) => pointOverrides[i] || palette[i % palette.length])];
        if (trace.type === 'pie') update.textinfo = showLabels ? 'label+percent' : 'none';
      } else if (trace.type === 'heatmap' || trace.type === 'contour' || trace.type === 'choropleth') {
        update.colorscale = paletteScale(palette);
      } else if (trace.type === 'indicator') {
        update['number.font.color'] = color;
      } else {
        if (trace.line) {
          update['line.color'] = color;
          update['line.width'] = lineWidth;
        }
        if (trace.fill && trace.fill !== 'none') {
          update.fillcolor = hexToRgba(color, 0.22);
        }
        if (trace.marker) {
          const numericColors = Array.isArray(trace.marker.color) &&
            trace.marker.color.length > 0 &&
            trace.marker.color.every((value) => Number.isFinite(Number(value)));
          if (numericColors) {
            update['marker.colorscale'] = paletteScale(palette);
            update['marker.showscale'] = trace.marker.showscale !== false;
          } else {
            const count = editablePointCount(trace);
            const hasPointOverrides = Object.keys(pointOverrides).length > 0 && count > 0;
            update['marker.color'] = hasPointOverrides
              ? [Array.from({ length: count }, (_, i) => pointOverrides[i] || color)]
              : color;
          }
          update['marker.size'] = Array.isArray(trace.marker.size) ? trace.marker.size : markerSize;
          update['marker.line.color'] = '#FFFFFF';
          update['marker.line.width'] = 0.9;
        }
        if (trace.text !== undefined) {
          update.textposition = showLabels ? (trace.textposition || 'top center') : 'none';
        }
      }
      try { Plotly.restyle(plot, update, [index]); } catch (_) {}
    });

    writeScienceSettings();
    setTimeout(() => { try { Plotly.Plots.resize(plot); } catch (_) {} }, 30);
  }

  function writeScienceSettings() {
    const panel = document.querySelector('#g2EditorPanel');
    if (!panel) return;
    window.G2ScienceSettings = window.G2ScienceSettings || {};
    const stationText = panel.querySelector('#g2Stations')?.value;
    if (typeof stationText === 'string') window.G2ScienceSettings.stationText = stationText;
    const rings = panel.querySelector('#g2Rings')?.value;
    if (typeof rings === 'string') {
      const parsed = rings.split(/[;,\s]+/).map(Number).filter((v) => Number.isFinite(v) && v > 0).sort((a,b)=>a-b);
      if (parsed.length) window.G2ScienceSettings.ringDistances = parsed;
    }
    const interval = Number(panel.querySelector('#g2ContourInterval')?.value);
    if (Number.isFinite(interval) && interval > 0) window.G2ScienceSettings.contourInterval = interval;
    const regionCount = Number(panel.querySelector('#g2RegionCount')?.value);
    if (Number.isFinite(regionCount)) window.G2ScienceSettings.regionCount = Math.min(6, Math.max(2, Math.round(regionCount)));
  }

  function stationsFromPlot(plot) {
    const trace = plot.data?.find((item) => item.type === 'scattergeo' && Array.isArray(item.lat) && Array.isArray(item.lon));
    if (!trace) return window.G2ScienceSettings?.stationText || '';
    const names = Array.from(trace.text || []).map((value, i) => stripHtml(String(value || `Point ${i + 1}`)).split('\n')[0]);
    return trace.lat.map((lat, i) => `${names[i] || `Point ${i + 1}`},${Number(lat).toFixed(6)},${Number(trace.lon?.[i]).toFixed(6)}`).join('\n');
  }

  function detectType(plot) {
    if (plot.data.some((t) => ['scattergeo', 'choropleth'].includes(t.type))) return 'Map';
    if (plot.data.some((t) => t.type === 'contour')) return 'Contour';
    if (plot.data.some((t) => t.type === 'heatmap')) return 'Heatmap';
    if (plot.data.some((t) => t.type === 'pie')) return 'Pie';
    if (plot.data.some((t) => t.type === 'bar')) return 'Bar';
    return 'Chart';
  }

  function updateTypeOptions() {
    const select = document.querySelector('#chartGroup');
    if (!select || typeof window.chartSpecs !== 'function') return;
    const current = select.value;
    const groups = [...new Set(window.chartSpecs().map((item) => item.group))];
    select.innerHTML = '<option value="">그래프 종류 선택</option>' + groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join('');
    if (groups.includes(current)) select.value = current;
  }

  function installResizeHandling() {
    let resizeTimer = null;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(resizePlots, 120);
    }, { passive: true });
  }

  function resizePlots() {
    if (!window.Plotly) return;
    document.querySelectorAll('.plot').forEach((plot) => {
      if (plot.offsetParent === null) return;
      try { Plotly.Plots.resize(plot); } catch (_) {}
    });
  }

  function installDataFeedback() {
    const table = document.querySelector('#manualTable');
    if (!table) return;
    const status = document.querySelector('#status');
    table.addEventListener('input', debounce(() => {
      if (status) status.textContent = 'Grid Data가 수정되었습니다. 그래프 생성 버튼을 누르면 반영됩니다.';
    }, 160), { passive: true });
  }

  function hexToRgba(hex, alpha) {
    const value = String(hex || '').replace('#', '');
    if (!/^[0-9a-f]{6}$/i.test(value)) return `rgba(37,99,235,${alpha})`;
    const number = parseInt(value, 16);
    return `rgba(${(number >> 16) & 255},${(number >> 8) & 255},${number & 255},${alpha})`;
  }


  function paletteScale(colors) {
    if (!Array.isArray(colors) || colors.length === 0) return [[0, '#F8FAFC'], [1, '#0072B2']];
    if (colors.length === 1) return [[0, colors[0]], [1, colors[0]]];
    return colors.map((color, index) => [index / (colors.length - 1), color]);
  }


  function debounce(fn, wait) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }
  function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function stripHtml(value) { const div = document.createElement('div'); div.innerHTML = String(value || ''); return div.textContent || div.innerText || ''; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
}());
