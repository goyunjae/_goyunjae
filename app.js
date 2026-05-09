const PALETTE = [
  "#274C77", "#6096BA", "#A3CEF1", "#8B8C89",
  "#D9A441", "#A44A3F", "#587B7F", "#6A4C93",
  "#2A9D8F", "#E76F51", "#264653", "#B56576",
];

const HEAT_COLORS = [
  [0, "#F7FBFF"],
  [0.35, "#D6E6F2"],
  [0.70, "#7AA6C2"],
  [1, "#274C77"],
];

let workbook = null;
let currentData = null;
let renderedCharts = [];

const fileInput = document.querySelector("#fileInput");
const fileName = document.querySelector("#fileName");
const sheetSelect = document.querySelector("#sheetSelect");
const chartGroup = document.querySelector("#chartGroup");
const exportFormat = document.querySelector("#exportFormat");
const dpiInput = document.querySelector("#dpiInput");
const generateBtn = document.querySelector("#generateBtn");
const clearBtn = document.querySelector("#clearBtn");
const downloadAllBtn = document.querySelector("#downloadAllBtn");
const selectAllBtn = document.querySelector("#selectAllBtn");
const statusBox = document.querySelector("#status");
const chartGrid = document.querySelector("#chartGrid");
const emptyState = document.querySelector("#emptyState");
const summary = document.querySelector("#summary");
const reportTitle = document.querySelector("#reportTitle");
const reportMeta = document.querySelector("#reportMeta");

const baseLayout = {
  paper_bgcolor: "#ffffff",
  plot_bgcolor: "#ffffff",
  font: { family: "Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Arial", color: "#1c2430" },
  margin: { l: 58, r: 26, t: 58, b: 58 },
  colorway: PALETTE,
  legend: { orientation: "h", y: -0.22, x: 0, font: { size: 10 } },
};

const baseConfig = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ["lasso2d", "select2d"],
};

fileInput.addEventListener("change", handleFile);
generateBtn.addEventListener("click", generateSelected);
clearBtn.addEventListener("click", resetApp);
downloadAllBtn.addEventListener("click", downloadAll);
selectAllBtn.addEventListener("click", toggleSelectAll);
sheetSelect.addEventListener("change", () => {
  if (workbook) generateSelected();
});
chartGroup.addEventListener("change", () => {
  if (currentData) renderCharts(currentData);
});

async function handleFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  setStatus("파일을 읽는 중입니다.");
  fileName.textContent = file.name;

  try {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: "array" });
    sheetSelect.innerHTML = "";
    workbook.SheetNames.forEach((name) => {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      sheetSelect.appendChild(option);
    });
    sheetSelect.disabled = false;
    generateBtn.disabled = false;
    generateSelected();
  } catch (error) {
    setStatus(`파일을 읽지 못했습니다: ${error.message}`, true);
  }
}

function generateSelected() {
  if (!workbook) return;
  const sheetName = sheetSelect.value || workbook.SheetNames[0];
  try {
    currentData = readChartSheet(workbook, sheetName);
    updateSummary(currentData);
    renderCharts(currentData);
  } catch (error) {
    setStatus(error.message, true);
  }
}

function readChartSheet(book, sheetName) {
  const sheet = book.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" })
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some(Boolean));

  if (rows.length === 0 || Math.max(...rows.map((row) => row.length)) < 2) {
    throw new Error(`${sheetName}: 그래프를 만들 수 있는 데이터가 부족합니다.`);
  }

  const title = rows[0][0] || sheetName;
  const row0LabelCount = rows[0].slice(1).filter(Boolean).length;
  const row1LabelCount = rows[1] ? rows[1].slice(1).filter(Boolean).length : 0;
  let labelRow = 0;
  let dataStartRow = 1;

  if (row0LabelCount === 0 && row1LabelCount > 0) {
    labelRow = 1;
    dataStartRow = 2;
  } else if (row0LabelCount === 0) {
    throw new Error(`${sheetName}: B열 이후에서 라벨 행을 찾지 못했습니다.`);
  }

  const labelIndexes = [];
  rows[labelRow].forEach((value, index) => {
    if (index > 0 && value) labelIndexes.push(index);
  });
  const labels = labelIndexes.map((index) => rows[labelRow][index]);

  const series = [];
  const values = [];
  rows.slice(dataStartRow).forEach((row) => {
    const rowValues = labelIndexes.map((index) => toNumber(row[index]));
    const hasData = rowValues.some((value) => Number.isFinite(value));
    if (!row[0] && !hasData) return;
    series.push(row[0] || `범례${series.length + 1}`);
    values.push(rowValues.map((value) => Number.isFinite(value) ? value : 0));
  });

  if (values.length === 0) {
    throw new Error(`${sheetName}: 값 데이터가 없습니다.`);
  }

  return { sheetName, title, labels, series, values };
}

