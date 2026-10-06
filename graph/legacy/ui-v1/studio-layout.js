(function () {
  const typeFilters = [
    ["All", "__ALL__"],
    ["Bars", "BAR"],
    ["Lines", "LINE"],
    ["Areas", "AREA"],
    ["Scatter", "SCATTER"],
    ["Pies", "PIE"],
    ["Radial", "RADIAL"],
    ["Maps", "GEO"],
    ["Tables", "KPI"],
    ["Funnel", "FUNNEL"],
    ["Flow", "FLOW"],
    ["Text", "TEXT"],
  ];

  const purposeFilters = [
    ["All", "__ALL__"],
    ["Annotation", "TEXT"],
    ["Change over time", "LINE"],
    ["Comparison", "BAR"],
    ["Correlation", "SCATTER"],
    ["Distribution", "HEATMAP"],
    ["Exploration", "AREA"],
    ["Flow", "FLOW"],
    ["Geography", "GEO"],
    ["Magnitude", "RANGE"],
    ["Part-to-whole", "PIE"],
    ["Summary", "KPI"],
  ];

  const state = {
    showValues: true,
    cardShadow: true,
    plotSize: "standard",
    chartTone: "light",
    mapX: 0,
    mapY: 0,
    mapZoom: 1,
    stationText: [
      "Seoul,37.5665,126.9780",
      "Busan,35.1796,129.0756",
      "Daegu,35.8714,128.6014",
      "Incheon,37.4563,126.7052",
      "Gwangju,35.1595,126.8526",
    ].join("\n"),
  };

  window.addEventListener("DOMContentLoaded", () => {
    injectStudioStyle();
    installStudioShell();
    installTabs();
    installEditor();
    observeChartCards();
    setTimeout(() => activateFilter("__ALL__"), 80);
  });

  function installStudioShell() {
    if (document.body.classList.contains("studio-layout")) return;
    document.body.classList.add("studio-layout");

    const controls = document.querySelector(".controls");
    const brand = document.querySelector(".brand");
    const chartField = document.querySelector("#chartGroup")?.closest(".field");
    if (!controls || !chartField) return;

    controls.classList.add("template-sidebar");
    chartField.classList.add("chart-group-field");

    if (brand && !document.querySelector(".template-search")) {
      brand.insertAdjacentHTML("afterend", '<div class="template-search"><span aria-hidden="true">Search</span><input id="templateSearch" type="search" placeholder="Search templates" /></div>');
    }

    if (!document.querySelector(".template-filter-panel")) {
      chartField.insertAdjacentHTML("afterend", [
        '<section class="template-filter-panel" aria-label="Template filters">',
        filterSection("By", [["G2 Studio", "__ALL__", true], ["Shared", "__SHARED__", false], ["Mine", "__MINE__", false]], "by"),
        filterSection("Type", typeFilters.map(([label, value]) => [label, value, true]), "type"),
        filterSection("Purpose", purposeFilters.map(([label, value]) => [label, value, true]), "purpose"),
        "</section>",
      ].join(""));
    }

    const search = document.querySelector("#templateSearch");
    search?.addEventListener("input", () => filterVisibleOptions(search.value));

    document.querySelectorAll(".filter-chip[data-enabled='true']").forEach((button) => {
      button.addEventListener("click", () => activateFilter(button.dataset.value));
    });
  }

  function filterSection(title, items, kind) {
    return [
      `<div class="filter-section filter-${kind}">`,
      `<h3>${title}</h3>`,
      '<div class="filter-chips">',
      items.map(([label, value, enabled]) => `<button type="button" class="filter-chip${value === "__ALL__" ? " active" : ""}" data-value="${value}" data-enabled="${enabled}">${label}</button>`).join(""),
      "</div>",
      "</div>",
    ].join("");
  }

  function activateFilter(value) {
    if (!value || value.startsWith("__") && value !== "__ALL__") return;
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.value === value);
    });

    const chartGroup = document.querySelector("#chartGroup");
    if (!chartGroup) return;
    chartGroup.value = value;
    if (value === "__ALL__") {
      const allOption = [...chartGroup.options].find((option) => option.value === "__ALL__" || option.value === "ALL");
      if (allOption) chartGroup.value = allOption.value;
    }
    chartGroup.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function filterVisibleOptions(query) {
    const normalized = query.trim().toLowerCase();
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      const label = chip.textContent.toLowerCase();
      chip.hidden = Boolean(normalized && !label.includes(normalized));
    });
  }

  function installTabs() {
    const topbar = document.querySelector(".topbar");
    if (!topbar || document.querySelector(".studio-tabs")) return;

    topbar.insertAdjacentHTML("beforebegin", [
      '<nav class="studio-tabs" aria-label="View switcher">',
      '<button type="button" class="studio-tab active" data-view="preview"><span aria-hidden="true">Chart</span> Preview</button>',
      '<button type="button" class="studio-tab" data-view="data"><span aria-hidden="true">Grid</span> Data</button>',
      "</nav>",
    ].join(""));

    document.querySelectorAll(".studio-tab").forEach((button) => {
      button.addEventListener("click", () => setView(button.dataset.view));
    });
    setView("preview");
  }

  function setView(view) {
    document.querySelectorAll(".studio-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === view));
    document.body.dataset.view = view;
    const dataCard = document.querySelector(".data-editor-card");
    const summary = document.querySelector("#summary");
    const chartGrid = document.querySelector("#chartGrid");
    const empty = document.querySelector("#emptyState");
    if (dataCard) dataCard.hidden = view !== "data";
    if (summary) summary.hidden = view !== "preview";
    if (chartGrid) chartGrid.hidden = view !== "preview";
    if (empty) empty.hidden = view !== "preview" || Boolean(chartGrid?.children.length);
  }

  function installEditor() {
    const workspace = document.querySelector(".workspace");
    if (!workspace || document.querySelector(".chart-editor-panel")) return;
    workspace.insertAdjacentHTML("beforeend", [
      '<aside class="panel chart-editor-panel" aria-label="Chart editor">',
      '<header><strong>Customize</strong><span>Chart style and map position</span></header>',
      '<div class="editor-field"><label for="editorSize">Chart size</label><select id="editorSize"><option value="standard">Standard</option><option value="compact">Compact</option><option value="large">Large</option></select></div>',
      '<div class="editor-field"><label for="editorTone">Canvas tone</label><select id="editorTone"><option value="light">White</option><option value="soft">Soft</option><option value="contrast">Ink</option></select></div>',
      '<label class="editor-toggle"><input id="editorValues" type="checkbox" checked /> Show values</label>',
      '<label class="editor-toggle"><input id="editorCards" type="checkbox" checked /> Card shadow</label>',
      '<div class="editor-divider"></div>',
      '<h3>Map editor</h3>',
      '<div class="editor-grid-2">',
      '<div class="editor-field"><label for="mapX">X / longitude</label><input id="mapX" type="number" step="0.1" value="0" /></div>',
      '<div class="editor-field"><label for="mapY">Y / latitude</label><input id="mapY" type="number" step="0.1" value="0" /></div>',
      '</div>',
      '<div class="editor-field"><label for="mapZoom">Map zoom</label><input id="mapZoom" type="range" min="0.5" max="4" step="0.1" value="1" /></div>',
      '<div class="editor-field"><label for="stationCoords">Station coordinates</label><textarea id="stationCoords" spellcheck="false"></textarea></div>',
      '<button type="button" id="mapApply">Apply map edits</button>',
      '<button type="button" id="editorApply">Generate preview</button>',
      '<p class="editor-help">Station format: name, latitude, longitude. Map edits apply to current GEO charts.</p>',
      '</aside>',
    ].join(""));

    const stationBox = document.querySelector("#stationCoords");
    if (stationBox) stationBox.value = state.stationText;

    document.querySelector("#editorSize")?.addEventListener("change", (event) => {
      state.plotSize = event.target.value;
      applyEditorState();
    });
    document.querySelector("#editorTone")?.addEventListener("change", (event) => {
      state.chartTone = event.target.value;
      applyEditorState();
    });
    document.querySelector("#editorValues")?.addEventListener("change", (event) => {
      state.showValues = event.target.checked;
      applyValueVisibility();
    });
    document.querySelector("#editorCards")?.addEventListener("change", (event) => {
      state.cardShadow = event.target.checked;
      document.body.classList.toggle("flat-cards", !state.cardShadow);
    });
    ["#mapX", "#mapY", "#mapZoom", "#stationCoords"].forEach((selector) => {
      document.querySelector(selector)?.addEventListener("input", readMapEditor);
    });
    document.querySelector("#mapApply")?.addEventListener("click", () => {
      readMapEditor();
      applyMapEditor();
    });
    document.querySelector("#editorApply")?.addEventListener("click", () => document.querySelector("#generateBtn")?.click());
    applyEditorState();
  }

  function observeChartCards() {
    const grid = document.querySelector("#chartGrid");
    if (!grid) return;
    const observer = new MutationObserver(() => {
      applyEditorState();
      applyValueVisibility();
      applyMapEditor();
      setView(document.body.dataset.view || "preview");
    });
    observer.observe(grid, { childList: true });
  }

  function readMapEditor() {
    state.mapX = numberValue("#mapX", 0);
    state.mapY = numberValue("#mapY", 0);
    state.mapZoom = numberValue("#mapZoom", 1);
    state.stationText = document.querySelector("#stationCoords")?.value || "";
    window.stationCoordinates = parseStations(state.stationText);
  }

  function numberValue(selector, fallback) {
    const value = Number(document.querySelector(selector)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function parseStations(text) {
    const result = {};
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 3) return;
      const lat = Number(parts[1]);
      const lon = Number(parts[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      result[normalizeLabel(parts[0])] = { lat, lon };
    });
    return result;
  }

  function applyEditorState() {
    document.body.dataset.plotSize = state.plotSize;
    document.body.dataset.chartTone = state.chartTone;
    requestPlotResize();
  }

  function applyValueVisibility() {
    document.body.classList.toggle("hide-values", !state.showValues);
    if (!window.Plotly) return;
    document.querySelectorAll(".plot").forEach((plot) => {
      if (!plot.data) return;
      const textfont = plot.data.map((trace) => ({ ...(trace.textfont || {}), color: state.showValues ? undefined : "rgba(0,0,0,0)" }));
      try { window.Plotly.restyle(plot, { textfont }); } catch (_) {}
    });
  }

  function applyMapEditor() {
    if (!window.Plotly) return;
    const stations = window.stationCoordinates || parseStations(state.stationText);
    document.querySelectorAll(".plot").forEach((plot) => {
      if (!plot.data || !plot.data.some((trace) => trace.type === "scattergeo" || trace.type === "choropleth")) return;
      const layoutUpdate = {
        "geo.center.lon": state.mapX,
        "geo.center.lat": state.mapY,
        "geo.projection.scale": state.mapZoom,
      };
      try { window.Plotly.relayout(plot, layoutUpdate); } catch (_) {}

      plot.data.forEach((trace, traceIndex) => {
        if (trace.type !== "scattergeo") return;
        const names = extractTraceNames(trace);
        const lon = [];
        const lat = [];
        let changed = false;
        names.forEach((name, pointIndex) => {
          const found = stations[normalizeLabel(name)];
          lat[pointIndex] = found ? found.lat : trace.lat?.[pointIndex];
          lon[pointIndex] = found ? found.lon : trace.lon?.[pointIndex];
          if (found) changed = true;
        });
        if (changed) {
          try { window.Plotly.restyle(plot, { lat: [lat], lon: [lon] }, [traceIndex]); } catch (_) {}
        }
      });
    });
  }

  function extractTraceNames(trace) {
    const source = trace.text || trace.hovertext || trace.locations || [];
    return Array.from(source).map((value) => String(value).split("<br>")[0].split(":")[0].trim());
  }

  function normalizeLabel(value) {
    return String(value || "").trim().toLowerCase();
  }

  function requestPlotResize() {
    if (!window.Plotly) return;
    requestAnimationFrame(() => {
      document.querySelectorAll(".plot").forEach((plot) => {
        try { window.Plotly.Plots.resize(plot); } catch (_) {}
      });
    });
  }

  function injectStudioStyle() {
    if (document.querySelector("#studio-layout-style")) return;
    const style = document.createElement("style");
    style.id = "studio-layout-style";
    style.textContent = `
      body.studio-layout{--studio-border:rgba(23,37,51,.12);--studio-muted:#6b7680;--studio-ink:#172533;--studio-soft:#f6f8fb;--studio-blue:#316bea}
      .studio-layout .workspace{grid-template-columns:minmax(245px,285px) minmax(0,1fr) minmax(235px,275px);align-items:start}
      .studio-layout .template-sidebar,.studio-layout .chart-editor-panel{position:sticky;top:16px;max-height:calc(100vh - 32px);overflow:auto}
      .studio-layout .template-sidebar{gap:14px}
      .studio-layout .chart-group-field{position:absolute;inline-size:1px;block-size:1px;overflow:hidden;clip-path:inset(50%)}
      .template-search{display:grid;gap:7px;margin:6px 0 10px}
      .template-search span{font-size:11px;font-weight:800;color:var(--studio-muted);text-transform:uppercase}
      .template-search input{width:100%;height:36px;border:1px solid var(--studio-border);border-radius:6px;padding:0 11px;font-size:13px;background:#fff}
      .template-filter-panel{display:grid;gap:22px}
      .filter-section h3{margin:0 0 10px;font-size:13px;color:var(--studio-ink);font-weight:850}
      .filter-chips{display:flex;flex-wrap:wrap;gap:7px}
      .filter-chip{border:1px solid var(--studio-border);background:#fff;border-radius:999px;color:#273341;cursor:pointer;font-size:12px;line-height:1;padding:7px 10px;transition:background .16s ease,box-shadow .16s ease,transform .16s ease}
      .filter-chip:hover{transform:translateY(-1px);box-shadow:0 8px 18px rgba(33,48,64,.12)}
      .filter-chip.active{border-color:var(--studio-blue);background:linear-gradient(180deg,#4f86ff,#2f66df);color:#fff;box-shadow:0 8px 18px rgba(49,107,234,.22)}
      .filter-chip[data-enabled=false]{opacity:.48;cursor:not-allowed}
      .studio-tabs{height:44px;display:flex;align-items:end;gap:22px;border-bottom:1px solid var(--studio-border);margin:0 0 16px;background:#fff}
      .studio-tab{height:44px;border:0;background:transparent;color:#7b8490;font-weight:800;font-size:13px;cursor:pointer;border-bottom:3px solid transparent;padding:0 3px 10px}
      .studio-tab span{font-size:11px;color:inherit;margin-right:5px}
      .studio-tab.active{color:#111827;border-bottom-color:#111827}
      .chart-editor-panel{display:grid;gap:13px}
      .chart-editor-panel header{display:grid;gap:3px;margin-bottom:2px}
      .chart-editor-panel header strong{font-size:15px;color:var(--studio-ink)}
      .chart-editor-panel header span,.editor-help{font-size:12px;color:var(--studio-muted);line-height:1.45}
      .chart-editor-panel h3{margin:0;font-size:13px;color:var(--studio-ink)}
      .editor-field{display:grid;gap:6px}
      .editor-field label{font-size:12px;font-weight:800;color:#394655}
      .editor-field select,.editor-field input,.editor-field textarea{width:100%;border:1px solid var(--studio-border);border-radius:6px;background:#fff;color:#1d2935;font-size:12px;padding:8px}
      .editor-field textarea{min-height:116px;resize:vertical;font-family:Consolas,Monaco,monospace;line-height:1.35}
      .editor-grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .editor-toggle{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:750;color:#334155}
      .editor-divider{height:1px;background:var(--studio-border);margin:3px 0}
      #editorApply,#mapApply{height:34px;border:0;border-radius:7px;background:#172533;color:#fff;font-size:12px;font-weight:850;cursor:pointer}
      #mapApply{background:#316bea}
      body[data-plot-size=compact] .plot{height:300px!important}
      body[data-plot-size=standard] .plot{height:390px!important}
      body[data-plot-size=large] .plot{height:520px!important}
      body[data-chart-tone=soft] .chart-card{background:#f8fbfa}
      body[data-chart-tone=contrast] .chart-card{background:#15212d;color:#e8eef4}
      body[data-chart-tone=contrast] .chart-card .chart-title,body[data-chart-tone=contrast] .chart-card .chart-meta{color:#e8eef4}
      body.flat-cards .chart-card{box-shadow:none!important}
      @media (max-width:1180px){.studio-layout .workspace{grid-template-columns:250px minmax(0,1fr)}.studio-layout .chart-editor-panel{position:relative;top:auto;max-height:none;grid-column:1/-1}}
      @media (max-width:760px){.studio-layout .workspace{grid-template-columns:1fr}.studio-layout .template-sidebar{position:relative;top:auto;max-height:none}.studio-tabs{overflow:auto}}
    `;
    document.head.appendChild(style);
  }
}());
