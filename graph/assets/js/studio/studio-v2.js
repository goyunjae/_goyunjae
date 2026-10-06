(function () {
  'use strict';

  const VERSION = '20261006.2';
  const state = {
    selectedCard: null,
    selectedPlot: null,
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
        <div class="g2-color-editor">
          <div class="g2-subhead"><span>Individual colors</span><small>색상칩을 눌러 범례/항목별 색을 직접 바꿀 수 있습니다.</small></div>
          <div id="g2ColorTargets" class="g2-color-targets">${colorEditorHtml(plot)}</div>
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

  function colorEditorHtml(plot) {
    const targets = colorTargets(plot);
    if (!targets.length) return '<p class="g2-help">이 그래프는 연속형 색상 스케일을 사용합니다. 위 팔레트 세트로 색상 스케일을 변경하세요.</p>';
    return targets.map((target) => `
      <label class="g2-color-target">
        <input
          class="g2-color-input"
          type="color"
          value="${target.color}"
          data-kind="${target.kind}"
          data-trace-index="${target.traceIndex}"
          ${target.pointIndex == null ? '' : `data-point-index="${target.pointIndex}"`}
          aria-label="${escapeHtml(target.label)} 색상"
        >
        <span class="g2-color-chip" style="background:${target.color}"></span>
        <span class="g2-color-label">${escapeHtml(target.label)}</span>
        <code>${target.color.toUpperCase()}</code>
      </label>
    `).join('');
  }

  function colorTargets(plot) {
    const palette = PALETTES[plot._g2PaletteName || '색각 안전'] || PALETTES['색각 안전'];
    const traces = Array.from(plot.data || []);
    if (!traces.length) return [];

    if (traces.length === 1) {
      const trace = traces[0];
      const labels = pointLabels(trace);
      const supportsPointColors = ['pie', 'treemap', 'sunburst', 'bar'].includes(trace.type) && labels.length > 1 && labels.length <= 16;
      if (supportsPointColors) {
        return labels.map((label, pointIndex) => ({
          kind: 'point',
          traceIndex: 0,
          pointIndex,
          label,
          color: plot._g2PointColors?.[0]?.[pointIndex] || currentPointColor(trace, pointIndex, palette[pointIndex % palette.length]),
        }));
      }
    }

    return traces
      .map((trace, traceIndex) => ({
        kind: 'trace',
        traceIndex,
        pointIndex: null,
        label: trace.name || `Series ${traceIndex + 1}`,
        color: plot._g2TraceColors?.[traceIndex] || currentTraceColor(trace, palette[traceIndex % palette.length]),
      }))
      .filter((target) => target.color);
  }

  function pointLabels(trace) {
    const labels = Array.isArray(trace.labels) ? trace.labels
      : Array.isArray(trace.x) ? trace.x
      : Array.isArray(trace.y) ? trace.y
      : [];
    return labels.map((value, index) => String(value ?? `Item ${index + 1}`));
  }

  function currentTraceColor(trace, fallback) {
    const candidates = [trace.line?.color, trace.marker?.color];
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

    panel.querySelectorAll('.g2-color-input').forEach((input) => {
      input.addEventListener('input', () => {
        const traceIndex = Number(input.dataset.traceIndex);
        const color = input.value.toUpperCase();
        if (input.dataset.kind === 'point') {
          const pointIndex = Number(input.dataset.pointIndex);
          plot._g2PointColors = plot._g2PointColors || {};
          plot._g2PointColors[traceIndex] = plot._g2PointColors[traceIndex] || {};
          plot._g2PointColors[traceIndex][pointIndex] = color;
        } else {
          plot._g2TraceColors = plot._g2TraceColors || {};
          plot._g2TraceColors[traceIndex] = color;
        }
        input.closest('.g2-color-target')?.querySelector('.g2-color-chip')?.style.setProperty('background', color);
        const code = input.closest('.g2-color-target')?.querySelector('code');
        if (code) code.textContent = color;
        applyEditor();
      });
    });

    panel.querySelectorAll('input,select,textarea').forEach((control) => {
      if (control.classList.contains('g2-color-input')) return;
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
          ? Array.from({ length: count }, (_, i) => pointOverrides[i] || palette[i % palette.length])
          : color;
        update['marker.line.color'] = '#FFFFFF';
        update['marker.line.width'] = 0.8;
        update.textposition = showLabels ? (trace.orientation === 'h' ? 'outside' : 'auto') : 'none';
      } else if (trace.type === 'pie' || trace.type === 'treemap' || trace.type === 'sunburst') {
        const length = trace.values?.length || trace.labels?.length || palette.length;
        update['marker.colors'] = [Array.from({ length }, (_, i) => pointOverrides[i] || palette[i % palette.length])];
        if (trace.type === 'pie') update.textinfo = showLabels ? 'label+percent' : 'none';
      } else if (trace.type === 'heatmap' || trace.type === 'contour') {
        update.colorscale = [[0, '#F8FAFC'], [0.25, palette[0]], [0.55, palette[Math.min(2, palette.length - 1)]], [1, palette[Math.min(4, palette.length - 1)]]];
      } else {
        if (trace.line) {
          update['line.color'] = color;
          update['line.width'] = lineWidth;
        }
        if (trace.marker) {
          const numericColors = Array.isArray(trace.marker.color) &&
            trace.marker.color.length > 0 &&
            trace.marker.color.every((value) => Number.isFinite(Number(value)));
          if (numericColors) {
            update['marker.colorscale'] = paletteScale(palette);
            update['marker.showscale'] = trace.marker.showscale !== false;
          } else {
            update['marker.color'] = Array.isArray(trace.marker.color)
              ? trace.marker.color.map((_, i) => pointOverrides[i] || palette[i % palette.length])
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