function toNumber(value) {
  const text = String(value ?? "").replace(/,/g, "").replace(/명|건|개|%/g, "").trim();
  const match = text.match(/-?\d+(\.\d+)?/);
  return match ? Number(match[0]) : NaN;
}

function updateSummary(data) {
  const flat = data.values.flat();
  const total = flat.reduce((sum, value) => sum + value, 0);
  const cards = [
    ["시트", data.sheetName],
    ["항목", `${data.series.length}개`],
    ["라벨", `${data.labels.length}개`],
    ["합계", formatNumber(total)],
  ];
  summary.innerHTML = cards.map(([label, value]) => `
    <article class="summary-card"><span>${label}</span><strong>${escapeHtml(value)}</strong></article>
  `).join("");
  reportTitle.textContent = data.title;
  reportMeta.textContent = `${data.sheetName} · ${data.series.length}개 항목 · ${data.labels.length}개 라벨`;
}

function renderCharts(data) {
  chartGrid.innerHTML = "";
  renderedCharts = [];
  emptyState.classList.add("hidden");

  const selected = chartGroup.value;
  const specs = chartSpecs().filter((spec) => selected === "ALL" || spec.group === selected);

  specs.forEach((spec) => {
    const card = document.createElement("article");
    card.className = "chart-card";
    const checkboxId = `chart-select-${spec.group}-${spec.number}`;
    card.innerHTML = `
      <div class="chart-card-header">
        <label class="chart-title-control" for="${checkboxId}">
          <input id="${checkboxId}" class="chart-select" type="checkbox" checked />
          <h3>${spec.group} ${String(spec.number).padStart(2, "0")} · ${spec.label}</h3>
        </label>
        <button type="button" class="secondary">저장</button>
      </div>
      <div class="plot"></div>
    `;
    chartGrid.appendChild(card);

    const plot = card.querySelector(".plot");
    const button = card.querySelector("button");
    const checkbox = card.querySelector(".chart-select");
    const chart = spec.build(data);
    const layout = mergeLayout(chart.layout, `${data.title}<br>${spec.group} ${String(spec.number).padStart(2, "0")} · ${spec.label}`);
    Plotly.newPlot(plot, chart.traces, layout, baseConfig);

    const chartRecord = { plot, data, spec, checkbox };
    renderedCharts.push(chartRecord);
    button.addEventListener("click", () => downloadChart(chartRecord));
    checkbox.addEventListener("change", updateDownloadButtons);
  });

  updateDownloadButtons();
  setStatus(`${data.sheetName}에서 그래프 ${renderedCharts.length}개를 생성했습니다.`);
}

