(function () {
  if (window.__studioFinalLoader) return;
  window.__studioFinalLoader = true;
  const src = "./studio-final.js?v=20260612-1725";
  if (!Array.from(document.scripts).some((script) => script.src.includes("studio-final.js"))) {
    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    document.head.appendChild(script);
  }
  const flowSrc = "./flourish-flow.js?v=20260615-1115";
  if (!Array.from(document.scripts).some((script) => script.src.includes("flourish-flow.js"))) {
    const script = document.createElement("script");
    script.src = flowSrc;
    script.defer = true;
    document.head.appendChild(script);
  }
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

    const title = nonemptyRows[0][0] || sheetName;
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
