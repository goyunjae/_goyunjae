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
      spec(11, "Floating Waterfall", floatingWaterfall),
      spec(12, "Mosaic Stack", mosaicStack),
      spec(13, "Radial Fan", radialFan),
      spec(14, "Polar Stack", polarStack),
      spec(15, "Growth Arrow Bars", growthArrowBars),
      spec(16, "Process Chevrons", processChevrons),
      spec(17, "Radial Rings", radialRings),
      spec(18, "Split Hexagons", splitHexagons),
      spec(19, "Cycle Bubbles", cycleBubbles),
      spec(20, "Half Pie Callouts", halfPieCallouts),
      spec(21, "Profile Lines", profileLines),
      spec(22, "Alluvial Before After", alluvialBeforeAfter),
      spec(23, "Layered Gantt", layeredGantt),
      spec(24, "Roadmap Swimlane", roadmapSwimlane),
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

  function floatingWaterfall(data) {
    const totals = labelTotals(data);
    const measures = totals.map((_, index) => index === 0 || index === totals.length - 1 ? "total" : "relative");
    return {
      traces: [{
        type: "waterfall",
        x: totals.map((d) => d.name),
        y: totals.map((d) => d.value),
        measure: measures,
        text: totals.map((d) => formatNumber(d.value)),
        textposition: "inside",
        connector: { line: { color: "#7A858F", width: 1 } },
        decreasing: { marker: { color: "#E84A5F" } },
        increasing: { marker: { color: "#7BC7B6" } },
        totals: { marker: { color: "#BFE7AE" } },
      }],
      layout: { yaxis: { title: "Value" }, showlegend: false, margin: { l: 70, r: 30, b: 100 } },
    };
  }

  function mosaicStack(data) {
    const labelTotalsList = labelTotals(data);
    const grand = labelTotalsList.reduce((sum, item) => sum + item.value, 0) || 1;
    let left = 0;
    const x = [];
    const widths = [];
    data.labels.forEach((label, index) => {
      const width = Math.max((labelTotalsList[index]?.value || 0) / grand, 0.04);
      x.push(left + width / 2);
      widths.push(width);
      left += width;
    });
    const traces = data.series.map((series, seriesIndex) => ({
      type: "bar",
      x,
      y: data.labels.map((_, labelIndex) => {
        const total = labelTotalsList[labelIndex]?.value || 1;
        return (data.values[seriesIndex][labelIndex] || 0) / total * 100;
      }),
      width: widths,
      name: series,
      text: data.labels.map((_, labelIndex) => formatNumber(data.values[seriesIndex][labelIndex] || 0)),
      textposition: "inside",
      marker: { color: palette[seriesIndex % palette.length], line: { color: "#ffffff", width: 1 } },
    }));
    return {
      traces,
      layout: {
        barmode: "stack",
        xaxis: { tickvals: x, ticktext: data.labels, range: [0, 1], title: "Share by category" },
        yaxis: { range: [0, 100], ticksuffix: "%", title: "Composition" },
        margin: { l: 70, r: 30, b: 90 },
      },
    };
  }

  function radialFan(data) {
    const totals = labelTotals(data).slice(0, 8);
    const start = -120;
    const span = 240;
    return {
      traces: [{
        type: "barpolar",
        r: totals.map((d) => d.value),
        theta: totals.map((_, i) => start + (span / Math.max(totals.length - 1, 1)) * i),
        width: Math.max(16, span / Math.max(totals.length, 1) * 0.75),
        text: totals.map((d) => `${d.name}: ${formatNumber(d.value)}`),
        marker: { color: totals.map((_, i) => palette[i % palette.length]), line: { color: "#ffffff", width: 2 } },
      }],
      layout: { polar: { radialaxis: { visible: false }, angularaxis: { visible: false } }, showlegend: false, margin: { l: 20, r: 20, t: 60, b: 20 } },
    };
  }

  function polarStack(data) {
    const labels = data.labels.slice(0, 12);
    const traces = data.series.map((series, seriesIndex) => ({
      type: "barpolar",
      r: labels.map((_, labelIndex) => data.values[seriesIndex][labelIndex] || 0),
      theta: labels.map((_, labelIndex) => labelIndex * 360 / labels.length),
      width: 360 / labels.length * 0.72,
      name: series,
      marker: { color: palette[seriesIndex % palette.length], line: { color: "#ffffff", width: 1 } },
    }));
    return {
      traces,
      layout: {
        polar: { angularaxis: { tickvals: labels.map((_, i) => i * 360 / labels.length), ticktext: labels }, radialaxis: { visible: false } },
        barmode: "stack",
        margin: { l: 30, r: 30, t: 60, b: 30 },
      },
    };
  }

  function growthArrowBars(data) {
    const totals = labelTotals(data);
    const annotations = totals.slice(1).map((item, index) => {
      const previous = totals[index]?.value || 1;
      const change = (item.value - previous) / Math.abs(previous) * 100;
      return {
        x: item.name,
        y: item.value,
        text: `${change >= 0 ? "+" : ""}${change.toFixed(0)}%`,
        showarrow: true,
        arrowhead: 2,
        ax: -42,
        ay: change >= 0 ? 42 : -42,
        arrowcolor: "#C4123F",
        font: { color: "#C4123F", size: 12 },
      };
    });
    return {
      traces: [{ type: "bar", x: totals.map((d) => d.name), y: totals.map((d) => d.value), text: totals.map((d) => formatNumber(d.value)), textposition: "outside", marker: { color: totals.map((_, i) => palette[i % palette.length]) } }],
      layout: { annotations, yaxis: { title: "Value" }, showlegend: false, margin: { l: 60, r: 30, b: 90 } },
    };
  }

  function processChevrons(data) {
    const totals = labelTotals(data).slice(0, 6);
    const shapes = [];
    const annotations = [];
    const step = 1 / Math.max(totals.length, 1);
    totals.forEach((item, index) => {
      const x0 = index * step + 0.02;
      const x1 = (index + 1) * step - 0.01;
      const notch = Math.min(0.035, step * 0.22);
      shapes.push({
        type: "path",
        xref: "paper",
        yref: "paper",
        path: `M ${x0},0.56 L ${x1 - notch},0.56 L ${x1},0.64 L ${x1 - notch},0.72 L ${x0},0.72 L ${x0 + notch},0.64 Z`,
        fillcolor: palette[index % palette.length],
        line: { color: "#ffffff", width: 2 },
      });
      annotations.push({ xref: "paper", yref: "paper", x: (x0 + x1) / 2, y: 0.64, text: `<b>${item.name}</b>`, showarrow: false, font: { color: "#ffffff", size: 13 } });
      annotations.push({ xref: "paper", yref: "paper", x: (x0 + x1) / 2, y: 0.46, text: formatNumber(item.value), showarrow: false, font: { color: "#5E6C84", size: 12 } });
    });
    return { traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, showlegend: false }], layout: blankShapeLayout(shapes, annotations) };
  }

  function radialRings(data) {
    const totals = labelTotals(data).slice(0, 5);
    const max = safeMax(totals.map((d) => d.value));
    return {
      traces: totals.map((item, index) => ({
        type: "barpolar",
        r: [0.72],
        theta: [item.value / max * 300 / 2],
        width: [item.value / max * 300],
        base: index + 1,
        name: item.name,
        text: `${item.name}: ${formatNumber(item.value)}`,
        marker: { color: palette[index % palette.length], line: { color: "#ffffff", width: 2 } },
      })),
      layout: { polar: { radialaxis: { visible: false, range: [0, totals.length + 1.5] }, angularaxis: { visible: false, rotation: 90 } }, showlegend: true, margin: { l: 20, r: 20, t: 60, b: 20 } },
    };
  }

  function splitHexagons(data) {
    const totals = labelTotals(data).slice(0, 6);
    const shapes = [];
    const annotations = [];
    totals.forEach((item, index) => {
      const x = 0.12 + index * 0.15;
      const y = 0.55;
      const w = 0.055;
      const h = 0.16;
      shapes.push({ type: "path", xref: "paper", yref: "paper", path: `M ${x},${y + h} L ${x + w},${y + h * 0.5} L ${x + w},${y} L ${x},${y - h * 0.5} L ${x - w},${y} L ${x - w},${y + h * 0.5} Z`, fillcolor: palette[index % palette.length], opacity: 0.88, line: { color: "#ffffff", width: 2 } });
      shapes.push({ type: "line", xref: "paper", yref: "paper", x0: x - w, x1: x + w, y0: y + h * 0.22, y1: y + h * 0.22, line: { color: "#ffffff", width: 2 } });
      annotations.push({ xref: "paper", yref: "paper", x, y: y + h * 0.38, text: formatNumber(item.value), showarrow: false, font: { color: "#ffffff", size: 13 } });
      annotations.push({ xref: "paper", yref: "paper", x, y: y - h * 0.38, text: item.name, showarrow: false, font: { color: "#5E6C84", size: 11 } });
    });
    return { traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, showlegend: false }], layout: blankShapeLayout(shapes, annotations) };
  }

  function cycleBubbles(data) {
    const totals = labelTotals(data).slice(0, 8);
    const shapes = [];
    const annotations = [];
    totals.forEach((item, index) => {
      const angle = Math.PI * 2 * index / Math.max(totals.length, 1) - Math.PI / 2;
      const x = 0.5 + Math.cos(angle) * 0.28;
      const y = 0.52 + Math.sin(angle) * 0.3;
      shapes.push({ type: "circle", xref: "paper", yref: "paper", x0: x - 0.07, x1: x + 0.07, y0: y - 0.07, y1: y + 0.07, fillcolor: palette[index % palette.length], line: { color: "#ffffff", width: 2 } });
      annotations.push({ xref: "paper", yref: "paper", x, y, text: `<b>${item.name}</b><br>${formatNumber(item.value)}`, showarrow: false, font: { color: "#ffffff", size: 11 } });
    });
    return { traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, showlegend: false }], layout: blankShapeLayout(shapes, annotations) };
  }

  function halfPieCallouts(data) {
    const totals = seriesTotals(data).slice(0, 6);
    const values = totals.map((d) => d.value);
    const labels = totals.map((d) => d.name);
    return {
      traces: [{ type: "pie", labels: [...labels, ""], values: [...values, values.reduce((sum, value) => sum + value, 0)], hole: 0, rotation: 90, direction: "clockwise", sort: false, textinfo: "label+percent", textposition: "outside", marker: { colors: [...palette, "rgba(0,0,0,0)"], line: { color: "#ffffff", width: 2 } } }],
      layout: { showlegend: false, margin: { l: 30, r: 30, t: 60, b: 30 } },
    };
  }

  function profileLines(data) {
    const traces = data.series.slice(0, 4).map((series, index) => ({
      type: "scatter",
      mode: "lines+markers",
      x: data.values[index],
      y: data.labels,
      name: series,
      line: { color: palette[index % palette.length], width: 2 },
      marker: { color: palette[index % palette.length], size: 9 },
    }));
    return { traces, layout: { xaxis: { title: "Low to high" }, margin: { l: 150, r: 30, b: 80 } } };
  }

  function alluvialBeforeAfter(data) {
    const points = data.series.map((series, index) => ({ series, source: data.values[index][0] || 0, target: data.values[index][data.labels.length - 1] || 0 })).filter((d) => d.source || d.target);
    return {
      traces: [{
        type: "sankey",
        arrangement: "fixed",
        node: { label: ["Before", "After", ...points.map((d) => d.series)], x: [0.05, 0.95, ...points.map(() => 0.5)], y: [0.1, 0.1, ...points.map((_, i) => 0.2 + i * 0.08)], pad: 12, thickness: 16, color: ["#2F6BFF", "#00A78E", ...points.map((_, i) => palette[i % palette.length])] },
        link: { source: [...points.map(() => 0), ...points.map((_, i) => i + 2)], target: [...points.map((_, i) => i + 2), ...points.map(() => 1)], value: [...points.map((d) => Math.max(d.source, 1)), ...points.map((d) => Math.max(d.target, 1))], color: [...points.map((_, i) => `${palette[i % palette.length]}55`), ...points.map((_, i) => `${palette[i % palette.length]}77`)] },
      }],
      layout: { margin: { l: 30, r: 30, t: 60, b: 30 } },
    };
  }

  function layeredGantt(data) {
    const totals = seriesTotals(data).slice(0, 8);
    const traces = [{
      type: "bar",
      orientation: "h",
      y: totals.map((d) => d.name),
      x: totals.map((d) => Math.max(d.value, 1)),
      base: totals.map((_, i) => i * 0.8),
      marker: { color: totals.map((_, i) => palette[i % palette.length]) },
      text: totals.map((d) => formatNumber(d.value)),
      textposition: "inside",
      showlegend: false,
    }];
    return { traces, layout: { xaxis: { title: "Timeline units" }, yaxis: { autorange: "reversed" }, margin: { l: 130, r: 30, b: 80 } } };
  }

  function roadmapSwimlane(data) {
    const labels = data.labels.slice(0, 6);
    const shapes = [];
    const annotations = [];
    const rowHeight = 0.12;
    data.series.slice(0, 4).forEach((series, row) => {
      const y = 0.74 - row * 0.16;
      annotations.push({ xref: "paper", yref: "paper", x: 0.04, y, text: `<b>${series}</b>`, showarrow: false, xanchor: "left", font: { color: "#5E6C84", size: 11 } });
      labels.forEach((label, index) => {
        const value = data.values[row][index] || 0;
        if (value <= 0) return;
        const x0 = 0.18 + index * 0.12;
        const x1 = Math.min(0.92, x0 + 0.08 + value / safeMax(data.values.flat()) * 0.12);
        shapes.push({ type: "rect", xref: "paper", yref: "paper", x0, x1, y0: y - rowHeight / 2, y1: y + rowHeight / 2, fillcolor: palette[(row + index) % palette.length], line: { color: "#ffffff", width: 1 } });
      });
    });
    labels.forEach((label, index) => annotations.push({ xref: "paper", yref: "paper", x: 0.2 + index * 0.12, y: 0.92, text: label, showarrow: false, font: { color: "#5E6C84", size: 10 } }));
    return { traces: [{ type: "scatter", x: [0], y: [0], mode: "markers", marker: { opacity: 0 }, showlegend: false }], layout: blankShapeLayout(shapes, annotations) };
  }

  function blankShapeLayout(shapes, annotations) {
    return {
      shapes,
      annotations,
      xaxis: { visible: false, range: [0, 1] },
      yaxis: { visible: false, range: [0, 1] },
      margin: { l: 20, r: 20, t: 50, b: 20 },
      showlegend: false,
    };
  }
}());