function chartSpecs() {
  return [
    spec("BAR", 1, "그룹 막대", groupedBar),
    spec("BAR", 2, "누적 막대", stackedBar),
    spec("BAR", 3, "가로 순위 막대", horizontalRankBar),
    spec("BAR", 4, "플로팅 컬럼", floatingColumn),
    spec("LINE", 1, "기본 추이", basicLine),
    spec("LINE", 2, "부드러운 추이", smoothLine),
    spec("LINE", 3, "계단형 추이", stepLine),
    spec("LINE", 4, "슬로프 차트", slopeChart),
    spec("AREA", 1, "기본 면적", basicArea),
    spec("AREA", 2, "누적 면적", stackedArea),
    spec("AREA", 3, "스트림 면적", streamArea),
    spec("AREA", 4, "100% 누적 면적", percentArea),
    spec("SCATTER", 1, "기본 산점", basicScatter),
    spec("SCATTER", 2, "버블 산점", bubbleScatter),
    spec("SCATTER", 3, "연결 산점", connectedScatter),
    spec("SCATTER", 4, "사분면 산점", quadrantScatter),
    spec("PIE", 1, "기본 파이", basicPie),
    spec("PIE", 2, "도넛", donutPie),
    spec("PIE", 3, "중첩 도넛", nestedDonut),
    spec("PIE", 4, "로즈 파이", rosePie),
    spec("HEATMAP", 1, "매트릭스", matrixHeatmap),
    spec("HEATMAP", 2, "주석 매트릭스", annotatedHeatmap),
    spec("HEATMAP", 3, "1차원 히트맵", oneDimensionalHeatmap),
    spec("HEATMAP", 4, "정규화 히트맵", normalizedHeatmap),
    spec("RANGE", 1, "항목별 최소·최대", seriesRange),
    spec("RANGE", 2, "처음·마지막 비교", firstLastRange),
    spec("RANGE", 3, "라벨별 최소·최대", labelRange),
    spec("RANGE", 4, "범위 밴드", rangeBand),
    spec("ICON", 1, "행성형 심볼", solarSymbols),
    spec("ICON", 2, "비례 심볼", proportionalSymbols),
    spec("ICON", 3, "와플", waffleChart),
    spec("ICON", 4, "반원 방사형", radialChart),
    spec("TREEMAP", 1, "항목 트리맵", seriesTreemap),
    spec("TREEMAP", 2, "라벨 트리맵", labelTreemap),
    spec("TREEMAP", 3, "셀 트리맵", cellTreemap),
    spec("TREEMAP", 4, "상위 항목", topTreemap),
    spec("DOT", 1, "항목 점 순위", seriesDot),
    spec("DOT", 2, "점 매트릭스", dotMatrix),
    spec("DOT", 3, "덤벨", dumbbellDot),
    spec("DOT", 4, "라벨 점 순위", labelDot),
  ];
}

function spec(group, number, label, build) {
  return { group, number, label, build };
}

function groupedBar(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "bar", x: data.labels, y: data.values[i], name, marker: { color: color(i) } })),
    layout: { barmode: "group", yaxis: { title: "값" } },
  };
}

function stackedBar(data) {
  const chart = groupedBar(data);
  chart.layout.barmode = "stack";
  return chart;
}

function horizontalRankBar(data) {
  const totals = seriesTotals(data).sort((a, b) => a.value - b.value);
  return {
    traces: [{ type: "bar", orientation: "h", x: totals.map((d) => d.value), y: totals.map((d) => d.name), marker: { color: totals.map((_, i) => color(i)) } }],
    layout: { xaxis: { title: "합계" }, margin: { l: 110 } },
  };
}

function floatingColumn(data) {
  const totals = labelTotals(data);
  const min = Math.min(...totals.map((d) => d.value), 0);
  const base = min > 0 ? min * 0.85 : 0;
  return {
    traces: [{ type: "bar", x: totals.map((d) => d.name), y: totals.map((d) => d.value - base), base, marker: { color: totals.map((_, i) => color(i)) } }],
    layout: { yaxis: { title: "값" } },
  };
}

function basicLine(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "lines+markers", x: data.labels, y: data.values[i], name, line: { color: color(i), width: 2 } })),
    layout: { yaxis: { title: "값" } },
  };
}

function smoothLine(data) {
  const chart = basicLine(data);
  chart.traces.forEach((trace) => { trace.line.shape = "spline"; });
  return chart;
}

function stepLine(data) {
  const chart = basicLine(data);
  chart.traces.forEach((trace) => { trace.line.shape = "hv"; });
  return chart;
}

function slopeChart(data) {
  const first = data.labels[0];
  const last = data.labels[data.labels.length - 1];
  return {
    traces: data.series.map((name, i) => ({
      type: "scatter",
      mode: "lines+markers+text",
      x: [first, last],
      y: [data.values[i][0], data.values[i][data.labels.length - 1]],
      text: [name, formatNumber(data.values[i][data.labels.length - 1])],
      textposition: ["middle left", "middle right"],
      name,
      line: { color: color(i), width: 2 },
    })),
    layout: { showlegend: false, yaxis: { title: "값" } },
  };
}

