(function () {
  const VERSION = "20260615-1320";
  let selectedCard = null;
  let busy = false;
  ready(start);
  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }
  function start() {
    document.body.classList.add("flourish-like-studio");
    cleanAll();
    tabs();
    filters();
    panel();
    style();
    setTimeout(refresh, 150);
    setTimeout(refresh, 800);
  }
  function refresh() {
    cleanAll();
    wireCards();
    selectCard(selectedCard && document.body.contains(selectedCard) ? selectedCard : document.querySelector(".chart-card"), false);
    setView(document.body.dataset.view || "preview");
  }
  function cleanAll() {
    document.querySelectorAll(".template-gallery-board,.premium-presets,#chartPresets,.preset-card").forEach((node) => (node.closest(".field") || node).remove());
    document.querySelectorAll(".filter-chip").forEach((chip) => {
      if (chip.textContent.trim().toLowerCase() === "all") chip.remove();
      if (chip.dataset.value === "__ALL__") {
        chip.dataset.value = "__SOURCE__";
        chip.dataset.enabled = "false";
        chip.classList.remove("active");
        chip.setAttribute("aria-disabled", "true");
      }
    });
    const select = document.querySelector("#chartGroup");
    if (!select) return;
    Array.from(select.options).forEach((option) => {
      if (["ALL", "__ALL__"].includes(option.value) || option.textContent.trim().toLowerCase() === "all") option.remove();
    });
    if (["ALL", "__ALL__"].includes(select.value)) select.value = "";
  }
  function tabs() {
    if (!document.querySelector(".studio-tabs")) document.querySelector(".topbar")?.insertAdjacentHTML("beforebegin", '<nav class="studio-tabs"><button type="button" class="studio-tab active" data-view="preview">Preview</button><button type="button" class="studio-tab" data-view="data">Data</button></nav>');
    document.querySelectorAll(".studio-tab").forEach((button) => {
      if (button.dataset.finalTab) return;
      button.dataset.finalTab = "1";
      button.addEventListener("click", () => setView(button.dataset.view));
    });
    setView("preview");
  }
  function setView(view) {
    const next = view === "data" ? "data" : "preview";
    document.body.dataset.view = next;
    document.querySelectorAll(".studio-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.view === next));
    show(".data-editor-card", next === "data");
    show("#summary", next === "preview");
    show("#chartGrid", next === "preview");
    show("#emptyState", next === "preview" && !document.querySelector("#chartGrid")?.children.length);
  }
  function filters() {
    if (document.body.dataset.finalFilters === VERSION) return;
    document.body.dataset.finalFilters = VERSION;
    document.addEventListener("click", (event) => {
      const chip = event.target.closest?.(".filter-chip");
      if (!chip) return;
      if (chip.dataset.enabled === "false" || chip.dataset.value?.startsWith("__")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const select = document.querySelector("#chartGroup");
      const value = chip.dataset.value;
      if (!select || !value || !Array.from(select.options).some((option) => option.value === value)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      document.querySelectorAll(".filter-chip").forEach((item) => item.classList.toggle("active", item === chip));
      select.value = value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      document.querySelector("#generateBtn")?.focus();
    }, true);
  }
  function panel() {
    const workspace = document.querySelector(".workspace");
    if (!workspace) return;
    let box = document.querySelector(".chart-editor-panel");
    if (!box) {
      workspace.insertAdjacentHTML("beforeend", '<aside class="panel chart-editor-panel"></aside>');
      box = document.querySelector(".chart-editor-panel");
    }
    box.innerHTML = '<header><strong class="editor-title">Chart</strong><span class="editor-sub">Select a chart to edit details.</span><em class="editor-badge">No chart</em></header><section class="selected-chart-tools"></section>';
    const grid = document.querySelector("#chartGrid");
    if (!grid || grid.dataset.finalInspector === VERSION) return;
    grid.dataset.finalInspector = VERSION;
    ["pointerdown", "click"].forEach((type) => {
      grid.addEventListener(type, (event) => {
        if (event.target.closest("button,input,label,select,textarea")) return;
        const card = event.target.closest(".chart-card");
        if (card) selectCard(card);
      }, true);
    });
    new MutationObserver(() => {
      wireCards();
      if (!selectedCard || !document.body.contains(selectedCard)) selectCard(document.querySelector(".chart-card"), false);
      setView(document.body.dataset.view || "preview");
    }).observe(grid, { childList: true, subtree: true });
  }
  function wireCards() {
    document.querySelectorAll(".chart-card").forEach((card) => {
      if (card.dataset.finalCard) return;
      card.dataset.finalCard = "1";
      card.tabIndex = 0;
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCard(card);
        }
      });
    });
  }
  function selectCard(card, focus = true) {
    if (!card) return emptyEditor();
    selectedCard = card;
    document.querySelectorAll(".chart-card.is-selected").forEach((item) => item.classList.remove("is-selected"));
    card.classList.add("is-selected");
    renderEditor(card);
    [0, 80, 220].forEach((delay) => setTimeout(() => {
      if (selectedCard === card && document.body.contains(card) && document.body.dataset.view !== "data") renderEditor(card);
    }, delay));
    if (focus && matchMedia("(max-width:1180px)").matches) document.querySelector(".chart-editor-panel")?.scrollIntoView({ block: "start" });
  }
  function emptyEditor() {
    const tools = document.querySelector(".selected-chart-tools");
    const badge = document.querySelector(".editor-badge");
    if (badge) badge.textContent = "No chart";
    if (tools) tools.innerHTML = '<div class="empty-editor"><b>Generate preview</b><span>Select a type on the left, then generate charts.</span></div>';
  }
  function renderEditor(card) {
    const plot = card.querySelector(".plot");
    const tools = document.querySelector(".selected-chart-tools");
    const badge = document.querySelector(".editor-badge");
    if (!plot || !tools) return;
    const type = kind(plot);
    const editor = document.querySelector(".chart-editor-panel");
    editor.dataset.inspectorType = type;
    editor.querySelector(".editor-title").textContent = titleFor(type);
    if (badge) badge.textContent = card.querySelector(".chart-card-header h3")?.textContent.trim() || type;
    tools.innerHTML = common(type, plot) + specific(type, plot) + '<section class="editor-actions"><button id="applySelectedChart" type="button">Apply changes</button><button id="generateFromEditor" type="button">Generate preview</button></section>';
    tools.querySelectorAll("input,select,textarea").forEach((input) => input.addEventListener(input.type === "checkbox" || input.tagName === "SELECT" ? "change" : "input", () => apply(type, plot)));
    tools.addEventListener("input", () => apply(type, plot), true);
    tools.addEventListener("change", () => apply(type, plot), true);
    tools.querySelectorAll(".palette-button").forEach((button) => button.addEventListener("click", () => applyPalette(plot, button.dataset.colors.split("|"))));
    tools.querySelector("#themeRefresh")?.addEventListener("click", () => applyPalette(plot, themeColors(tools.querySelector("#editorTheme")?.value || "report")));
    tools.querySelector("#editorTheme")?.addEventListener("change", (event) => applyPalette(plot, themeColors(event.target.value)));
    tools.querySelectorAll(".chart-type-segment").forEach((button) => button.addEventListener("click", () => switchChartType(button.dataset.type)));
    tools.querySelectorAll(".accordion-head").forEach((button) => button.addEventListener("click", () => button.closest(".editor-accordion")?.classList.toggle("open")));
    tools.querySelector("#applySelectedChart")?.addEventListener("click", () => apply(type, plot));
    tools.querySelector("#generateFromEditor")?.addEventListener("click", () => document.querySelector("#generateBtn")?.click());
  }
  function common(type, plot) {
    const layout = plot._fullLayout || plot.layout || {};
    return '<section class="editor-theme"><label>Theme</label><div class="theme-row"><select id="editorTheme"><option value="none">No Theme</option><option value="report">Report clean</option><option value="mint">Mint blue</option><option value="sunset">Sunset</option><option value="mono">Mono ink</option></select><button id="themeRefresh" type="button" title="Refresh theme">Refresh</button></div></section>' +
      '<section class="editor-section hierarchy-editor"><button class="section-head" type="button">' + sectionTitle(type) + '<span>v</span></button>' + typeSegments(type) + '<div class="editor-grid three">' +
      field("Sort by", '<select id="sortBy"><option>Value</option><option>Name</option><option>Original order</option></select>') + field("Size cells by", '<select id="sizeBy"><option>Sum</option><option>Count</option><option>Average</option></select>') + field("Depth", '<input id="chartDepth" type="number" min="1" max="6" value="3">') + '</div></section>' +
      accordion(primaryPanelName(type), true, field("Title", '<input id="studioTitle" value="' + esc((layout.title?.text || "").replace(/<br>.*/, "")) + '">') + '<div class="editor-grid">' + field("Chart size", '<input id="studioHeight" type="number" min="260" max="760" step="20" value="' + Math.round(layout.height || plot.clientHeight || 390) + '">') + field("Canvas", '<select id="studioTone"><option value="white">White</option><option value="#f7faf9">Soft</option><option value="#111827">Ink</option></select>') + '</div>') +
      accordion("Labels", false, '<label class="editor-toggle"><input id="studioValues" type="checkbox" checked> Show values</label>' + field("Value labels", '<select id="labelMode"><option value="auto">Auto</option><option value="outside">Outside</option><option value="inside">Inside</option><option value="none">Hide</option></select>')) + accordion("Colors", false, paletteControls()) + accordion("Legend", false, '<label class="editor-toggle"><input id="studioLegend" type="checkbox" ' + (layout.showlegend === false ? "" : "checked") + '> Show legend</label>') + accordion("Controls", false, '<p class="tool-note">Click a chart card, then edit this panel. Changes apply to the selected chart.</p>') + accordion("Popups & Panels", false, '<p class="tool-note">Popup fields are kept from generated data. Use the Data tab to change source columns.</p>');
  }
  function specific(type, plot) {
    if (type === "bar") return accordion("Bars", true, field("Mode", '<select id="barMode"><option value="group">Grouped</option><option value="stack">Stacked</option><option value="relative">Positive / negative</option></select>') + field("Spacing", '<input id="barGap" type="range" min="0" max="0.8" step="0.02" value="' + (plot._fullLayout?.bargap ?? 0.18) + '">'));
    if (type === "line") return accordion("Lines", true, field("Shape", '<select id="lineShape"><option value="linear">Straight</option><option value="spline">Smooth</option><option value="hv">Step</option></select>') + '<label class="editor-toggle"><input id="lineMarkers" type="checkbox" checked> Show markers</label>');
    if (type === "pie") return accordion("Sunburst", true, field("Donut hole", '<input id="pieHole" type="range" min="0" max="0.78" step="0.03" value="' + (plot.data?.[0]?.hole ?? 0.45) + '">'));
    if (type === "text") return accordion("Text", true, field("Text scale", '<input id="textScale" type="range" min="0.7" max="1.7" step="0.05" value="1">'));
    if (type === "geo") return accordion("Map editor", true, '<p class="tool-note">Edit station bubble coordinates only. The base map stays fixed.</p>' + field("Station coordinates", '<textarea id="stationCoords" spellcheck="false">' + esc(stationRows(plot)) + '</textarea>'));
    return "";
  }
  function paletteControls() {
    const sets = [["#1f77b4", "#2bb3a3", "#a7d96d", "#f4c542"], ["#315efb", "#8b5cf6", "#ec4899", "#f97316"], ["#1e3a5f", "#287c8e", "#75c9b7", "#e8c547"], ["#111827", "#4b5563", "#9ca3af", "#d1d5db"]];
    return '<div class="palette-row">' + sets.map((colors) => '<button type="button" class="palette-button" data-colors="' + colors.join("|") + '">' + colors.map((color) => '<span style="background:' + color + '"></span>').join("") + "</button>").join("") + "</div>";
  }
  function titleFor(type) { return type === "geo" ? "Map bubbles" : type === "bar" ? "Bars" : type === "line" ? "Lines" : (type === "pie" || type === "treemap") ? "Hierarchy" : type === "text" ? "Text" : "Chart"; }
  function sectionTitle(type) { return (type === "pie" || type === "treemap") ? "Hierarchy" : type === "geo" ? "Map" : titleFor(type); }
  function primaryPanelName(type) { return type === "pie" ? "Sunburst" : type === "treemap" ? "Treemap" : type === "geo" ? "Map" : titleFor(type); }
  function typeSegments(type) {
    const active = type === "bar" ? "BAR" : type === "geo" ? "GEO" : type === "line" ? "LINE" : type === "pie" ? "RADIAL" : "";
    return '<div class="chart-type-segments">' + [["TREEMAP", "Treemap"], ["PIE", "Circles"], ["RADIAL", "Sunburst"], ["BAR", "Bars"], ["RADIAL", "Radial"]].map(([value, label]) => '<button type="button" class="chart-type-segment ' + (active === value && (label === "Bars" || label === "Sunburst") ? "active" : "") + '" data-type="' + value + '">' + label + '</button>').join("") + "</div>";
  }
  function accordion(title, open, body) { return '<section class="editor-accordion ' + (open ? "open" : "") + '"><button type="button" class="accordion-head"><span>' + title + '</span><b>&rsaquo;</b></button><div class="accordion-body">' + body + "</div></section>"; }
  function switchChartType(type) {
    const select = document.querySelector("#chartGroup");
    if (!select || !type) return;
    const option = Array.from(select.options).find((item) => item.value === type) || Array.from(select.options).find((item) => item.value.includes(type) || item.textContent.toUpperCase().includes(type));
    if (!option) return;
    select.value = option.value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.toggle("active", chip.dataset.value === option.value));
    document.querySelector("#generateBtn")?.click();
  }
  function themeColors(name) {
    if (name === "mint") return ["#bdeecf", "#72d3bd", "#27adbb", "#2568a8", "#1f2a7c"];
    if (name === "sunset") return ["#ffd166", "#f59e42", "#ef476f", "#7c3aed", "#235789"];
    if (name === "mono") return ["#111827", "#374151", "#6b7280", "#9ca3af", "#d1d5db"];
    return ["#2f6cea", "#2bb3a3", "#b8e6a3", "#f4c542", "#ef476f"];
  }
  function field(label, control) { return '<div class="editor-field"><label>' + label + "</label>" + control + "</div>"; }
  function apply(type, plot) {
    if (!plot || !window.Plotly || busy) return;
    busy = true;
    const root = document.querySelector(".chart-editor-panel");
    const showValues = root?.querySelector("#studioValues")?.checked !== false;
    const label = root?.querySelector("#labelMode")?.value || "auto";
    try { Plotly.relayout(plot, { "title.text": valueIn(root, "#studioTitle", ""), height: numIn(root, "#studioHeight", 390), paper_bgcolor: valueIn(root, "#studioTone", "white"), plot_bgcolor: valueIn(root, "#studioTone", "white") === "#111827" ? "#111827" : "white", font: { color: valueIn(root, "#studioTone", "white") === "#111827" ? "#f8fafc" : "#334155" }, showlegend: root?.querySelector("#studioLegend")?.checked !== false }); } catch (_) {}
    if (type === "bar") { const ids = indexes(plot, (t) => t.type === "bar" || t.type === "waterfall"); try { Plotly.relayout(plot, { barmode: valueIn(root, "#barMode", "group"), bargap: numIn(root, "#barGap", 0.18) }); } catch (_) {} try { Plotly.restyle(plot, { textposition: showValues && label !== "none" ? label : "none" }, ids); } catch (_) {} }
    if (type === "line") { const ids = indexes(plot, (t) => t.type === "scatter"); try { Plotly.restyle(plot, { "line.shape": valueIn(root, "#lineShape", "linear"), mode: root?.querySelector("#lineMarkers")?.checked === false ? "lines+text" : "lines+markers+text", textposition: showValues && label !== "none" ? "top center" : "none" }, ids); } catch (_) {} }
    if (type === "pie") { try { Plotly.restyle(plot, { hole: numIn(root, "#pieHole", 0.45), textinfo: showValues && label !== "none" ? "label+percent" : "none" }, indexes(plot, (t) => t.type === "pie")); } catch (_) {} }
    if (type === "text") { const scale = numIn(root, "#textScale", 1); indexes(plot, (t) => t.type === "scatter" && String(t.mode || "").includes("text")).forEach((i) => { const trace = plot.data[i]; const base = trace.__baseSize || trace.textfont?.size || 18; trace.__baseSize = base; const size = Array.isArray(base) ? base.map((v) => Math.max(8, v * scale)) : Math.max(8, base * scale); try { Plotly.restyle(plot, { textfont: [{ ...(trace.textfont || {}), size }] }, [i]); } catch (_) {} }); }
    if (type === "geo") applyStations(plot);
    setTimeout(() => { busy = false; }, 0);
  }
  function applyPalette(plot, colors) {
    plot.data.forEach((trace, i) => {
      const update = {};
      if (trace.type === "pie" || trace.type === "treemap") update["marker.colors"] = [Array.from({ length: trace.values?.length || 1 }, (_, n) => colors[n % colors.length])];
      else if (trace.type === "heatmap") update.colorscale = [[0, colors[0]], [0.5, colors[1]], [1, colors[colors.length - 1]]];
      else update["marker.color"] = colors[i % colors.length];
      if (trace.line) update["line.color"] = colors[i % colors.length];
      try { Plotly.restyle(plot, update, [i]); } catch (_) {}
    });
  }
  function applyStations(plot) {
    const rows = parseStations(document.querySelector(".chart-editor-panel")?.querySelector("#stationCoords")?.value || "");
    plot.data.forEach((trace, i) => {
      if (trace.type !== "scattergeo") return;
      const names = namesOf(trace);
      const lat = Array.from(trace.lat || []);
      const lon = Array.from(trace.lon || []);
      names.forEach((name, n) => { const row = rows[norm(name)] || Object.values(rows)[n]; if (row) { lat[n] = row.lat; lon[n] = row.lon; } });
      try { Plotly.restyle(plot, { lat: [lat], lon: [lon] }, [i]); } catch (_) {}
    });
  }
  function kind(plot) {
    if (!plot?.data) return "empty";
    if (plot.data.some((t) => t.type === "scattergeo")) return "geo";
    if (plot.data.some((t) => t.type === "treemap")) return "treemap";
    if (plot.data.some((t) => t.type === "bar" || t.type === "waterfall")) return "bar";
    if (plot.data.some((t) => t.type === "pie")) return "pie";
    if (plot.data.some((t) => t.type === "scatter" && String(t.mode || "").includes("text") && !String(t.mode || "").includes("markers"))) return "text";
    if (plot.data.some((t) => t.type === "scatter")) return "line";
    return "default";
  }
  function stationRows(plot) { const trace = plot.data?.find((t) => t.type === "scattergeo"); if (!trace) return ""; return namesOf(trace).map((name, i) => `${name},${Number(trace.lat?.[i]).toFixed(4)},${Number(trace.lon?.[i]).toFixed(4)}`).join("\n"); }
  function parseStations(text) { const out = {}; text.split(/\r?\n/).forEach((line) => { const [name, lat, lon] = line.split(",").map((v) => v.trim()); if (name && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))) out[norm(name)] = { lat: Number(lat), lon: Number(lon) }; }); return out; }
  function namesOf(trace) { return Array.from(trace.text || trace.hovertext || trace.locations || []).map((v) => String(v).split("<br>")[0].split(":")[0].trim()); }
  function indexes(plot, test) { const result = []; plot.data.forEach((trace, i) => { if (test(trace)) result.push(i); }); return result; }
  function show(selector, on) { const node = document.querySelector(selector); if (node) node.hidden = !on; }
  function valueIn(root, selector, fallback) { return root?.querySelector(selector)?.value || fallback; }
  function numIn(root, selector, fallback) { const value = Number(root?.querySelector(selector)?.value); return Number.isFinite(value) ? value : fallback; }
  function esc(value) { return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"); }
  function norm(value) { return String(value || "").trim().toLowerCase(); }
  function style() {
    if (document.querySelector("#flourish-like-studio-style")) return;
    const style = document.createElement("style");
    style.id = "flourish-like-studio-style";
    style.textContent = `.flourish-like-studio .workspace{grid-template-columns:minmax(250px,300px) minmax(0,1fr) minmax(270px,320px)!important;gap:14px!important;align-items:start}.flourish-like-studio .template-sidebar,.flourish-like-studio .chart-editor-panel{position:sticky;top:12px;max-height:calc(100vh - 24px);overflow:auto;border:1px solid rgba(15,23,42,.1)!important;border-radius:8px!important;background:#fbfcfd!important;box-shadow:0 1px 0 rgba(15,23,42,.04)!important}.flourish-like-studio .template-sidebar{padding:12px!important}.flourish-like-studio .chart-group-field{position:absolute!important;width:1px!important;height:1px!important;overflow:hidden!important;clip-path:inset(50%)!important}.flourish-like-studio .filter-chip{min-height:30px!important;padding:7px 10px!important;border-radius:999px!important;background:#fff!important;border:1px solid rgba(15,23,42,.14)!important;color:#172033!important;font-weight:750!important;box-shadow:none!important}.flourish-like-studio .filter-chip.active{background:#2f6cea!important;border-color:#2f6cea!important;color:#fff!important;box-shadow:0 8px 18px rgba(47,108,234,.2)!important}.flourish-like-studio .studio-tabs{height:48px!important;display:flex!important;align-items:end!important;gap:24px!important;margin:0 0 14px!important;border-bottom:1px solid rgba(15,23,42,.12)!important;background:#fff!important}.flourish-like-studio .studio-tab{height:48px!important;border:0!important;border-bottom:3px solid transparent!important;background:transparent!important;padding:0 2px 11px!important;color:#7b8490!important;font-weight:850!important;cursor:pointer!important}.flourish-like-studio .studio-tab.active{color:#111827!important;border-bottom-color:#111827!important}.flourish-like-studio .chart-card{cursor:pointer!important;transition:border-color .14s ease,transform .14s ease!important}.flourish-like-studio .chart-card:hover{transform:translateY(-1px);border-color:rgba(47,108,234,.35)!important}.flourish-like-studio .chart-card.is-selected{outline:2px solid #2f6cea!important;outline-offset:2px!important;border-color:#2f6cea!important}.flourish-like-studio .chart-editor-panel{display:grid!important;gap:0!important;padding:0!important;background:#fff!important}.flourish-like-studio .chart-editor-panel header{position:sticky;top:0;z-index:4;display:grid!important;gap:8px!important;padding:16px!important;border-bottom:1px solid rgba(15,23,42,.12)!important;background:#fff!important}.flourish-like-studio .chart-editor-panel header strong{font-size:18px!important;letter-spacing:0!important}.flourish-like-studio .chart-editor-panel header span{font-size:12px!important;color:#697586!important}.flourish-like-studio .editor-badge{width:max-content;max-width:100%;padding:6px 8px;border-radius:6px;background:#eef4ff;color:#2454c6;font-size:11px;font-style:normal;font-weight:850;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.flourish-like-studio .editor-theme{display:grid;gap:8px;padding:16px;border-bottom:1px solid rgba(15,23,42,.12);background:#fff}.flourish-like-studio .editor-theme label{font-size:13px;font-weight:850;color:#334155}.flourish-like-studio .theme-row{display:grid;grid-template-columns:1fr 46px;gap:10px}.flourish-like-studio .theme-row button{border:0;border-radius:6px;background:#eef0f3;color:#334155;font-size:11px;font-weight:850;cursor:pointer}.flourish-like-studio .editor-section{display:grid;gap:12px;padding:0 16px 16px;border-bottom:1px solid rgba(15,23,42,.12);background:#fff}.flourish-like-studio .section-head{margin:0 -16px 0;padding:13px 16px;display:flex;justify-content:space-between;align-items:center;border:0;background:#ececef;color:#334155;font-size:14px;font-weight:900;text-align:left;cursor:pointer}.flourish-like-studio .chart-type-segments{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid rgba(15,23,42,.12);border-radius:6px;overflow:hidden}.flourish-like-studio .chart-type-segment{min-height:34px;border:0;border-right:1px solid rgba(15,23,42,.1);background:#f4f4f5;color:#334155;font-size:12px;font-weight:750;cursor:pointer}.flourish-like-studio .chart-type-segment:last-child{border-right:0}.flourish-like-studio .chart-type-segment.active{background:#e7f0ff;color:#2454c6;box-shadow:inset 0 -2px 0 #2f6cea}.flourish-like-studio .editor-field{display:grid!important;gap:6px!important}.flourish-like-studio .editor-field label,.flourish-like-studio .editor-toggle{font-size:12px!important;font-weight:800!important;color:#334155!important}.flourish-like-studio .editor-field input,.flourish-like-studio .editor-field select,.flourish-like-studio .editor-field textarea,.flourish-like-studio .editor-theme select{width:100%!important;border:1px solid rgba(15,23,42,.16)!important;border-radius:6px!important;background:#fff!important;color:#172033!important;font-size:12px!important;padding:8px!important;min-height:36px!important}.flourish-like-studio .editor-field textarea{min-height:170px!important;font-family:Consolas,monospace!important}.flourish-like-studio .editor-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important}.flourish-like-studio .editor-grid.three{grid-template-columns:1fr 1fr 78px!important}.flourish-like-studio .editor-toggle{display:flex!important;align-items:center!important;gap:8px!important}.flourish-like-studio .palette-row{display:flex;gap:8px;flex-wrap:wrap}.flourish-like-studio .palette-button{display:grid;grid-template-columns:repeat(4,15px);gap:0;overflow:hidden;height:30px;padding:0;border:1px solid rgba(15,23,42,.15);border-radius:6px;background:#fff;cursor:pointer}.flourish-like-studio .palette-button span{display:block;width:15px;height:30px}.flourish-like-studio .editor-accordion{border-bottom:1px solid rgba(15,23,42,.12);background:#fff}.flourish-like-studio .accordion-head{width:100%;min-height:48px;border:0;background:#fff;display:flex;align-items:center;justify-content:space-between;padding:0 16px;color:#334155;font-size:14px;font-weight:850;text-align:left;cursor:pointer}.flourish-like-studio .accordion-head b{font-size:20px;transition:transform .14s ease}.flourish-like-studio .editor-accordion.open .accordion-head b{transform:rotate(90deg)}.flourish-like-studio .accordion-body{display:none;padding:0 16px 16px;gap:12px}.flourish-like-studio .editor-accordion.open .accordion-body{display:grid}.flourish-like-studio .editor-actions{display:grid;gap:8px;padding:14px}.flourish-like-studio .editor-actions button{height:36px;border-radius:6px;border:0;background:#172033;color:#fff;font-size:12px;font-weight:850;cursor:pointer}.flourish-like-studio .editor-actions #generateFromEditor{background:#2f6cea}.flourish-like-studio .empty-editor{display:grid;gap:6px;padding:14px;color:#697586;font-size:12px}.flourish-like-studio .tool-note{margin:0;color:#697586;font-size:12px;line-height:1.45}@media (max-width:1180px){.flourish-like-studio .workspace{grid-template-columns:260px minmax(0,1fr)!important}.flourish-like-studio .chart-editor-panel{position:relative;top:auto;max-height:none;grid-column:1/-1}}@media (max-width:760px){.flourish-like-studio .workspace{grid-template-columns:1fr!important}.flourish-like-studio .template-sidebar{position:relative;top:auto;max-height:none}}`;
    document.head.appendChild(style);
  }
}());
