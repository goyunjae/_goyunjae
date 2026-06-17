(function () {
  if (window.__studioFinalLoader) return;
  window.__studioFinalLoader = true;
  const src = "./studio-final.js?v=20260617-1040";
  const script = document.createElement("script");
  script.src = src;
  script.defer = true;
  document.head.appendChild(script);
  const flowSrc = "./flourish-flow.js?v=20260615-1655";
  const flow = document.createElement("script");
  flow.src = flowSrc;
  flow.defer = true;
  document.head.appendChild(flow);
  const mapSrc = "./map-polish.js?v=20260616-1235";
  const map = document.createElement("script");
  map.src = mapSrc;
  map.defer = true;
  document.head.appendChild(map);
  const mapColorSrc = "./map-color-fix.js?v=20260616-1235";
  const mapColor = document.createElement("script");
  mapColor.src = mapColorSrc;
  mapColor.defer = true;
  document.head.appendChild(mapColor);
  const treemapSrc = "./treemap-fix.js?v=20260616-1150";
  const treemap = document.createElement("script");
  treemap.src = treemapSrc;
  treemap.defer = true;
  document.head.appendChild(treemap);
  const tossSrc = "./toss-polish.js?v=20260616-1135";
  const toss = document.createElement("script");
  toss.src = tossSrc;
  toss.defer = true;
  document.head.appendChild(toss);
  const cleanupSrc = "./cleanup-polish.js?v=20260616-1135";
  const cleanup = document.createElement("script");
  cleanup.src = cleanupSrc;
  cleanup.defer = true;
  document.head.appendChild(cleanup);
  const uiDetailSrc = "./ui-detail-fix.js?v=20260617-1330";
  const uiDetail = document.createElement("script");
  uiDetail.src = uiDetailSrc;
  uiDetail.defer = true;
  document.head.appendChild(uiDetail);
}());

(function () {
  window.addEventListener("DOMContentLoaded", () => {
    const manualTable = document.querySelector("#manualTable");
    const dataSource = document.querySelector("#dataSource");
    const chartGroup = document.querySelector("#chartGroup");
    const chartGrid = document.querySelector("#chartGrid");
    if (!manualTable || !dataSource) return;

    let timer = null;

    manualTable.addEventListener("input", () => {
      if (dataSource.value !== "manual") return;
      clearTimeout(timer);
      timer = setTimeout(refreshManualCharts, 450);
    });

    if (chartGroup) {
      chartGroup.addEventListener("change", () => {
        if (dataSource.value === "manual") {
          setTimeout(refreshManualCharts, 0);
        }
      });
    }

    function refreshManualCharts() {
      if (typeof window.updateSummary !== "function" || typeof window.renderCharts !== "function") return;
      const rows = Array.from(manualTable.querySelectorAll("tbody tr")).map((tr) => (
        Array.from(tr.querySelectorAll("input")).map((input) => input.value.trim())
      ));

      try {
        const data = parseRowsToChartData(rows, "Manual input");
        window.updateSummary(data);
        if (chartGrid && chartGrid.children.length > 0) {
          window.renderCharts(data);
        }
        setStatus("Input changes applied.");
      } catch (error) {
        setStatus(error.message, true);
      }
    }
  });

  function parseRowsToChartData(rows, sheetName) {
    const nonemptyRows = rows.filter((row) => row.some(Boolean));
    if (nonemptyRows.length === 0 || Math.max(...nonemptyRows.map((row) => row.length)) < 2) {
      throw new Error(`${sheetName}: not enough data for charts.`);
    }

    const title = nonemptyRows[0][0] || "사업 성과 추이";
    const labels = nonemptyRows[0].slice(1).filter(Boolean);
    if (labels.length === 0) {
      throw new Error(`${sheetName}: enter labels from B1.`);
    }

    const series = [];
    const values = [];
    nonemptyRows.slice(1).forEach((row) => {
      const rowValues = labels.map((_, index) => toNumber(row[index + 1]));
      const hasData = rowValues.some((value) => Number.isFinite(value));
      if (!row[0] && !hasData) return;
      series.push(row[0] || `Series ${series.length + 1}`);
      values.push(rowValues.map((value) => Number.isFinite(value) ? value : 0));
    });

    if (values.length === 0) {
      throw new Error(`${sheetName}: enter names and values from A2.`);
    }

    return { sheetName, title, labels, series, values };
  }

  function toNumber(value) {
    const text = String(value ?? "").replace(/,/g, "").replace(/명|건|개|%/g, "").trim();
    const match = text.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function setStatus(message, isError = false) {
    const statusBox = document.querySelector("#status");
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.style.color = isError ? "var(--warn)" : "var(--muted)";
  }
}());