function basicArea(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "lines", fill: "tozeroy", x: data.labels, y: data.values[i], name, line: { color: color(i), width: 2 }, opacity: 0.55 })),
    layout: { yaxis: { title: "값" } },
  };
}

function stackedArea(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "lines", stackgroup: "one", x: data.labels, y: data.values[i], name, line: { color: color(i) } })),
    layout: { yaxis: { title: "값" } },
  };
}

function streamArea(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "lines", stackgroup: "one", groupnorm: "", x: data.labels, y: data.values[i], name, line: { color: color(i), shape: "spline" } })),
    layout: { yaxis: { title: "값" } },
  };
}

function percentArea(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "lines", stackgroup: "one", groupnorm: "percent", x: data.labels, y: data.values[i], name, line: { color: color(i) } })),
    layout: { yaxis: { title: "비율(%)", range: [0, 100] } },
  };
}

function basicScatter(data) {
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "markers", x: data.labels, y: data.values[i], name, marker: { color: color(i), size: 10 } })),
    layout: { yaxis: { title: "값" } },
  };
}

function bubbleScatter(data) {
  const max = safeMax(data.values.flat());
  return {
    traces: data.series.map((name, i) => ({ type: "scatter", mode: "markers", x: data.labels, y: data.values[i], name, marker: { color: color(i), size: data.values[i].map((v) => 8 + Math.max(v, 0) / max * 34), opacity: 0.62, line: { color: "white", width: 1 } } })),
    layout: { yaxis: { title: "값" } },
  };
}

function connectedScatter(data) {
  const chart = basicScatter(data);
  chart.traces.forEach((trace) => { trace.mode = "lines+markers"; });
  return chart;
}

function quadrantScatter(data) {
  const points = cells(data);
  const xs = points.map((p) => p.labelIndex + 1);
  const ys = points.map((p) => p.value);
  const xMid = (Math.min(...xs) + Math.max(...xs)) / 2;
  const yMid = (Math.min(...ys) + Math.max(...ys)) / 2;
  return {
    traces: [{
      type: "scatter",
      mode: "markers+text",
      x: xs,
      y: ys,
      text: points.map((p) => p.series),
      textposition: "top center",
      marker: { color: points.map((p) => color(p.seriesIndex)), size: 10 },
    }],
    layout: {
      xaxis: { title: "라벨 순서", zeroline: false },
      yaxis: { title: "값" },
      shapes: [
        { type: "line", x0: xMid, x1: xMid, y0: Math.min(...ys), y1: Math.max(...ys), line: { color: "#8B8C89", dash: "dot" } },
        { type: "line", x0: Math.min(...xs), x1: Math.max(...xs), y0: yMid, y1: yMid, line: { color: "#8B8C89", dash: "dot" } },
      ],
    },
  };
}

function basicPie(data) {
  const totals = seriesTotals(data);
  return {
    traces: [{ type: "pie", labels: totals.map((d) => d.name), values: totals.map((d) => d.value), marker: { colors: totals.map((_, i) => color(i)) } }],
    layout: {},
  };
}

function donutPie(data) {
  const chart = basicPie(data);
  chart.traces[0].hole = 0.48;
  return chart;
}

function nestedDonut(data) {
  const series = seriesTotals(data);
  const labels = labelTotals(data);
  return {
    traces: [
      { type: "pie", labels: series.map((d) => d.name), values: series.map((d) => d.value), hole: 0.58, domain: { x: [0, 1], y: [0, 1] }, textinfo: "label+percent", marker: { colors: series.map((_, i) => color(i)) } },
      { type: "pie", labels: labels.map((d) => d.name), values: labels.map((d) => d.value), hole: 0.78, domain: { x: [0.16, 0.84], y: [0.16, 0.84] }, textinfo: "none", marker: { colors: labels.map((_, i) => color(i + 4)) }, showlegend: false },
    ],
    layout: {},
  };
}

