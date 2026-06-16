(function () {
  if (window.__studioFinalLoader) return;
  window.__studioFinalLoader = true;
  [
    "./studio-final.js?v=20260615-1445",
    "./flourish-flow.js?v=20260615-1655",
    "./map-polish.js?v=20260616-1225",
    "./treemap-fix.js?v=20260616-1150",
    "./toss-polish.js?v=20260616-1135",
    "./cleanup-polish.js?v=20260616-1135",
  ].forEach((src) => {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  });
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
    chartGroup?.addEventListener("change", () => {
      if (dataSource.value === "manual") setTimeout(refreshManualCharts, 0);
    });
    function refreshManualCharts() {
      if (typeof window.updateSummary !== "function" || typeof window.renderCharts !== "function") return;
      const rows = Array.from(manualTable.querySelectorAll("tbody tr")).map((tr) => Array.from(tr.querySelectorAll("input")).map((input) => input.value.trim()));
      try {
        const data = parseRowsToChartData(rows, "Manual input");
        window.updateSummary(data);
        if (chartGrid && chartGrid.children.length > 0) window.renderCharts(data);
        setStatus("Input changes applied.");
      } catch (error) {
        setStatus(error.message, true);
      }
    }
  });
  function parseRowsToChartData(rows, sheetName) {
    const nonemptyRows = rows.filter((row) => row.some(Boolean));
    if (!nonemptyRows.length || Math.max(...nonemptyRows.map((row) => row.length)) < 2) throw new Error(`${sheetName}: not enough data for charts.`);
    const title = nonemptyRows[0][0] || "사업 성과 추이";
    const labels = nonemptyRows[0].slice(1).filter(Boolean);
    if (!labels.length) throw new Error(`${sheetName}: enter labels from B1.`);
    const series = [];
    const values = [];
    nonemptyRows.slice(1).forEach((row) => {
      const rowValues = labels.map((_, index) => toNumber(row[index + 1]));
      if (!row[0] && !rowValues.some((value) => Number.isFinite(value))) return;
      series.push(row[0] || `Series ${series.length + 1}`);
      values.push(rowValues.map((value) => Number.isFinite(value) ? value : 0));
    });
    if (!values.length) throw new Error(`${sheetName}: enter names and values from A2.`);
    return { sheetName, title, labels, series, values };
  }
  function toNumber(value) {
    const match = String(value ?? "").replace(/,/g, "").replace(/[명건개%]/g, "").trim().match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }
  function setStatus(message, isError = false) {
    const statusBox = document.querySelector("#status");
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.style.color = isError ? "var(--warn)" : "var(--muted)";
  }
}());
