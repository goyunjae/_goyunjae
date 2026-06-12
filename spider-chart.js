(function () {
  if (typeof window.chartSpecs !== "function") return;

  const palette = ["#274C77", "#6096BA", "#A3CEF1", "#8B8C89", "#D9A441", "#A44A3F", "#587B7F", "#6A4C93"];
  const previousChartSpecs = window.chartSpecs;

  window.chartSpecs = function spiderChartSpecs() {
    const specs = previousChartSpecs();
    if (specs.some((item) => item.group === "ADVANCED" && item.label === "Spider Chart")) return specs;
    return [...specs, { group: "ADVANCED", number: 27, label: "Spider Chart", build: spiderChart }];
  };

  function color(index) { return palette[index % palette.length]; }
  function safeMax(values) { const finite = values.filter((value) => Number.isFinite(value)); return Math.max(...finite, 1); }

  function spiderChart(data) {
    const theta = [...data.labels, data.labels[0]];
    const max = safeMax(data.values.flat());
    return {
      traces: data.series.slice(0, 8).map((series, i) => ({
        type: "scatterpolar",
        mode: "lines+markers",
        r: [...data.values[i], data.values[i][0]],
        theta,
        fill: "toself",
        name: series,
        line: { color: color(i), width: 2 },
        marker: { size: 5, color: color(i) },
        opacity: 0.42,
      })),
      layout: {
        polar: {
          bgcolor: "#fbfdff",
          radialaxis: { visible: true, range: [0, max * 1.08], gridcolor: "#d9e1ea", linecolor: "#b9c7d5", tickfont: { size: 10, color: "#647084" } },
          angularaxis: { gridcolor: "#d9e1ea", linecolor: "#b9c7d5", tickfont: { size: 11, color: "#1c2430" } },
        },
        legend: { orientation: "h", y: -0.18, x: 0 },
      },
    };
  }
}());