function rosePie(data) {
  const totals = seriesTotals(data);
  return {
    traces: [{ type: "barpolar", r: totals.map((d) => d.value), theta: totals.map((_, i) => i * 360 / totals.length), width: 360 / totals.length * 0.82, text: totals.map((d) => d.name), marker: { color: totals.map((_, i) => color(i)), opacity: 0.82 } }],
    layout: { polar: { radialaxis: { visible: true } }, showlegend: false },
  };
}

function matrixHeatmap(data) {
  return {
    traces: [{ type: "heatmap", x: data.labels, y: data.series, z: data.values, colorscale: HEAT_COLORS }],
    layout: { margin: { l: 110, b: 70 } },
  };
}

function annotatedHeatmap(data) {
  const chart = matrixHeatmap(data);
  chart.traces[0].text = data.values.map((row) => row.map(formatNumber));
  chart.traces[0].texttemplate = "%{text}";
  chart.traces[0].textfont = { color: "#1c2430", size: 11 };
  return chart;
}

function oneDimensionalHeatmap(data) {
  const totals = labelTotals(data);
  return {
    traces: [{ type: "heatmap", x: totals.map((d) => d.name), y: ["합계"], z: [totals.map((d) => d.value)], text: [totals.map((d) => formatNumber(d.value))], texttemplate: "%{text}", colorscale: HEAT_COLORS }],
    layout: { margin: { l: 70, b: 70 } },
  };
}

function normalizedHeatmap(data) {
  const max = safeMax(data.values.flat());
  return {
    traces: [{ type: "heatmap", x: data.labels, y: data.series, z: data.values.map((row) => row.map((v) => v / max * 100)), colorscale: HEAT_COLORS, colorbar: { title: "%" } }],
    layout: { margin: { l: 110, b: 70 } },
  };
}

function seriesRange(data) {
  const traces = data.series.map((name, i) => {
    const row = data.values[i];
    return { type: "scatter", mode: "lines+markers", x: [Math.min(...row), Math.max(...row)], y: [name, name], name, line: { color: color(i), width: 5 } };
  });
  return { traces, layout: { xaxis: { title: "최소·최대" }, margin: { l: 110 } } };
}

function firstLastRange(data) {
  const first = data.labels[0];
  const last = data.labels[data.labels.length - 1];
  return {
    traces: [
      { type: "scatter", mode: "markers", x: data.values.map((row) => row[0]), y: data.series, name: first, marker: { color: color(0), size: 11 } },
      { type: "scatter", mode: "markers", x: data.values.map((row) => row[data.labels.length - 1]), y: data.series, name: last, marker: { color: color(1), size: 11 } },
    ],
    layout: { xaxis: { title: "값" }, margin: { l: 110 } },
  };
}

function labelRange(data) {
  const traces = data.labels.map((label, i) => {
    const column = data.values.map((row) => row[i]);
    return { type: "scatter", mode: "lines+markers", x: [Math.min(...column), Math.max(...column)], y: [label, label], name: label, line: { color: color(i), width: 5 } };
  });
  return { traces, layout: { xaxis: { title: "최소·최대" }, margin: { l: 110 } } };
}

function rangeBand(data) {
  const min = data.labels.map((_, i) => Math.min(...data.values.map((row) => row[i])));
  const max = data.labels.map((_, i) => Math.max(...data.values.map((row) => row[i])));
  return {
    traces: [
      { type: "scatter", mode: "lines", x: data.labels, y: min, name: "최소", line: { color: "#A3CEF1" } },
      { type: "scatter", mode: "lines", x: data.labels, y: max, name: "최대", fill: "tonexty", line: { color: "#274C77" } },
    ],
    layout: { yaxis: { title: "값" } },
  };
}

function solarSymbols(data) {
  const totals = seriesTotals(data);
  const max = safeMax(totals.map((d) => d.value));
  return {
    traces: [{ type: "scatter", mode: "markers+text", x: totals.map((_, i) => i + 1), y: totals.map(() => 1), text: totals.map((d) => d.name), textposition: "bottom center", marker: { size: totals.map((d) => 18 + d.value / max * 52), color: totals.map((_, i) => color(i)), opacity: 0.85 } }],
    layout: { xaxis: { visible: false }, yaxis: { visible: false }, showlegend: false },
  };
}

