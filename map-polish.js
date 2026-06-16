(function () {
  const VERSION = "20260616-1145";
  let applyTimer = null;

  ready(start);

  function ready(fn) {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn);
    else fn();
  }

  function start() {
    document.body.classList.add("map-polished");
    installGeoErrorGuard();
    style();
    installEvents();
    observeCharts();
    delayedRefresh();
  }

  function installGeoErrorGuard() {
    if (window.__mapPolishGeoGuard === VERSION) return;
    window.__mapPolishGeoGuard = VERSION;
    window.addEventListener("unhandledrejection", (event) => {
      const message = String(event.reason?.message || event.reason || "");
      if (message.includes("reading 'objects'")) event.preventDefault();
    });
  }

  function installEvents() {
    window.addEventListener("click", (event) => {
      const apply = event.target.closest?.("#applyStationCoords");
      const reset = event.target.closest?.("#resetStationCoords");
      if (apply || reset) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (apply) applyStationEditor(true);
        if (reset) resetStationEditor();
        return;
      }
      if (event.target.closest?.(".chart-card,.studio-tab[data-view='preview']")) {
        setTimeout(syncMapEditor, 180);
        setTimeout(enhanceAllMaps, 240);
      }
    }, true);

    window.addEventListener("input", (event) => {
      if (!event.target.matches?.(".final-editor-panel #stationCoords")) return;
      event.stopImmediatePropagation();
      event.target.dataset.userEdited = "true";
      clearTimeout(applyTimer);
      applyTimer = setTimeout(() => applyStationEditor(false), 260);
    }, true);

    window.addEventListener("change", (event) => {
      if (!event.target.matches?.(".final-editor-panel #stationCoords")) return;
      event.stopImmediatePropagation();
      applyStationEditor(true);
    }, true);
  }

  function observeCharts() {
    const grid = document.querySelector("#chartGrid");
    if (!grid || grid.dataset.mapPolishObserver === VERSION) return;
    grid.dataset.mapPolishObserver = VERSION;
    new MutationObserver(delayedRefresh).observe(grid, { childList: true });
  }

  function delayedRefresh() {
    [80, 240, 700].forEach((delay) => setTimeout(() => {
      enhanceAllMaps();
      syncMapEditor();
    }, delay));
  }

  function enhanceAllMaps() {
    document.querySelectorAll(".plot").forEach((plot) => enhanceMap(plot));
  }

  function enhanceMap(plot, fit = true) {
    if (!plot || !window.Plotly || !Array.isArray(plot.data)) return;
    const hasGeo = plot.data.some((trace) => trace.type === "scattergeo" || trace.type === "choropleth");
    if (!hasGeo) return;

    const coords = collectCoords(plot);
    const signature = VERSION + ":" + coords.map((item) => `${item.lat.toFixed(4)},${item.lon.toFixed(4)}`).join("|");
    if (fit && plot.dataset.mapPolishSignature === signature) return;
    plot.dataset.mapPolishSignature = signature;

    plot.data.forEach((trace, index) => {
      if (trace.type !== "scattergeo") return;
      ensureBaseCoords(plot, trace, index);
      const names = traceNames(trace);
      const marker = {
        ...(trace.marker || {}),
        opacity: trace.marker?.opacity ?? 0.86,
        line: { color: "#ffffff", width: 2 },
      };
      if (!Array.isArray(marker.color)) marker.color = palette(index);
      const update = {
        marker: [marker],
        text: [names],
        textposition: ["top center"],
        textfont: [{ color: "#1f2937", size: 11, family: "Malgun Gothic, Arial, sans-serif" }],
        hoverinfo: ["text"],
      };
      try { safePlotly(Plotly.restyle(plot, update, [index])); } catch (_) {}
    });

    const geo = {
      scope: "world",
      projection: { type: "mercator" },
      showframe: false,
      showland: true,
      landcolor: "#e7edf2",
      showcountries: true,
      countrycolor: "#ffffff",
      countrywidth: 1.1,
      showcoastlines: true,
      coastlinecolor: "#c9d6df",
      coastlinewidth: 0.9,
      showocean: true,
      oceancolor: "#f8fbfd",
      showlakes: true,
      lakecolor: "#ffffff",
      bgcolor: "#ffffff",
      lataxis: { showgrid: false },
      lonaxis: { showgrid: false },
    };
    if (fit && coords.length) {
      geo.lataxis.range = range(coords.map((item) => item.lat), 5, -85, 85);
      geo.lonaxis.range = range(coords.map((item) => item.lon), 8, -180, 180);
    }
    try {
      safePlotly(Plotly.relayout(plot, {
        geo,
        margin: { ...(plot.layout?.margin || {}), l: 8, r: 8, b: 8 },
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
      }));
    } catch (_) {}
  }

  function safePlotly(result) {
    if (result && typeof result.catch === "function") result.catch(() => {});
  }

  function syncMapEditor() {
    const plot = selectedGeoPlot();
    const box = document.querySelector(".final-editor-panel #stationCoords");
    if (!plot || !box) return;
    ensureMapActions(box);
    if (document.activeElement !== box && box.dataset.userEdited !== "true") {
      box.value = stationRows(plot);
    }
    box.placeholder = "Station, latitude, longitude\nStation, x(lon), y(lat) also works";
    const note = box.closest(".editor-accordion")?.querySelector(".tool-note");
    if (note) note.textContent = "Edit station bubble coordinates. You can paste name, latitude, longitude or name, x(lon), y(lat).";
  }

  function ensureMapActions(box) {
    if (box.closest(".accordion-body")?.querySelector(".map-editor-actions")) return;
    box.closest(".editor-field")?.insertAdjacentHTML("afterend", [
      '<div class="map-editor-actions">',
      '<button type="button" id="applyStationCoords">Apply coordinates</button>',
      '<button type="button" id="resetStationCoords">Reset bubbles</button>',
      "</div>",
    ].join(""));
  }

  function applyStationEditor(fit) {
    const plot = selectedGeoPlot();
    const box = document.querySelector(".final-editor-panel #stationCoords");
    if (!plot || !box) return;
    const parsed = parseStationRows(box.value);
    if (!parsed.rows.length) return;
    plot.data.forEach((trace, traceIndex) => {
      if (trace.type !== "scattergeo") return;
      ensureBaseCoords(plot, trace, traceIndex);
      const names = traceNames(trace);
      const lat = Array.from(trace.lat || []);
      const lon = Array.from(trace.lon || []);
      names.forEach((name, pointIndex) => {
        const found = parsed.byName[norm(name)] || parsed.rows[pointIndex];
        if (!found) return;
        lat[pointIndex] = found.lat;
        lon[pointIndex] = found.lon;
      });
      try { Plotly.restyle(plot, { lat: [lat], lon: [lon] }, [traceIndex]); } catch (_) {}
    });
    setTimeout(() => {
      enhanceMap(plot, fit);
      box.dataset.userEdited = "false";
      box.value = stationRows(plot);
    }, 80);
  }

  function resetStationEditor() {
    const plot = selectedGeoPlot();
    const box = document.querySelector(".final-editor-panel #stationCoords");
    if (!plot || !plot.__mapPolishBase) return;
    plot.__mapPolishBase.forEach((base) => {
      try { Plotly.restyle(plot, { lat: [base.lat], lon: [base.lon] }, [base.index]); } catch (_) {}
    });
    setTimeout(() => {
      enhanceMap(plot, true);
      if (box) {
        box.dataset.userEdited = "false";
        box.value = stationRows(plot);
      }
    }, 80);
  }

  function selectedGeoPlot() {
    const card = document.querySelector(".chart-card.is-selected") || document.querySelector(".chart-card");
    const plot = card?.querySelector(".plot");
    return plot?.data?.some((trace) => trace.type === "scattergeo") ? plot : null;
  }

  function ensureBaseCoords(plot, trace, index) {
    if (!plot.__mapPolishBase) plot.__mapPolishBase = [];
    if (plot.__mapPolishBase.some((item) => item.index === index)) return;
    plot.__mapPolishBase.push({
      index,
      lat: Array.from(trace.lat || []),
      lon: Array.from(trace.lon || []),
    });
  }

  function collectCoords(plot) {
    const coords = [];
    plot.data.forEach((trace) => {
      if (trace.type !== "scattergeo") return;
      Array.from(trace.lat || []).forEach((lat, index) => {
        const lon = Number(trace.lon?.[index]);
        const y = Number(lat);
        if (Number.isFinite(y) && Number.isFinite(lon)) coords.push({ lat: y, lon });
      });
    });
    return coords;
  }

  function stationRows(plot) {
    const trace = plot.data.find((item) => item.type === "scattergeo");
    if (!trace) return "";
    const names = traceNames(trace);
    return Array.from(trace.lat || []).map((lat, index) => {
      const lon = Number(trace.lon?.[index]);
      const safeName = names[index] || `Station ${index + 1}`;
      if (!Number.isFinite(Number(lat)) || !Number.isFinite(lon)) return null;
      return `${safeName},${Number(lat).toFixed(4)},${lon.toFixed(4)}`;
    }).filter(Boolean).join("\n");
  }

  function traceNames(trace) {
    const source = Array.from(trace.hovertext || trace.text || trace.locations || []);
    return source.map((value, index) => {
      const text = String(value || "").split("<br>")[0].split(":")[0].trim();
      return text || `Station ${index + 1}`;
    });
  }

  function parseStationRows(text) {
    const rows = [];
    const byName = {};
    text.split(/\r?\n/).forEach((line) => {
      const parts = line.split(",").map((part) => part.trim()).filter(Boolean);
      if (parts.length < 2) return;
      const hasName = parts.length >= 3;
      const name = hasName ? parts[0] : "";
      const first = Number(hasName ? parts[1] : parts[0]);
      const second = Number(hasName ? parts[2] : parts[1]);
      const coord = normalizeCoord(first, second);
      if (!coord) return;
      const row = { name, lat: coord.lat, lon: coord.lon };
      rows.push(row);
      if (name) byName[norm(name)] = row;
    });
    return { rows, byName };
  }

  function normalizeCoord(first, second) {
    if (!Number.isFinite(first) || !Number.isFinite(second)) return null;
    let lat = first;
    let lon = second;
    if (Math.abs(first) > 90 && Math.abs(second) <= 90) {
      lat = second;
      lon = first;
    }
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
  }

  function range(values, minimumSpan, minLimit, maxLimit) {
    const finite = values.map(Number).filter(Number.isFinite);
    if (!finite.length) return [minLimit, maxLimit];
    let min = Math.min(...finite);
    let max = Math.max(...finite);
    const center = (min + max) / 2;
    const span = Math.max(max - min, minimumSpan);
    min = center - span * 0.72;
    max = center + span * 0.72;
    return [Math.max(minLimit, min), Math.min(maxLimit, max)];
  }

  function palette(index) {
    const colors = ["#1ba6a6", "#67d4c0", "#2374ab", "#234a7d", "#f2b75e"];
    return colors[index % colors.length];
  }

  function norm(value) {
    return String(value || "").trim().toLowerCase();
  }

  function style() {
    if (document.querySelector("#map-polish-style")) return;
    const style = document.createElement("style");
    style.id = "map-polish-style";
    style.textContent = `
      .map-polished .modebar{opacity:0;pointer-events:none}
      .map-polished .map-editor-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .map-polished .map-editor-actions button{min-height:34px;border-radius:6px;border:1px solid rgba(15,23,42,.14);font-size:12px;font-weight:850;cursor:pointer}
      .map-polished #applyStationCoords{background:#2f6cea;color:#fff;border-color:#2f6cea}
      .map-polished #resetStationCoords{background:#fff;color:#263341}
    `;
    document.head.appendChild(style);
  }
}());
