(function () {
  'use strict';

  const VERSION = '20261006.1';
  const state = {
    selectedCard: null,
    selectedPlot: null,
    view: 'preview',
    editorTimer: null,
  };

  const PALETTES = {
    '논문 기본': ['#0072B2', '#D55E00', '#009E73', '#CC79A7', '#E69F00', '#56B4E9', '#F0E442', '#000000'],
    'Nature': ['#3B6FB6', '#E07A5F', '#59A14F', '#B07AA1', '#F2CC8F', '#4E79A7', '#76B7B2', '#9C755F'],
    'Ocean': ['#003F5C', '#2F4B7C', '#665191', '#A05195', '#D45087', '#F95D6A', '#FF7C43', '#FFA600'],
    'Forest': ['#1B4332', '#2D6A4F', '#40916C', '#52B788', '#74C69D', '#95D5B2', '#B7E4C7', '#D8F3DC'],
    'Viridis': ['#440154', '#482878', '#3E4A89', '#31688E', '#26828E', '#1F9E89', '#6CCE59', '#B6DE2B', '#FDE725'],
    'Tableau': ['#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F', '#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC'],
    'Mono': ['#111827', '#374151', '#6B7280', '#9CA3AF', '#D1D5DB', '#E5E7EB'],
    'Purple': ['#2E1065', '#4C1D95', '#6D28D9', '#7C3AED', '#8B5CF6', '#A78BFA', '#C4B5FD'],
    'Sunset': ['#5F0F40', '#9A031E', '#FB8B24', '#E36414', '#0F4C5C', '#2A9D8F', '#E9C46A'],
    'Earth': ['#283618', '#606C38', '#A3B18A', '#DDA15E', '#BC6C25', '#7F5539', '#9C6644'],
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
          ${field('Palette', paletteSelect())}
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
        ${field('Grid', '<select id="g2Grid"><option value="light">Light</option><option value="none">None</option><option value="strong">Strong</option></select>')}
      </section>
      ${isGeo ? mapEditorHtml(plot) : ''}
      <section class="g2-editor-actions">
        <button type="button" id="g2Apply">Apply</button>
        <button type="button" id="g2Regenerate" class="secondary">Regenerate</button>
      </section>
    `;

    bindEditorEvents();
  }

  function field(label, control) { return `<div class="g2-field"><label>${label}</label>${control}</div>`; }
  function paletteSelect() { return `<select id="g2Palette">${Object.keys(PALETTES).map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}</select>`; }

  function mapEditorHtml(plot) {
    const science = window.G2ScienceSettings || {};
    const stationText = science.stationText || stationsFromPlot(plot);
    const rings = Array.isArray(science.ringDistances) ? science.ringDistances.join(', ') : '25, 50, 100';
    const interval = Number(science.contourInterval || 25);
    const regionCount = Number(science.regionCount || 3);
    return `
      <section class="g2-editor-section g2-map-editor">
        <h3>Map & spatial analysis</h3>
        ${field('Station coordinates', `<textarea id="g2Stations" spellcheck="false" placeholder="서울,37.5665,126.9780">${escapeHtml(stationText)}</textarea>`)}
        <div class="g2-editor-grid two">
          ${field('Ring distances (km)', `<input id="g2Rings" type="text" value="${escapeHtml(rings)}">`)}
          ${field('Contour interval (km)', `<input id="g2ContourInterval" type="number" min="1" step="1" value="${interval}">`)}
        </div>
        ${field('PCA region count', `<input id="g2RegionCount" type="number" min="2" max="6" step="1" value="${regionCount}">`)}
        <p class="g2-help">정점 거리 링은 QGIS의 multi-ring buffer 개념처럼 일정 거리 간격을 표시하고, 거리 등고선은 관측점까지의 최근접 거리장을 km 단위로 계산합니다.</p>
      </section>
    `;
  }

  function bindEditorEvents() {
    const panel = document.querySelector('#g2EditorPanel');
    if (!panel) return;

    panel.querySelector('#g2Apply')?.addEventListener('click', applyEditor);
    panel.querySelector('#g2Regenerate')?.addEventListener('click', () => document.querySelector('#generateBtn')?.click());

    panel.querySelectorAll('input,select,textarea').forEach((control) => {
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

    const palette = PALETTES[panel.querySelector('#g2Palette')?.value] || PALETTES['논문 기본'];
    const lineWidth = finite(panel.querySelector('#g2LineWidth')?.value, 2.25);
    const markerSize = finite(panel.querySelector('#g2MarkerSize')?.value, 9);

    plot.data.forEach((trace, index) => {
      const color = palette[index % palette.length];
      const update = {};
      if (trace.type === 'bar' || trace.type === 'waterfall') {
        update['marker.color'] = color;
        update['marker.line.color'] = '#FFFFFF';
        update['marker.line.width'] = 0.8;
        update.textposition = showLabels ? (trace.orientation === 'h' ? 'outside' : 'auto') : 'none';
      } else if (trace.type === 'pie' || trace.type === 'treemap' || trace.type === 'sunburst') {
        const length = trace.values?.length || trace.labels?.length || palette.length;
        update['marker.colors'] = [Array.from({ length }, (_, i) => palette[i % palette.length])];
        if (trace.type === 'pie') update.textinfo = showLabels ? 'label+percent' : 'none';
      } else if (trace.type === 'heatmap' || trace.type === 'contour') {
        update.colorscale = [[0, '#F8FAFC'], [0.25, palette[0]], [0.55, palette[Math.min(2, palette.length - 1)]], [1, palette[Math.min(4, palette.length - 1)]]];
      } else {
        if (trace.line) {
          update['line.color'] = color;
          update['line.width'] = lineWidth;
        }
        if (trace.marker) {
          update['marker.color'] = Array.isArray(trace.marker.color) ? trace.marker.color : color;
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