function proportionalSymbols(data) {
  const points = cells(data).filter((p) => p.value > 0);
  const max = safeMax(points.map((p) => p.value));
  return {
    traces: [{ type: "scatter", mode: "markers", x: points.map((p) => p.label), y: points.map((p) => p.series), marker: { size: points.map((p) => 8 + p.value / max * 38), color: points.map((p) => color(p.seriesIndex)), opacity: 0.72, line: { color: "white", width: 1 } } }],
    layout: { margin: { l: 110, b: 70 } },
  };
}

function waffleChart(data) {
  const totals = seriesTotals(data);
  const total = totals.reduce((sum, d) => sum + d.value, 0) || 1;
  const blocks = [];
  totals.forEach((item, i) => {
    const count = Math.round(item.value / total * 100);
    for (let j = 0; j < count; j += 1) blocks.push({ name: item.name, color: color(i) });
  });
  while (blocks.length < 100) blocks.push({ name: "기타", color: "#E7ECEF" });
  return {
    traces: [{ type: "scatter", mode: "markers", x: blocks.slice(0, 100).map((_, i) => i % 10), y: blocks.slice(0, 100).map((_, i) => 9 - Math.floor(i / 10)), text: blocks.slice(0, 100).map((b) => b.name), marker: { symbol: "square", size: 24, color: blocks.slice(0, 100).map((b) => b.color) } }],
    layout: { xaxis: { visible: false }, yaxis: { visible: false, scaleanchor: "x" }, showlegend: false },
  };
}

function radialChart(data) {
  const totals = seriesTotals(data);
  return {
    traces: [{ type: "pie", labels: totals.map((d) => d.name), values: totals.map((d) => d.value), hole: 0.48, rotation: 90, direction: "clockwise", marker: { colors: totals.map((_, i) => color(i)) } }],
    layout: {},
  };
}

function seriesTreemap(data) {
  const totals = seriesTotals(data);
  return { traces: [{ type: "treemap", labels: totals.map((d) => d.name), parents: totals.map(() => ""), values: totals.map((d) => d.value), marker: { colors: totals.map((_, i) => color(i)) } }], layout: {} };
}

function labelTreemap(data) {
  const totals = labelTotals(data);
  return { traces: [{ type: "treemap", labels: totals.map((d) => d.name), parents: totals.map(() => ""), values: totals.map((d) => d.value), marker: { colors: totals.map((_, i) => color(i)) } }], layout: {} };
}

function cellTreemap(data) {
  const points = cells(data).filter((p) => p.value > 0);
  return { traces: [{ type: "treemap", labels: points.map((p) => `${p.series}-${p.label}`), parents: points.map((p) => p.series), values: points.map((p) => p.value) }], layout: {} };
}

function topTreemap(data) {
  const totals = seriesTotals(data).sort((a, b) => b.value - a.value);
  const top = totals.slice(0, 8);
  const etc = totals.slice(8).reduce((sum, d) => sum + d.value, 0);
  if (etc > 0) top.push({ name: "기타", value: etc });
  return { traces: [{ type: "treemap", labels: top.map((d) => d.name), parents: top.map(() => ""), values: top.map((d) => d.value), marker: { colors: top.map((_, i) => color(i)) } }], layout: {} };
}

function seriesDot(data) {
  const totals = seriesTotals(data).sort((a, b) => a.value - b.value);
  return { traces: [{ type: "scatter", mode: "markers", x: totals.map((d) => d.value), y: totals.map((d) => d.name), marker: { size: 12, color: totals.map((_, i) => color(i)) } }], layout: { xaxis: { title: "합계" }, margin: { l: 110 }, showlegend: false } };
}

function dotMatrix(data) {
  return proportionalSymbols(data);
}

function dumbbellDot(data) {
  return firstLastRange(data);
}

function labelDot(data) {
  const totals = labelTotals(data).sort((a, b) => a.value - b.value);
  return { traces: [{ type: "scatter", mode: "markers+text", x: totals.map((d) => d.value), y: totals.map((d) => d.name), text: totals.map((d) => formatNumber(d.value)), textposition: "middle right", marker: { size: 12, color: totals.map((_, i) => color(i)) } }], layout: { xaxis: { title: "합계" }, margin: { l: 110 }, showlegend: false } };
}

