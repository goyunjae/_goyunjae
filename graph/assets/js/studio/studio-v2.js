(function () {
  'use strict';

  const VERSION = '20261006.4';
  const state = {
    selectedCard: null,
    selectedPlot: null,
    selectedObject: null,
    view: 'preview',
    editorTimer: null,
    sectionOpen: {
      layout: true,
      palette: true,
      objects: true,
      marks: false,
      science: true,
    },
    objectSectionOpen: {
      plot: true,
      symbol: true,
      labels: false,
      line: false,
      fill: false,
    },
  };

  const PALETTES = {
    'Pastel · Paper': ['#9EC5E6', '#F2B8B5', '#B7D7B0', '#C9B7DD', '#F4D49A', '#A8D8D8', '#E6B8C8', '#B8C6D9'],
    'Pastel · Cool': ['#A9C9E8', '#B7DDE2', '#B9D6C2', '#C8C0E6', '#D5C6E8', '#B7CADB', '#C6DEE8', '#BFD8D2'],
    'Pastel · Warm': ['#F2B8B5', '#F5C9A9', '#F3D49D', '#E8B7C7', '#D8B8D8', '#EABFA8', '#F1C7C1', '#DEC0B3'],
    'Pastel · Earth': ['#C7D3B4', '#D9C6A5', '#C8B7A6', '#B7C9C0', '#D5B8A8', '#C8C4A7', '#B9C6A8', '#D8C9B6'],
    'Pastel · Colorblind': ['#A8CCE6', '#F2D18C', '#A9D6C2', '#E8B4A5', '#D7B9DD', '#B7DDEB', '#E8D9A4', '#C7C7C7'],
    'Gray scale': ['#222222', '#444444', '#666666', '#888888', '#AAAAAA', '#CCCCCC', '#E5E5E5'],
    'Blue scale': ['#7FAFD1', '#91BEDC', '#A6CAE4', '#BAD6EB', '#CDE2F1', '#E0EDF7'],
    'Rose scale': ['#C98291', '#D79AAA', '#E2AFBA', '#EBC3CC', '#F2D6DC', '#F7E7EA'],
    'Green scale': ['#86B89A', '#9BC6AC', '#ADD2BC', '#C0DDCC', '#D2E8DC', '#E5F2EC'],
    'Purple scale': ['#A58CC5', '#B5A0D0', '#C5B4DA', '#D5C8E4', '#E3D9EC', '#F0EAF5'],
    '단색 · Black': Array(12).fill('#2A2A2A'),
    '단색 · Navy': Array(12).fill('#526B86'),
    '단색 · Blue': Array(12).fill('#8FB8DE'),
    '단색 · Rose': Array(12).fill('#D99AA8'),
    '단색 · Green': Array(12).fill('#9DC8AD'),
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
    const isGeo = plot.data.some((trace) => ['scattergeo', 'choropleth', 'scattermap', 'choroplethmap', 'densitymap'].includes(trace.type));
    const isContour = plot.data.some((trace) => trace.type === 'contour');
    const isSpatialCard = /^GEO\b/i.test(cardTitle) || isGeo || isContour;
    const isAnalysisCard = /^ANALYSIS\b/i.test(cardTitle);
    const isLine = plot.data.some((trace) => trace.type === 'scatter' && String(trace.mode || '').includes('lines'));
    const hasMarkers = plot.data.some((trace) => String(trace.mode || '').includes('markers') || ['scattergeo','scattermap'].includes(trace.type));

    const layoutBody = `
      ${field('Title', `<input id="g2Title" type="text" value="${escapeHtml(title)}">`)}
      <div class="g2-editor-grid two">
        ${field('Height', `<input id="g2Height" type="number" min="280" max="900" step="20" value="${Math.round(layout.height || plot.clientHeight || 420)}">`)}
        ${field('Font size', `<input id="g2FontSize" type="number" min="8" max="24" step="1" value="${Number(layout.font?.size || 12)}">`)}
      </div>
      <div class="g2-editor-grid two">
        ${field('Canvas', '<select id="g2Canvas"><option value="#FFFFFF">White</option><option value="#F8FAFC">Soft</option><option value="#111827">Ink</option></select>')}
        ${field('Grid', '<select id="g2Grid"><option value="light">Light</option><option value="none">None</option><option value="strong">Strong</option></select>')}
      </div>
      <label class="g2-check"><input id="g2Legend" type="checkbox" ${layout.showlegend === false ? '' : 'checked'}> Show legend</label>
      <label class="g2-check"><input id="g2Labels" type="checkbox" checked> Show labels</label>
    `;

    const paletteBody = `
      <div class="g2-palette-block">
        <div class="g2-subhead"><span>Pastel publication palette</span><small>색상 세트를 클릭하면 바로 적용됩니다.</small></div>
        <div id="g2PaletteGrid" class="g2-palette-grid">${paletteButtons(plot)}</div>
      </div>
    `;

    const objectsBody = `
      <div class="g2-object-editor">
        <div class="g2-subhead"><span>Object Manager</span><small>개체를 선택한 뒤 색상을 개별 수정합니다.</small></div>
        <div id="g2ObjectManager" class="g2-object-manager">${objectManagerHtml(plot)}</div>
        <div id="g2ObjectProperties" class="g2-object-properties">${selectedObjectPropertiesHtml(plot)}</div>
      </div>
    `;

    const marksBody = `
      <div class="g2-editor-grid two">
        ${field('Line width', `<input id="g2LineWidth" type="range" min="0.5" max="6" step="0.25" value="2.25" ${isLine ? '' : 'disabled'}>`)}
        ${field('Marker size', `<input id="g2MarkerSize" type="range" min="3" max="24" step="1" value="9" ${hasMarkers ? '' : 'disabled'}>`)}
      </div>
    `;

    body.innerHTML = `
      ${editorSection('layout', 'Layout', layoutBody, true)}
      ${editorSection('palette', 'Colors', paletteBody, true)}
      ${editorSection('objects', 'Objects', objectsBody, true)}
      ${editorSection('marks', 'Marks', marksBody, false)}
      ${(isSpatialCard || isAnalysisCard) ? spatialEditorHtml(plot, isSpatialCard, isAnalysisCard) : ''}
      <section class="g2-editor-actions">
        <button type="button" id="g2Apply">Apply</button>
        <button type="button" id="g2Regenerate" class="secondary">Regenerate</button>
      </section>
    `;

    bindEditorEvents();
  }

  function editorSection(key, title, content, defaultOpen = true) {
    const isOpen = state.sectionOpen[key] ?? defaultOpen;
    return `
      <details class="g2-editor-section g2-collapsible" data-section-key="${key}" ${isOpen ? 'open' : ''}>
        <summary>
          <span>${escapeHtml(title)}</span>
          <span class="g2-section-chevron" aria-hidden="true">⌄</span>
        </summary>
        <div class="g2-section-content">${content}</div>
      </details>
    `;
  }

  function field(label, control) { return `<div class="g2-field"><label>${label}</label>${control}</div>`; }

  function paletteButtons(plot) {
    const active = plot._g2PaletteName || 'Pastel · Paper';
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
    if (!target) return '<p class="g2-help">Objects 목록이나 그래프 개체를 클릭하세요.</p>';
    const trace = plot.data?.[target.traceIndex];
    if (!trace) return '<p class="g2-help">선택한 개체를 찾을 수 없습니다.</p>';

    const color = objectColor(plot, target);
    const objectTitle = target.kind === 'point'
      ? `Point - ${Number(target.pointIndex) + 1}`
      : `Plot - ${target.traceIndex + 1}`;
    const traceLabel = target.label || trace.name || objectTitle;

    const supportsMarker = Boolean(trace.marker) || String(trace.mode || '').includes('markers');
    const supportsLine = Boolean(trace.line) || String(trace.mode || '').includes('lines') || trace.type === 'contour';
    const supportsFill = Boolean(trace.fill && trace.fill !== 'none') ||
      ['bar','waterfall','funnel','pie','treemap','sunburst'].includes(trace.type);

    const plotContent = `
      <div class="g2-property-row">
        <span>Name</span>
        <strong>${escapeHtml(traceLabel)}</strong>
      </div>
      <div class="g2-property-row">
        <span>Type</span>
        <strong>${escapeHtml(trace.type || 'plot')}</strong>
      </div>
      <label class="g2-property-slider">
        <span>Opacity</span>
        <input id="g2ObjectOpacity" type="range" min="0.1" max="1" step="0.05" value="${finite(trace.opacity, 1)}">
      </label>
    `;

    const symbolContent = supportsMarker ? `
      <label class="g2-property-color-row">
        <span>Color</span>
        <input
          id="g2SelectedObjectColor"
          class="g2-color-input g2-property-color-input"
          type="color"
          value="${color}"
          data-kind="${target.kind}"
          data-trace-index="${target.traceIndex}"
          ${target.pointIndex == null ? '' : `data-point-index="${target.pointIndex}"`}
          aria-label="${escapeHtml(traceLabel)} 색상"
        >
        <code>${color.toUpperCase()}</code>
      </label>
      <label class="g2-property-slider">
        <span>Size</span>
        <input id="g2ObjectMarkerSize" type="range" min="2" max="30" step="1" value="${markerSizeFor(trace, target)}">
      </label>
    ` : '<p class="g2-help">이 개체에는 Symbol 속성이 없습니다.</p>';

    const labelsContent = `
      <label class="g2-check">
        <input id="g2ObjectLabels" type="checkbox" ${trace.textposition === 'none' ? '' : 'checked'}>
        Show labels
      </label>
      <div class="g2-property-row">
        <span>Position</span>
        <select id="g2ObjectLabelPosition">
          ${labelPositionOptions(trace.textposition || 'top center')}
        </select>
      </div>
    `;

    const lineContent = supportsLine ? `
      <label class="g2-property-color-row">
        <span>Line color</span>
        <input id="g2ObjectLineColor" class="g2-property-color-input" type="color" value="${lineColorFor(trace, color)}">
        <code>${lineColorFor(trace, color).toUpperCase()}</code>
      </label>
      <label class="g2-property-slider">
        <span>Width</span>
        <input id="g2ObjectLineWidth" type="range" min="0.4" max="8" step="0.2" value="${finite(trace.line?.width, 2)}">
      </label>
    ` : '<p class="g2-help">이 개체에는 Line 속성이 없습니다.</p>';

    const fillContent = supportsFill ? `
      <label class="g2-property-color-row">
        <span>Fill color</span>
        <input id="g2ObjectFillColor" class="g2-property-color-input" type="color" value="${fillColorFor(trace, color)}">
        <code>${fillColorFor(trace, color).toUpperCase()}</code>
      </label>
      <label class="g2-property-slider">
        <span>Fill opacity</span>
        <input id="g2ObjectFillOpacity" type="range" min="0.05" max="1" step="0.05" value="${fillOpacityFor(trace)}">
      </label>
    ` : '<p class="g2-help">이 개체에는 Fill 속성이 없습니다.</p>';

    return `
      <div class="g2-property-manager">
        <div class="g2-property-manager-head">
          <div>
            <strong>${escapeHtml(objectTitle)}</strong>
            <span>${escapeHtml(traceLabel)}</span>
          </div>
          <button type="button" id="g2ResetObjectColor" class="g2-mini-button">Reset</button>
        </div>

        ${objectPropertySection('plot', 'Plot', plotContent, true)}
        ${objectPropertySection('symbol', 'Symbol', symbolContent, true)}
        ${objectPropertySection('labels', 'Labels', labelsContent, false)}
        ${objectPropertySection('line', 'Line', lineContent, false)}
        ${objectPropertySection('fill', 'Fill', fillContent, false)}
      </div>
    `;
  }

  function objectPropertySection(key, title, content, defaultOpen = false) {
    const open = state.objectSectionOpen[key] ?? defaultOpen;
    return `
      <details class="g2-property-section" data-object-section-key="${key}" ${open ? 'open' : ''}>
        <summary>
          <span class="g2-property-caret">▾</span>
          <strong>${escapeHtml(title)}</strong>
        </summary>
        <div class="g2-property-section-body">${content}</div>
      </details>
    `;
  }

  function markerSizeFor(trace, target) {
    const size = trace.marker?.size;
    if (Array.isArray(size) && target.kind === 'point') {
      const value = Number(size[target.pointIndex]);
      return Number.isFinite(value) ? value : 9;
    }
    return Number.isFinite(Number(size)) ? Number(size) : 9;
  }

  function lineColorFor(trace, fallback) {
    const color = trace.line?.color;
    return /^#[0-9a-f]{6}$/i.test(String(color || '')) ? color : fallback;
  }

  function fillColorFor(trace, fallback) {
    const raw = trace.fillcolor;
    if (/^#[0-9a-f]{6}$/i.test(String(raw || ''))) return raw;
    const rgbaMatch = String(raw || '').match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgbaMatch) {
      return '#' + rgbaMatch.slice(1,4).map((v) => Number(v).toString(16).padStart(2,'0')).join('').toUpperCase();
    }
    return fallback;
  }

  function fillOpacityFor(trace) {
    const raw = String(trace.fillcolor || '');
    const match = raw.match(/rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)/i);
    return match ? Math.min(1, Math.max(0.05, Number(match[1]) || 0.25)) : 0.25;
  }

  function labelPositionOptions(current) {
    const positions = [
      ['top center','Top'],
      ['middle center','Center'],
      ['bottom center','Bottom'],
      ['top right','Top right'],
      ['top left','Top left'],
    ];
    return positions.map(([value,label]) => `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`).join('');
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
    if (['scatter', 'scattergeo', 'scattermap', 'scatterpolar'].includes(trace.type)) {
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
    const palette = PALETTES[plot._g2PaletteName || 'Pastel · Paper'] || PALETTES['Pastel · Paper'];
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
    const interval = Number(science.contourInterval || 10);
    const contourMin = science.contourMin == null ? '' : science.contourMin;
    const contourMax = science.contourMax == null ? '' : science.contourMax;
    const contourPower = Number(science.contourPower || 2);
    const contourResolution = Number(science.contourResolution || 96);
    const contourPadding = Number(science.contourPadding || 28);
    const contourLineColor = science.contourLineColor || '#E89A8A';
    const contourLineWidth = Number(science.contourLineWidth || 1.35);
    const contourSmoothing = Number(science.contourSmoothing ?? 1);
    const regionCount = Number(science.regionCount || 3);
    const ellipseScale = Number(science.pcaEllipseScale || 2.2);
    const mapStyle = science.mapStyle || 'carto-voyager';
    const mapZoom = science.mapZoom == null ? '' : science.mapZoom;
    const mapBearing = Number(science.mapBearing || 0);
    const mapPitch = Number(science.mapPitch || 0);

    const spatialFields = isSpatial ? `
      <div class="g2-editor-grid two">
        ${field('Base map', `<select id="g2MapStyle">
          <option value="carto-voyager" ${mapStyle === 'carto-voyager' ? 'selected' : ''}>Detailed · Voyager</option>
          <option value="open-street-map" ${mapStyle === 'open-street-map' ? 'selected' : ''}>OpenStreetMap</option>
          <option value="carto-positron" ${mapStyle === 'carto-positron' ? 'selected' : ''}>Publication · Positron</option>
          <option value="outdoors" ${mapStyle === 'outdoors' ? 'selected' : ''}>Terrain · Outdoors</option>
          <option value="satellite-streets" ${mapStyle === 'satellite-streets' ? 'selected' : ''}>Satellite + Streets</option>
        </select>`)}
        ${field('Map zoom', `<input id="g2MapZoom" type="number" min="0" max="20" step="0.25" placeholder="Auto" value="${escapeHtml(mapZoom)}">`)}
      </div>
      <div class="g2-editor-grid two">
        ${field('Bearing', `<input id="g2MapBearing" type="number" min="-180" max="180" step="5" value="${mapBearing}">`)}
        ${field('Pitch', `<input id="g2MapPitch" type="number" min="0" max="60" step="5" value="${mapPitch}">`)}
      </div>
      ${field('Station coordinates', `<textarea id="g2Stations" spellcheck="false" placeholder="서울,37.5665,126.9780">${escapeHtml(stationText)}</textarea>`)}
      <div class="g2-editor-grid two">
        ${field('Distance rings (km)', `<input id="g2Rings" type="text" value="${escapeHtml(rings)}">`)}
        ${field('Contour interval', `<input id="g2ContourInterval" type="number" min="0.1" step="0.5" value="${interval}">`)}
      </div>
      <div class="g2-editor-grid two">
        ${field('Contour min', `<input id="g2ContourMin" type="number" step="0.5" placeholder="Auto" value="${escapeHtml(contourMin)}">`)}
        ${field('Contour max', `<input id="g2ContourMax" type="number" step="0.5" placeholder="Auto" value="${escapeHtml(contourMax)}">`)}
      </div>
      <div class="g2-editor-grid two">
        ${field('IDW power', `<input id="g2ContourPower" type="number" min="0.25" max="8" step="0.25" value="${contourPower}">`)}
        ${field('Grid resolution', `<input id="g2ContourResolution" type="number" min="36" max="180" step="4" value="${contourResolution}">`)}
      </div>
      <div class="g2-editor-grid two">
        ${field('Outer padding (km)', `<input id="g2ContourPadding" type="number" min="0" step="2" value="${contourPadding}">`)}
        ${field('Line width', `<input id="g2ContourLineWidth" type="number" min="0.4" max="6" step="0.1" value="${contourLineWidth}">`)}
      </div>
      <div class="g2-editor-grid two">
        ${field('Contour color', `<input id="g2ContourLineColor" type="color" value="${escapeHtml(contourLineColor)}">`)}
        ${field('Smoothing', `<input id="g2ContourSmoothing" type="range" min="0" max="1.3" step="0.1" value="${contourSmoothing}">`)}
      </div>
      <p class="g2-help">값 보간 등고선은 관측점 값으로 IDW 보간을 수행합니다. Interval을 줄이면 첫 번째 참고 이미지처럼 등고선이 촘촘해지고, Power를 높이면 각 관측점의 영향이 더 국소적으로 나타납니다.</p>
    ` : '';

    const analysisFields = isAnalysis ? `
      <div class="g2-editor-grid two">
        ${field('PCA groups', `<input id="g2RegionCount" type="number" min="2" max="6" step="1" value="${regionCount}">`)}
        ${field('Group ellipse size (σ)', `<input id="g2PcaEllipseScale" type="number" min="0.5" max="5" step="0.1" value="${ellipseScale}">`)}
      </div>
      <p class="g2-help">PCA 점수 그래프에서 k-means 그룹을 자동 구분하고, 두 번째 참고 이미지의 영역 표현처럼 각 그룹을 파스텔 타원으로 감싸 표시합니다.</p>
    ` : '';

    return editorSection(
      'science',
      isSpatial ? 'GEO · Contour' : 'PCA · Groups',
      `${spatialFields}${analysisFields}`,
      true
    );
  }

  function bindEditorEvents() {
    const panel = document.querySelector('#g2EditorPanel');
    const plot = state.selectedPlot;
    if (!panel || !plot) return;

    panel.querySelector('#g2Apply')?.addEventListener('click', applyEditor);
    panel.querySelector('#g2Regenerate')?.addEventListener('click', () => document.querySelector('#generateBtn')?.click());

    panel.querySelectorAll('details[data-section-key]').forEach((details) => {
      details.addEventListener('toggle', () => {
        state.sectionOpen[details.dataset.sectionKey] = details.open;
      });
    });

    panel.querySelectorAll('details[data-object-section-key]').forEach((details) => {
      details.addEventListener('toggle', () => {
        state.objectSectionOpen[details.dataset.objectSectionKey] = details.open;
      });
    });

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
      const code = input.closest('.g2-property-color-row')?.querySelector('code');
      if (code) code.textContent = color;
      const activeRow = panel.querySelector('.g2-object-row.active .g2-object-color');
      if (activeRow) activeRow.style.background = color;
    });

    panel.querySelector('#g2ObjectOpacity')?.addEventListener('input', (event) => {
      updateSelectedTraceProperty(plot, 'opacity', Number(event.currentTarget.value));
    });

    panel.querySelector('#g2ObjectMarkerSize')?.addEventListener('input', (event) => {
      updateSelectedObjectMarkerSize(plot, state.selectedObject || plot._g2SelectedObject, Number(event.currentTarget.value));
    });

    panel.querySelector('#g2ObjectLabels')?.addEventListener('change', (event) => {
      updateSelectedTraceProperty(plot, 'textposition', event.currentTarget.checked
        ? (panel.querySelector('#g2ObjectLabelPosition')?.value || 'top center')
        : 'none');
    });

    panel.querySelector('#g2ObjectLabelPosition')?.addEventListener('change', (event) => {
      if (panel.querySelector('#g2ObjectLabels')?.checked !== false) {
        updateSelectedTraceProperty(plot, 'textposition', event.currentTarget.value);
      }
    });

    panel.querySelector('#g2ObjectLineColor')?.addEventListener('input', (event) => {
      updateSelectedTraceProperty(plot, 'line.color', event.currentTarget.value.toUpperCase());
      const code = event.currentTarget.closest('.g2-property-color-row')?.querySelector('code');
      if (code) code.textContent = event.currentTarget.value.toUpperCase();
    });

    panel.querySelector('#g2ObjectLineWidth')?.addEventListener('input', (event) => {
      updateSelectedTraceProperty(plot, 'line.width', Number(event.currentTarget.value));
    });

    panel.querySelector('#g2ObjectFillColor')?.addEventListener('input', (event) => {
      const opacity = Number(panel.querySelector('#g2ObjectFillOpacity')?.value || 0.25);
      updateSelectedTraceProperty(plot, 'fillcolor', hexToRgba(event.currentTarget.value, opacity));
      const code = event.currentTarget.closest('.g2-property-color-row')?.querySelector('code');
      if (code) code.textContent = event.currentTarget.value.toUpperCase();
    });

    panel.querySelector('#g2ObjectFillOpacity')?.addEventListener('input', (event) => {
      const color = panel.querySelector('#g2ObjectFillColor')?.value || '#9EC5E6';
      updateSelectedTraceProperty(plot, 'fillcolor', hexToRgba(color, Number(event.currentTarget.value)));
    });

    panel.querySelector('#g2ResetObjectColor')?.addEventListener('click', () => {
      resetObjectColor(plot, state.selectedObject || plot._g2SelectedObject);
    });

    panel.querySelectorAll('input,select,textarea').forEach((control) => {
      if (control.id === 'g2SelectedObjectColor') return;
      const eventName = control.tagName === 'TEXTAREA' ? 'change' : 'input';
      control.addEventListener(eventName, () => {
        if (control.matches('#g2Stations,#g2Rings,#g2ContourInterval,#g2ContourMin,#g2ContourMax,#g2ContourPower,#g2ContourResolution,#g2ContourPadding,#g2ContourLineColor,#g2ContourLineWidth,#g2ContourSmoothing,#g2MapStyle,#g2MapZoom,#g2MapBearing,#g2MapPitch,#g2RegionCount,#g2PcaEllipseScale')) {
          writeScienceSettings();
          return;
        }
        clearTimeout(state.editorTimer);
        state.editorTimer = setTimeout(applyEditor, 90);
      });
      if (control.tagName === 'SELECT') control.addEventListener('change', applyEditor);
    });
  }

  function updateSelectedTraceProperty(plot, property, value) {
    const target = normalizeSelectedObject(plot, state.selectedObject || plot._g2SelectedObject);
    if (!target || !window.Plotly) return;
    try { Plotly.restyle(plot, { [property]: value }, [target.traceIndex]); } catch (_) {}
  }

  function updateSelectedObjectMarkerSize(plot, target, size) {
    const normalized = normalizeSelectedObject(plot, target);
    if (!normalized || !Number.isFinite(size) || !window.Plotly) return;
    const trace = plot.data?.[normalized.traceIndex];
    if (!trace) return;

    if (normalized.kind === 'point') {
      const count = editablePointCount(trace);
      const current = trace.marker?.size;
      const sizes = Array.from({ length: count }, (_, i) => {
        if (Array.isArray(current) && Number.isFinite(Number(current[i]))) return Number(current[i]);
        if (Number.isFinite(Number(current))) return Number(current);
        return 9;
      });
      sizes[normalized.pointIndex] = size;
      try { Plotly.restyle(plot, { 'marker.size': [sizes] }, [normalized.traceIndex]); } catch (_) {}
    } else {
      try { Plotly.restyle(plot, { 'marker.size': size }, [normalized.traceIndex]); } catch (_) {}
    }
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
    writeScienceSettings();

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

    const paletteName = plot._g2PaletteName || 'Pastel · Paper';
    const palette = PALETTES[paletteName] || PALETTES['Pastel · Paper'];
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
      } else if (trace.type === 'contour' && trace.name === 'IDW contour') {
        const science = window.G2ScienceSettings || {};
        const contourColor = /^#[0-9a-f]{6}$/i.test(String(science.contourLineColor || ''))
          ? science.contourLineColor
          : '#E89A8A';
        update.colorscale = [[0, contourColor], [1, contourColor]];
        update['line.width'] = finite(science.contourLineWidth, 1.35);
        update['line.smoothing'] = finite(science.contourSmoothing, 1);
      } else if (trace.type === 'heatmap' || trace.type === 'contour' || trace.type === 'choropleth') {
        update.colorscale = paletteScale(palette);
      } else if (trace.type === 'indicator') {
        update['number.font.color'] = color;
      } else if (trace.type === 'scattermap' && /등고선/.test(String(trace.name || ''))) {
        const science = window.G2ScienceSettings || {};
        const contourColor = /^#[0-9a-f]{6}$/i.test(String(science.contourLineColor || ''))
          ? science.contourLineColor
          : color;
        update['line.color'] = contourColor;
        update['line.width'] = finite(science.contourLineWidth, trace.line?.width || 1.35);
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
          if (trace.type !== 'scattermap') {
            update['marker.line.color'] = '#FFFFFF';
            update['marker.line.width'] = 0.9;
          }
        }
        if (trace.text !== undefined) {
          update.textposition = showLabels ? (trace.textposition || 'top center') : 'none';
        }
      }
      try { Plotly.restyle(plot, update, [index]); } catch (_) {}
    });

    setTimeout(() => { try { Plotly.Plots.resize(plot); } catch (_) {} }, 30);
  }

  function writeScienceSettings() {
    const panel = document.querySelector('#g2EditorPanel');
    if (!panel) return;
    window.G2ScienceSettings = window.G2ScienceSettings || {};
    const settings = window.G2ScienceSettings;

    const stationText = panel.querySelector('#g2Stations')?.value;
    if (typeof stationText === 'string') settings.stationText = stationText;

    const rings = panel.querySelector('#g2Rings')?.value;
    if (typeof rings === 'string') {
      const parsed = rings.split(/[;,\s]+/).map(Number).filter((v) => Number.isFinite(v) && v > 0).sort((a,b)=>a-b);
      if (parsed.length) settings.ringDistances = parsed;
    }

    const interval = Number(panel.querySelector('#g2ContourInterval')?.value);
    if (Number.isFinite(interval) && interval > 0) settings.contourInterval = interval;

    settings.contourMin = nullableInputNumber(panel.querySelector('#g2ContourMin'));
    settings.contourMax = nullableInputNumber(panel.querySelector('#g2ContourMax'));

    const power = Number(panel.querySelector('#g2ContourPower')?.value);
    if (Number.isFinite(power)) settings.contourPower = Math.min(8, Math.max(0.25, power));

    const resolution = Number(panel.querySelector('#g2ContourResolution')?.value);
    if (Number.isFinite(resolution)) settings.contourResolution = Math.min(180, Math.max(36, Math.round(resolution)));

    const padding = Number(panel.querySelector('#g2ContourPadding')?.value);
    if (Number.isFinite(padding)) settings.contourPadding = Math.max(0, padding);

    const lineColor = panel.querySelector('#g2ContourLineColor')?.value;
    if (/^#[0-9a-f]{6}$/i.test(String(lineColor || ''))) settings.contourLineColor = lineColor.toUpperCase();

    const lineWidth = Number(panel.querySelector('#g2ContourLineWidth')?.value);
    if (Number.isFinite(lineWidth)) settings.contourLineWidth = Math.min(6, Math.max(0.4, lineWidth));

    const smoothing = Number(panel.querySelector('#g2ContourSmoothing')?.value);
    if (Number.isFinite(smoothing)) settings.contourSmoothing = Math.min(1.3, Math.max(0, smoothing));

    const regionCount = Number(panel.querySelector('#g2RegionCount')?.value);
    if (Number.isFinite(regionCount)) settings.regionCount = Math.min(6, Math.max(2, Math.round(regionCount)));

    const mapStyle = panel.querySelector('#g2MapStyle')?.value;
    if (typeof mapStyle === 'string' && mapStyle) settings.mapStyle = mapStyle;

    settings.mapZoom = nullableInputNumber(panel.querySelector('#g2MapZoom'));

    const mapBearing = Number(panel.querySelector('#g2MapBearing')?.value);
    if (Number.isFinite(mapBearing)) settings.mapBearing = Math.min(180, Math.max(-180, mapBearing));

    const mapPitch = Number(panel.querySelector('#g2MapPitch')?.value);
    if (Number.isFinite(mapPitch)) settings.mapPitch = Math.min(60, Math.max(0, mapPitch));

    const ellipseScale = Number(panel.querySelector('#g2PcaEllipseScale')?.value);
    if (Number.isFinite(ellipseScale)) settings.pcaEllipseScale = Math.min(5, Math.max(0.5, ellipseScale));
  }

  function stationsFromPlot(plot) {
    const trace = plot.data?.find((item) => ['scattergeo','scattermap'].includes(item.type) && Array.isArray(item.lat) && Array.isArray(item.lon));
    if (!trace) return window.G2ScienceSettings?.stationText || '';
    const names = Array.from(trace.text || []).map((value, i) => stripHtml(String(value || `Point ${i + 1}`)).split('\n')[0]);
    return trace.lat.map((lat, i) => `${names[i] || `Point ${i + 1}`},${Number(lat).toFixed(6)},${Number(trace.lon?.[i]).toFixed(6)}`).join('\n');
  }

  function detectType(plot) {
    if (plot.data.some((t) => ['scattergeo', 'choropleth', 'scattermap', 'choroplethmap', 'densitymap'].includes(t.type))) return 'Map';
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
  function nullableInputNumber(input) {
    if (!input || input.value === '') return null;
    const value = Number(input.value);
    return Number.isFinite(value) ? value : null;
  }

  function finite(value, fallback) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
  function stripHtml(value) { const div = document.createElement('div'); div.innerHTML = String(value || ''); return div.textContent || div.innerText || ''; }
  function escapeHtml(value) { return String(value ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;'); }
}());