(function () {
  if (typeof window.chartSpecs !== "function") return;

  const palette = ["#2F6BFF", "#FFB000", "#00A78E", "#E84A5F", "#7B61FF", "#24A6DC", "#F76F30", "#5E6C84", "#8CC152", "#C557DD"];
  const grid = "#E7EDF5";
  const ink = "#172033";
  const priorChartSpecs = window.chartSpecs;

  window.addEventListener("DOMContentLoaded", () => {
    const chartGroup = document.querySelector("#chartGroup");
    if (chartGroup && !chartGroup.querySelector('option[value="VIZZLO"]')) {
      const option = document.createElement("option");
      option.value = "VIZZLO";
      option.textContent = "VIZZLO";
      chartGroup.appendChild(option);
    }
  });

  window.chartSpecs = function vizzloChartSpecs() {
    const specs = priorChartSpecs().map((item) => ({ ...item, build: (data) => styleChart(item.build(data)) }));
    if (specs.some((item) => item.group === "VIZZLO")) return specs;
    return [
      ...specs,
      spec(1, "Butterfly Compare", butterflyChart),
      spec(2, "Progress Bar", progressBarChart),
      spec(3, "Half Donut", halfDonutChart),
      spec(4, "Multiple Pies", multiplePiesChart),
      spec(5, "Value Projection", valueProjectionChart),
      spec(6, "Ribbon Rank Bar", ribbonRankBar),
      spec(7, "Timeline Dots", timelineDots),
      spec(8, "Gauge Cards", gaugeCards),
      spec(9, "Up Down Bars", upDownBars),
      spec(10, "Scorecard Table", scorecardTable),
    ];
  };

  function spec(number, label, build) {
    return { group: "VIZZLO", number, label, build: (data) => styleChart(build(data)) };
  }

  function styleChart(chart) {
    const layout = chart.layout || {};
    return {
      traces: (chart.traces || []).map((trace, index) => styleTrace(trace, index)),
      layout: {
        ...layout,
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        colorway: palette,
        font: { family: "Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Arial", color: ink },
        hoverlabel: { bgcolor: ink, bordercolor: ink, font: { color: "#ffffff" } },
        legend: { orientation: "h", x: 0, y: -0.22, font: { size: 10, color: "#42526E" }, ...(layout.legend || {}) },
        xaxis: axis(layout.xaxis),
        yaxis: axis(layout.yaxis),
      },
    };
  }

  function styleTrace(trace, index) {
    const next = { ...trace };
    const baseColor = palette[index % palette.length];
    if (next.type === "bar" || next.type === "waterfall") {
      next.marker = { color: baseColor, line: { color: "#ffffff", width: 1 }, ...(next.marker || {}) };
    }
    if (next.type === "scatter") {
      next.line = { color: baseColor, width: 2.4, ...(next.line || {}) };
      next.marker = { color: baseColor, size: 9, line: { color: "#ffffff", width: 1 }, ...(next.marker || {}) };
    }
    if (next.type === "pie") {
      next.marker = { colors: palette, line: { color: "#ffffff", width: 2 }, ...(next.marker || {}) };
      next.textinfo = next.textinfo || "label+percent";
    }
    if (next.type === "heatmap") {
      next.colorscale = [[0, "#F7FAFF"], [0.35, "#D9E8FF"], [0.72, "#73A7FF"], [1, "#2F6BFF"]];
    }
    return next;
  }

  function axis(axisLayout = {}) {
    return {
      showline: true,
      linecolor: "#B8C4D6",
      gridcolor: grid,
      zerolinecolor: "#CCD6E3",
      tickfont: { size: 10, color: "#42526E" },
      titlefont: { size: 11, color: ink },
      automargin: true,
      ...axisLayout,
    };
  }

  function seriesTotals(data) {
    return data.series.map((name, index) => ({ name, value: data.values[index].reduce((sum, value) => sum + value, 0) }));
  }

  function labelTotals(data) {
    return data.labels.map((name, index) => ({ name, value: data.values.reduce((sum, row) => sum + row[index], 0) }));
  }

  function safeMax(values) {
    const finite = values.filter((value) => Number.isFinite(value));
    return Math.max(...finite, 1);
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString("ko-KR", { maximumFractionDigits: 1 });
  }

  function butterflyChart(data) {
    const leftIndex = 0;
    const rightIndex = Math.min(1, data.series.length - 1);
    const rows = data.labels.map((label, index) => ({
      label,
      left: Math.abs(data.values[leftIndex][index] || 0),
      right: Math.abs(data.values[rightIndex][index] || 0),
    })).sort((a, b) => (a.left + a.right) - (b.left + b.right));
    return {
      traces: [
        { type: "bar", orientation: "h", y: rows.map((d) => d.label), x: rows.map((d) => -d.left), name: data.series[leftIndex] || "Left", marker: { color: "#2F6BFF" } },
        { type: "bar", orientation: "h", y: rows.map((d) => d.label), x: rows.map((d) => d.right), name: data.series[rightIndex] || "Right", marker: { color: "#FFB000" } },
      ],
      layout: { barmode: "relative", xaxis: { title: "Left / right comparison", zeroline: true }, margin: { l: 120, b: 82 } },
    };
  }

  function progressBarChart(data) {
    const totals = labelTotals(data);
    const max = safeMax(totals.map((d) => d.value));
    const rows = totals.map((item) => ({ ...item, percent: item.value / max * 100 })).sort((a, b) => a.percent - b.percent);
    return {
      traces: [
        { type: "bar", orientation: "h", y: rows.map((d) => d.name), x: rows.map(() => 100), marker: { color: "#EEF3FA" }, hoverinfo: "skip", showlegend: false },
        { type: "bar", orientation: "h", y: rows.map((d) => d.name), x: rows.map((d) => d.percent), text: rows.map((d) => `${formatNumber(d.value)} (${d.percent.toFixed(0)}%)`), textposition: "outside", marker: { color: rows.map((_, i) => palette[i % palette.length]) }, showlegend: false },
      ],
      layout: { barmode: "overlay", xaxis: { range: [0, 115], title: "Progress by max value" }, margin: { l: 130, r: 60, b: 76 } },
    };
  }

  function halfDonutChart(data) {
    const totals = seriesTotals(data);
    const values = totals.map((d) => d.value);
    return {
      traces: [{ type: "pie", labels: [...totals.map((d) => d.name), ""], values: [...values, values.reduce((sum, value) => sum + value, 0)], hole: 0.62, rotation: 90, direction: "clockwise", sort: false, marker: { colors: [...palette, "rgba(0,0,0,0)"] }, textinfo: "label+percent" }],
      layout: { showlegend: true, margin: { l: 30, r: 30, t: 62, b: 30 } },
    };
  }

  function multiplePiesChart(data) {
    return {
      traces: data.series.slice(0, 4).map((series, index) => ({
        type: "pie",
        labels: data.labels,
        values: data.values[index],
        name: series,
        title: { text: series, font: { size: 12 } },
        domain: { x: [(index % 2) * 0.52, (index % 2) * 0.52 + 0.46], y: [index < 2 ? 0.54 : 0, index < 2 ? 1 : 0.46] },
        hole: 0.45,
        textinfo: "none",
        showlegend: index === 0,
      })),
      layout: { margin: { l: 30, r: 30, t: 60, b: 30 } },
    };
  }

  function valueProjectionChart(data) {
    const first = data.labels[0];
    const last = data.labels[data.labels.length - 1];
    const rows = data.series.map((series, index) => ({ series, first: data.values[index][0] || 0, last: data.values[index][data.labels.length - 1] || 0 }));
    return {
      traces: [
        ...rows.map((row) => ({ type: "scatter", mode: "lines", x: [row.first, row.last], y: [row.series, row.series], line: { color: "#D6DEE9", width: 8 }, showlegend: false, hoverinfo: "skip" })),
        { type: "scatter", mode: "markers+text", x: rows.map((d) => d.first), y: rows.map((d) => d.series), text: rows.map((d) => formatNumber(d.first)), textposition: "middle left", name: first, marker: { color: "#2F6BFF", size: 12 } },
        { type: "scatter", mode: "markers+text", x: rows.map((d) => d.last), y: rows.map((d) => d.series), text: rows.map((d) => formatNumber(d.last)), textposition: "middle right", name: last, marker: { color: "#FFB000", size: 12 } },
      ],
      layout: { xaxis: { title: `${first} to ${last}` }, margin: { l: 120, r: 64, b: 76 } },
    };
  }

  function ribbonRankBar(data) {
    const rows = seriesTotals(data).sort((a, b) => a.value - b.value);
    return {
      traces: [{ type: "bar", orientation: "h", y: rows.map((d) => d.name), x: rows.map((d) => d.value), text: rows.map((d) => formatNumber(d.value)), textposition: "outside", marker: { color: rows.map((_, i) => palette[i % palette.length]) } }],
      layout: { xaxis: { title: "Total" }, margin: { l: 130, r: 70, b: 76 }, showlegend: false },
    };
  }

  function timelineDots(data) {
    const totals = labelTotals(data);
    return {
      traces: [
        { type: "scatter", mode: "lines", x: totals.map((_, i) => i + 1), y: totals.map(() => 1), line: { color: "#C7D2E2", width: 4 }, hoverinfo: "skip", showlegend: false },
        { type: "scatter", mode: "markers+text", x: totals.map((_, i) => i + 1), y: totals.map(() => 1), text: totals.map((d) => `${d.name}<br>${formatNumber(d.value)}`), textposition: totals.map((_, i) => i % 2 ? "bottom center" : "top center"), marker: { size: 18, color: totals.map((_, i) => palette[i % palette.length]), line: { color: "#ffffff", width: 2 } }, showlegend: false },
      ],
      layout: { xaxis: { visible: false }, yaxis: { visible: false, range: [0.5, 1.5] }, margin: { l: 30, r: 30, t: 82, b: 82 } },
    };
  }

  function gaugeCards(data) {
    const totals = labelTotals(data).slice(0, 6);
    const max = safeMax(totals.map((d) => d.value));
    return {
      traces: totals.map((item, index) => ({
        type: "indicator",
        mode: "number+gauge",
        value: item.value / max * 100,
        number: { suffix: "%", font: { size: 18, color: ink } },
        title: { text: item.name, font: { size: 11, color: "#42526E" } },
        domain: { x: [(index % 3) / 3 + 0.03, (index % 3) / 3 + 0.29], y: [index < 3 ? 0.55 : 0.05, index < 3 ? 0.98 : 0.48] },
        gauge: { axis: { range: [0, 100], visible: false }, bar: { color: palette[index % palette.length] }, bgcolor: "#EEF3FA", borderwidth: 0 },
      })),
      layout: { margin: { l: 24, r: 24, t: 64, b: 30 } },
    };
  }

  function upDownBars(data) {
    const first = data.labels[0];
    const last = data.labels[data.labels.length - 1];
    const rows = data.series.map((series, index) => {
      const delta = (data.values[index][data.labels.length - 1] || 0) - (data.values[index][0] || 0);
      return { series, delta };
    }).sort((a, b) => a.delta - b.delta);
    return {
      traces: [{ type: "bar", orientation: "h", y: rows.map((d) => d.series), x: rows.map((d) => d.delta), text: rows.map((d) => `${d.delta >= 0 ? "+" : "-"} ${formatNumber(Math.abs(d.delta))}`), textposition: "outside", marker: { color: rows.map((d) => d.delta >= 0 ? "#00A78E" : "#E84A5F") } }],
      layout: { xaxis: { title: `${last} - ${first}`, zeroline: true }, margin: { l: 130, r: 70, b: 76 }, showlegend: false },
    };
  }

  function scorecardTable(data) {
    const totals = seriesTotals(data).sort((a, b) => b.value - a.value).slice(0, 8);
    return {
      traces: [{ type: "table", header: { values: ["Rank", "Item", "Total"], fill: { color: ink }, font: { color: "#ffffff", size: 12 }, align: "center" }, cells: { values: [totals.map((_, i) => i + 1), totals.map((d) => d.name), totals.map((d) => formatNumber(d.value))], fill: { color: totals.map((_, i) => i % 2 ? "#F6F8FC" : "#FFFFFF") }, font: { color: ink, size: 12 }, align: "center", height: 30 } }],
      layout: { margin: { l: 20, r: 20, t: 58, b: 20 } },
    };
  }
}());