function mergeLayout(layout, title) {
  return {
    ...baseLayout,
    ...layout,
    title: { text: title, x: 0.02, xanchor: "left", font: { size: 15 } },
    margin: { ...baseLayout.margin, ...(layout.margin || {}) },
  };
}

function seriesTotals(data) {
  return data.series.map((name, i) => ({ name, value: data.values[i].reduce((sum, value) => sum + value, 0) }));
}

function labelTotals(data) {
  return data.labels.map((name, i) => ({ name, value: data.values.reduce((sum, row) => sum + row[i], 0) }));
}

function cells(data) {
  const result = [];
  data.series.forEach((series, seriesIndex) => {
    data.labels.forEach((label, labelIndex) => {
      result.push({ series, seriesIndex, label, labelIndex, value: data.values[seriesIndex][labelIndex] });
    });
  });
  return result;
}

function color(index) {
  return PALETTE[index % PALETTE.length];
}

function safeMax(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  return Math.max(...finite, 1);
}

async function downloadChart(record) {
  const selectedFormat = exportFormat.value;
  const plotlyFormat = selectedFormat === "jpg" ? "jpeg" : selectedFormat;
  const dpi = getExportDpi();
  const scale = Math.max(1, dpi / 96);
  const url = await Plotly.toImage(record.plot, {
    format: plotlyFormat,
    width: 1200,
    height: 760,
    scale,
  });
  const link = document.createElement("a");
  link.href = url;
  link.download = `${cleanName(record.data.sheetName)}_${cleanName(record.data.title)}_${record.spec.group}_${String(record.spec.number).padStart(2, "0")}_${cleanName(record.spec.label)}.${selectedFormat}`;
  link.click();
}

function getExportDpi() {
  const dpi = Number(dpiInput.value);
  if (!Number.isFinite(dpi)) return 300;
  return Math.min(1200, Math.max(72, Math.round(dpi)));
}

async function downloadAll() {
  const selectedCharts = renderedCharts.filter((record) => record.checkbox.checked);
  if (selectedCharts.length === 0) {
    setStatus("저장할 그래프를 먼저 선택하세요.", true);
    return;
  }

  setStatus(`선택한 그래프 ${selectedCharts.length}개를 순서대로 저장합니다. 브라우저가 여러 파일 다운로드 권한을 물을 수 있습니다.`);
  for (const record of selectedCharts) {
    await downloadChart(record);
    await delay(250);
  }
  setStatus("저장이 완료되었습니다.");
}

function toggleSelectAll() {
  const shouldSelect = renderedCharts.some((record) => !record.checkbox.checked);
  renderedCharts.forEach((record) => {
    record.checkbox.checked = shouldSelect;
  });
  updateDownloadButtons();
}

function updateDownloadButtons() {
  const selectedCount = renderedCharts.filter((record) => record.checkbox.checked).length;
  downloadAllBtn.disabled = selectedCount === 0;
  selectAllBtn.disabled = renderedCharts.length === 0;
  selectAllBtn.textContent = selectedCount === renderedCharts.length ? "전체 해제" : "전체 선택";
  downloadAllBtn.textContent = selectedCount > 0 ? `선택 ${selectedCount}개 저장` : "선택 그래프 저장";
}

function resetApp() {
  workbook = null;
  currentData = null;
  renderedCharts = [];
  fileInput.value = "";
  fileName.textContent = ".xlsx, .xls, .csv 지원";
  sheetSelect.innerHTML = "<option>파일을 먼저 선택하세요</option>";
  sheetSelect.disabled = true;
  generateBtn.disabled = true;
  downloadAllBtn.disabled = true;
  selectAllBtn.disabled = true;
  chartGrid.innerHTML = "";
  summary.innerHTML = "";
  emptyState.classList.remove("hidden");
  reportTitle.textContent = "그래프 미리보기";
  reportMeta.textContent = "엑셀의 첫 행은 제목/라벨, 첫 열은 항목명으로 인식합니다.";
  setStatus("대기 중");
}

function cleanName(value) {
  return String(value || "untitled").replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, "_").slice(0, 80);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.color = isError ? "var(--warn)" : "var(--muted)";
}
