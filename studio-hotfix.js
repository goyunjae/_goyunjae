(function () {
  window.addEventListener("DOMContentLoaded", () => {
    installAllFilterFix();
    installMapGuard();
    installMapApplyOverride();
    installTextThemeFix();
    injectPanelRefresh();
  });

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

  function safeApplyMap() {
    if (!window.Plotly) return;
    const mapX = optionalNumber("#mapX", -180, 180);
    const mapY = optionalNumber("#mapY", -85, 85);
    const mapZoom = numberValue("#mapZoom", 1);
    const stations = parseStations(document.querySelector("#stationCoords")?.value || "");
    window.stationCoordinates = stations;

    document.querySelectorAll(".plot").forEach((plot) => {
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
          const station = stations[normalize(name)];
          if (!station) return;
          lat[index] = station.lat;
          lon[index] = station.lon;
          changed = true;
        });
        if (changed) {
          try { window.Plotly.restyle(plot, { lat: [lat], lon: [lon] }, [traceIndex]); } catch (_) {}
        }
      });

      const layoutUpdate = {};
      if (mapX != null && mapY != null) {
        layoutUpdate["geo.center.lon"] = mapX;
        layoutUpdate["geo.center.lat"] = mapY;
      }
      if (mapZoom !== 1) layoutUpdate["geo.projection.scale"] = mapZoom;
      if (Object.keys(layoutUpdate).length) {
        try { window.Plotly.relayout(plot, layoutUpdate); } catch (_) {}
      }
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
    document.querySelectorAll(".plot").forEach((plot) => {
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
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 3) return;
      const lat = Number(parts[1]);
      const lon = Number(parts[2]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
      result[normalize(parts[0])] = { lat, lon };
    });
    return result;
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
      .studio-layout .chart-editor-panel{padding:14px!important;gap:12px!important}
      .studio-layout .chart-editor-panel header{padding-bottom:12px;border-bottom:1px solid rgba(23,37,51,.08)}
      .studio-layout .editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .studio-layout #mapApply,.studio-layout #mapReset,.studio-layout #editorApply{border-radius:6px!important;height:34px!important}
      .studio-layout #mapReset{background:#fff!important;color:#263341!important;border:1px solid rgba(23,37,51,.14)!important}
    `;
    document.head.appendChild(style);
  }
}());
