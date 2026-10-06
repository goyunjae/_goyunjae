(function () {
  let selectedCard = null;

  window.addEventListener("DOMContentLoaded", () => {
    removeRegionMap();
    installAllFilterFix();
    installMapGuard();
    installMapApplyOverride();
    installTextThemeFix();
    installChartInspector();
    injectPanelRefresh();
  });

  function removeRegionMap() {
    if (typeof window.chartSpecs !== "function" || window.chartSpecs.__withoutRegionMap) return;
    const previous = window.chartSpecs;
    window.chartSpecs = function chartSpecsWithoutRegionMap() {
      return previous().filter((spec) => !(spec.group === "GEO" && String(spec.label || "").includes("\uC9C0\uC5ED \uC9C0\uB3C4")));
    };
    window.chartSpecs.__withoutRegionMap = true;
  }

  function installAllFilterFix() {
    document.addEventListener("click", (event) => {
      const chip = event.target.closest?.(".filter-chip");
      if (!chip || chip.dataset.value !== "__ALL__") return;
      const select = document.querySelector("#chartGroup");
      if (!select) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const allOption = Array.from(select.options).find((option) => option.value === "__ALL__");
      select.value = allOption ? "__ALL__" : "";
      document.querySelectorAll(".filter-chip").forEach((item) => {
        item.classList.toggle("active", item === chip || item.dataset.value === "__ALL__");
      });
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }, true);
  }

  function installMapGuard() {
    if (!window.Plotly || window.Plotly.__studioMapGuard) return;
    const originalRelayout = window.Plotly.relayout.bind(window.Plotly);
    window.Plotly.relayout = function guardedRelayout(plot, update, traces) {
      if (update && plot?.data?.some((trace) => trace.type === "choropleth") && !plot.data.some((trace) => trace.type === "scattergeo")) {
        update = { ...update };
        delete update["geo.center.lon"];
        delete update["geo.center.lat"];
        delete update["geo.projection.scale"];
      }
      if (update && update["geo.center.lon"] === 0 && update["geo.center.lat"] === 0 && update["geo.projection.scale"] === 1) {
        update = { ...update };
        delete update["geo.center.lon"];
        delete update["geo.center.lat"];
        delete update["geo.projection.scale"];
      }
      return Object.keys(update || {}).length ? originalRelayout(plot, update, traces) : Promise.resolve(plot);
    };
    window.Plotly.__studioMapGuard = true;
  }

  function installMapApplyOverride() {
    const apply = document.querySelector("#mapApply");
    if (!apply || apply.dataset.safeMapApply) return;
    if (!document.querySelector("#mapReset")) {
      apply.insertAdjacentHTML("afterend", '<button type="button" id="mapReset">Reset map</button>');
      apply.parentElement?.classList.add("editor-actions");
    }
    apply.dataset.safeMapApply = "true";
    apply.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      safeApplyMap();
    }, true);
    document.querySelector("#mapReset")?.addEventListener("click", resetMap);
  }

  function installTextThemeFix() {
    document.addEventListener("click", (event) => {
      if (!event.target.closest?.(".theme-icon")) return;
      setTimeout(applyTextChartColors, 250);
      setTimeout(applyTextChartColors, 900);
    }, true);

    const grid = document.querySelector("#chartGrid");
    if (grid) {
      new MutationObserver(() => setTimeout(applyTextChartColors, 250)).observe(grid, { childList: true, subtree: true });
    }
    setTimeout(applyTextChartColors, 600);
  }

  function applyTextChartColors() {
    if (!window.Plotly) return;
    const colors = activeThemeColors();
    document.querySelectorAll(".chart-card").forEach((card) => {
      const title = card.querySelector(".chart-card-header h3")?.textContent || "";
      const plot = card.querySelector(".plot");
      if (!plot?.data) return;
      plot.data.forEach((trace, traceIndex) => {
        const mode = String(trace.mode || "");
        const isTextTrace = title.includes("TEXT") || trace.type === "scatter" && mode.includes("text") && !mode.includes("markers");
        if (!isTextTrace) return;
        const count = Array.isArray(trace.text) ? trace.text.length : Array.isArray(trace.x) ? trace.x.length : 1;
        const color = Array.from({ length: count }, (_, index) => colors[index % colors.length]);
        const size = Array.isArray(trace.textfont?.size) ? trace.textfont.size : trace.textfont?.size || 16;
        try {
          window.Plotly.restyle(plot, {
            textfont: [{ ...(trace.textfont || {}), size, color }],
          }, [traceIndex]);
        } catch (_) {}
      });
    });
  }

  function activeThemeColors() {
    const active = document.querySelector(".theme-icon.active") || document.querySelector(".theme-icon");
    const colors = Array.from(active?.querySelectorAll("span") || [])
      .map((span) => span.style.backgroundColor)
      .filter(Boolean);
    return colors.length ? colors : ["#45B8AC", "#B8E6A3", "#2F95B8", "#2D64A8"];
  }

  function installChartInspector() {
    const grid = document.querySelector("#chartGrid");
    if (!grid) return;
    grid.addEventListener("click", (event) => {
      if (event.target.closest("button,input,label,select,textarea")) return;
      const card = event.target.closest(".chart-card");
      if (card) selectChartCard(card);
    });
    new MutationObserver(() => {
      decorateChartCards();
      if (!selectedCard || !document.body.contains(selectedCard)) {
        selectChartCard(document.querySelector(".chart-card"), false);
      }
    }).observe(grid, { childList: true, subtree: true });
    decorateChartCards();
    setTimeout(() => selectChartCard(document.querySelector(".chart-card"), false), 500);
  }

  function decorateChartCards() {
    document.querySelectorAll(".chart-card").forEach((card) => {
      if (card.dataset.inspectable) return;
      card.dataset.inspectable = "true";
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Select chart for editing");
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectChartCard(card);
        }
      });
    });
  }

  function selectChartCard(card, focusPanel = true) {
    if (!card) return;
    selectedCard = card;
    document.querySelectorAll(".chart-card.is-selected").forEach((item) => item.classList.remove("is-selected"));
    card.classList.add("is-selected");
    updateInspectorTitle();
    hydrateStationBoxFromSelectedChart();
    if (focusPanel) document.querySelector(".chart-editor-panel")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  function updateInspectorTitle() {
    const panel = document.querySelector(".chart-editor-panel");
    if (!panel) return;
    let badge = panel.querySelector(".selected-chart-badge");
    if (!badge) {
      panel.querySelector("header")?.insertAdjacentHTML("beforeend", '<span class="selected-chart-badge"></span>');
      badge = panel.querySelector(".selected-chart-badge");
    }
    const title = selectedCard?.querySelector(".chart-card-header h3")?.textContent?.trim() || "Click a chart";
    badge.textContent = `Editing: ${title}`;
  }

  function hydrateStationBoxFromSelectedChart() {
    const plot = selectedPlot();
    const box = document.querySelector("#stationCoords");
    if (!plot || !box) return;
    const trace = plot.data?.find((item) => item.type === "scattergeo");
    if (!trace) return;
    const names = extractNames(trace);
    const rows = names.map((name, index) => {
      const lat = trace.lat?.[index];
      const lon = trace.lon?.[index];
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) return null;
      return `${name},${Number(lat).toFixed(4)},${Number(lon).toFixed(4)}`;
    }).filter(Boolean);
    if (rows.length) box.value = rows.join("\n");
  }

  function selectedPlot() {
    return selectedCard?.querySelector(".plot") || null;
  }

  function safeApplyMap() {
    if (!window.Plotly) return;
    const stationText = document.querySelector("#stationCoords")?.value || "";
    const stations = parseStations(stationText);
    const stationRows = parseStationRows(stationText);
    window.stationCoordinates = stations;

    const plots = selectedPlot() ? [selectedPlot()] : Array.from(document.querySelectorAll(".plot"));
    plots.forEach((plot) => {
      if (!plot.data) return;
      const hasBubbleMap = plot.data.some((trace) => trace.type === "scattergeo");
      if (!hasBubbleMap) return;

      plot.data.forEach((trace, traceIndex) => {
        if (trace.type !== "scattergeo") return;
        const names = extractNames(trace);
        const lat = Array.from(trace.lat || []);
        const lon = Array.from(trace.lon || []);
        let changed = false;
        names.forEach((name, index) => {
          const station = stations[normalize(name)] || stationRows[index];
          if (!station) return;
          lat[index] = station.lat;
          lon[index] = station.lon;
          changed = true;
        });
        if (changed) {
          try { window.Plotly.restyle(plot, { lat: [lat], lon: [lon] }, [traceIndex]); } catch (_) {}
        }
      });
    });
  }

  function resetMap() {
    const x = document.querySelector("#mapX");
    const y = document.querySelector("#mapY");
    const zoom = document.querySelector("#mapZoom");
    if (x) x.value = "";
    if (y) y.value = "";
    if (zoom) zoom.value = "1";
    if (!window.Plotly) return;
    const plots = selectedPlot() ? [selectedPlot()] : Array.from(document.querySelectorAll(".plot"));
    plots.forEach((plot) => {
      if (!plot.data?.some((trace) => trace.type === "scattergeo")) return;
      try {
        window.Plotly.relayout(plot, {
          "geo.center.lon": null,
          "geo.center.lat": null,
          "geo.projection.scale": null,
        });
      } catch (_) {}
    });
  }

  function optionalNumber(selector, min, max) {
    const raw = document.querySelector(selector)?.value;
    if (!raw || raw.trim() === "") return null;
    const value = Number(raw);
    if (!Number.isFinite(value)) return null;
    return Math.max(min, Math.min(max, value));
  }

  function numberValue(selector, fallback) {
    const value = Number(document.querySelector(selector)?.value);
    return Number.isFinite(value) ? value : fallback;
  }

  function parseStations(text) {
    const result = {};
    parseStationRows(text).forEach((row) => {
      result[normalize(row.name)] = { lat: row.lat, lon: row.lon };
    });
    return result;
  }

  function parseStationRows(text) {
    const rows = [];
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 3) return;
      const lat = Number(parts[1]);
      const lon = Number(parts[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      rows.push({ name: parts[0], lat, lon });
    });
    return rows;
  }

  function extractNames(trace) {
    return Array.from(trace.text || trace.hovertext || []).map((value) => String(value).split("<br>")[0].split(":")[0].trim());
  }

  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function injectPanelRefresh() {
    if (document.querySelector("#studio-panel-refresh-style")) return;
    const style = document.createElement("style");
    style.id = "studio-panel-refresh-style";
    style.textContent = `
      .studio-layout .template-sidebar,.studio-layout .chart-editor-panel{border:1px solid rgba(23,37,51,.09)!important;border-radius:8px!important;box-shadow:none!important;background:#fbfcfd!important}
      .studio-layout .template-sidebar{padding:14px!important;border-top:1px solid rgba(23,37,51,.09)!important;gap:12px!important}
      .studio-layout .template-sidebar .brand{margin-bottom:12px!important;padding-bottom:12px;border-bottom:1px solid rgba(23,37,51,.08)}
      .studio-layout .template-sidebar .brand-mark{width:34px!important;height:34px!important;border-radius:8px!important;box-shadow:none!important;background:#172533!important}
      .studio-layout .template-sidebar h1{font-size:16px!important}
      .studio-layout .template-sidebar .brand p{display:none!important}
      .studio-layout .template-sidebar .drop-zone{padding:12px!important;border-radius:8px!important;background:#fff!important;border-color:rgba(23,37,51,.12)!important;margin-bottom:10px!important}
      .studio-layout .template-sidebar .status{min-height:34px!important;margin-top:10px!important;padding:8px!important;background:#fff!important;border-color:rgba(23,37,51,.08)!important}
      .studio-layout .filter-chip{min-height:28px!important;padding:6px 9px!important;box-shadow:none}
      .studio-layout .filter-chip.active{background:#2f6cea!important;border-color:#275fd8!important;box-shadow:0 5px 13px rgba(49,107,234,.22)!important}
      .studio-layout .chart-card{cursor:pointer}
      .studio-layout .chart-card.is-selected{outline:2px solid #2f6cea!important;outline-offset:2px;border-color:#2f6cea!important}
      .studio-layout .chart-editor-panel{padding:0!important;gap:0!important;background:#fff!important;border-color:rgba(23,37,51,.12)!important}
      .studio-layout .chart-editor-panel header{padding:14px 14px 12px!important;border-bottom:1px solid rgba(23,37,51,.08);background:#fbfcfd!important;position:sticky;top:0;z-index:2}
      .studio-layout .chart-editor-panel header strong{font-size:14px!important}
      .studio-layout .chart-editor-panel header span:not(.selected-chart-badge){font-size:11px!important;color:#7b8490!important}
      .studio-layout .selected-chart-badge{display:block;margin-top:7px;padding:7px 8px;border-radius:6px;background:#eef4ff;color:#2454c6;font-size:11px;font-weight:850;line-height:1.35}
      .studio-layout .chart-editor-panel>.editor-field,
      .studio-layout .chart-editor-panel>.editor-toggle,
      .studio-layout .chart-editor-panel>.editor-divider,
      .studio-layout .chart-editor-panel>h3,
      .studio-layout .chart-editor-panel>.editor-actions,
      .studio-layout .chart-editor-panel>#editorApply,
      .studio-layout .chart-editor-panel>.editor-help{margin-left:14px!important;margin-right:14px!important}
      .studio-layout .chart-editor-panel>.editor-field{margin-top:12px!important}
      .studio-layout .chart-editor-panel>.editor-toggle{min-height:32px;border-top:1px solid rgba(23,37,51,.06);padding-top:10px}
      .studio-layout .chart-editor-panel .editor-grid-2,
      .studio-layout .chart-editor-panel .editor-field:has(#mapZoom){display:none!important}
      .studio-layout .chart-editor-panel h3{margin-top:14px!important;padding-top:14px;border-top:1px solid rgba(23,37,51,.08)}
      .studio-layout .editor-field textarea#stationCoords{min-height:170px!important;font-size:12px!important;background:#fbfcfd!important}
      .studio-layout .editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .studio-layout #mapApply,.studio-layout #mapReset,.studio-layout #editorApply{border-radius:6px!important;height:34px!important}
      .studio-layout #mapReset{background:#fff!important;color:#263341!important;border:1px solid rgba(23,37,51,.14)!important}
    `;
    document.head.appendChild(style);
  }
}());
