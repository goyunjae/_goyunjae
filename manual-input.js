(function () {
  const sampleRows = [
    ["연차평가 예시", "2024", "2025", "2026", ""],
    ["A사업", "120", "145", "170", ""],
    ["B사업", "90", "110", "132", ""],
    ["C사업", "60", "72", "95", ""],
    ["", "", "", "", ""],
  ];

  let manualRows = 5;
  let manualCols = 5;
  let lastManualData = null;

  window.addEventListener("DOMContentLoaded", () => {
    const manualTable = document.querySelector("#manualTable");
    const dataSource = document.querySelector("#dataSource");
    const generateBtn = document.querySelector("#generateBtn");
    const addRowBtn = document.querySelector("#addRowBtn");
    const addColBtn = document.querySelector("#addColBtn");
    const sampleDataBtn = document.querySelector("#sampleDataBtn");
    const fileInput = document.querySelector("#fileInput");
    const chartGroup = document.querySelector("#chartGroup");
    const clearBtn = document.querySelector("#clearBtn");

    if (!manualTable || !dataSource || !generateBtn) return;
    if (manualTable.querySelector("tbody input")) return;

    renderManualTable(sampleRows);
    dataSource.value = "manual";
    generateBtn.disabled = false;

    addRowBtn?.addEventListener("click", () => {
      const rows = getManualRows();
      rows.push(Array.from({ length: manualCols }, () => ""));
      manualRows += 1;
      renderManualTable(rows);
      dataSource.value = "manual";
    });

    addColBtn?.addEventListener("click", () => {
      const rows = getManualRows().map((row) => [...row, ""]);
      manualCols += 1;
      renderManualTable(rows);
      dataSource.value = "manual";
    });

    sampleDataBtn?.addEventListener("click", () => {
      manualRows = 5;
      manualCols = 5;
      renderManualTable(sampleRows);
      dataSource.value = "manual";
      setStatus("예시 데이터를 입력했습니다. 그래프 생성을 누르면 바로 확인할 수 있습니다.");
    });

    fileInput?.addEventListener("change", () => {
      dataSource.value = "file";
    });

    generateBtn.addEventListener("click", (event) => {
      if (dataSource.value !== "manual") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      generateManualCharts();
    }, true);

    chartGroup?.addEventListener("change", () => {
      if (dataSource.value === "manual" && lastManualData) {
        window.renderCharts(lastManualData);
      }
    });

    clearBtn?.addEventListener("click", () => {
      setTimeout(() => {
        manualRows = 5;
        manualCols = 5;
        lastManualData = null;
        renderManualTable(sampleRows);
        dataSource.value = "manual";
        generateBtn.disabled = false;
      }, 0);
    });

    function generateManualCharts() {
      try {
        lastManualData = parseRowsToChartData(getManualRows(), "직접 입력");
        window.updateSummary(lastManualData);
        window.renderCharts(lastManualData);
      } catch (error) {
        setStatus(error.message, true);
      }
    }

    function renderManualTable(rows) {
      manualRows = Math.max(rows.length, manualRows);
      manualCols = Math.max(...rows.map((row) => row.length), manualCols);
      const normalized = Array.from({ length: manualRows }, (_, rowIndex) => (
        Array.from({ length: manualCols }, (_, colIndex) => rows[rowIndex]?.[colIndex] ?? "")
      ));
      const headers = Array.from({ length: manualCols }, (_, index) => columnName(index + 1));
      manualTable.innerHTML = `
        <thead>
          <tr>
            <th></th>
            ${headers.map((name) => `<th>${name}</th>`).join("")}
          </tr>
        </thead>
        <tbody>
          ${normalized.map((row, rowIndex) => `
            <tr>
              <td>${rowIndex + 1}</td>
              ${row.map((value) => `<td><input type="text" value="${escapeHtml(value)}" /></td>`).join("")}
            </tr>
          `).join("")}
        </tbody>
      `;
    }

    function getManualRows() {
      return Array.from(manualTable.querySelectorAll("tbody tr")).map((tr) => (
        Array.from(tr.querySelectorAll("input")).map((input) => input.value.trim())
      ));
    }
  });

  function parseRowsToChartData(rows, sheetName) {
    const nonemptyRows = rows.filter((row) => row.some(Boolean));
    if (nonemptyRows.length === 0 || Math.max(...nonemptyRows.map((row) => row.length)) < 2) {
      throw new Error(`${sheetName}: 그래프를 만들 수 있는 데이터가 부족합니다.`);
    }

    const title = nonemptyRows[0][0] || sheetName;
    const labels = nonemptyRows[0].slice(1).filter(Boolean);
    if (labels.length === 0) {
      throw new Error(`${sheetName}: B1 이후에 라벨을 입력하세요.`);
    }

    const series = [];
    const values = [];
    nonemptyRows.slice(1).forEach((row) => {
      const rowValues = labels.map((_, index) => toNumber(row[index + 1]));
      const hasData = rowValues.some((value) => Number.isFinite(value));
      if (!row[0] && !hasData) return;
      series.push(row[0] || `범례${series.length + 1}`);
      values.push(rowValues.map((value) => Number.isFinite(value) ? value : 0));
    });

    if (values.length === 0) {
      throw new Error(`${sheetName}: A2 이후에 항목명과 값을 입력하세요.`);
    }

    return { sheetName, title, labels, series, values };
  }

  function toNumber(value) {
    const text = String(value ?? "").replace(/,/g, "").replace(/명|건|개|%/g, "").trim();
    const match = text.match(/-?\d+(\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function columnName(number) {
    let value = "";
    while (number > 0) {
      const mod = (number - 1) % 26;
      value = String.fromCharCode(65 + mod) + value;
      number = Math.floor((number - mod) / 26);
    }
    return value;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setStatus(message, isError = false) {
    const statusBox = document.querySelector("#status");
    if (!statusBox) return;
    statusBox.textContent = message;
    statusBox.style.color = isError ? "var(--warn)" : "var(--muted)";
  }
}());
