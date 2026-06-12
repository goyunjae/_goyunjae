(function () {
  if (typeof window.chartSpecs !== "function") return;

  const ALL_GROUP = "전체";
  const palette = [
    "#45B8AC", "#B8E6A3", "#2F95B8", "#2D64A8",
    "#F2B75E", "#E56F76", "#7FC8A9", "#8E7AD8",
    "#9BD7E8", "#C9EFB7", "#5E6C84", "#D88C9A",
  ];
  const grid = "#E5F0EE";
  const ink = "#21313A";
  const previousChartSpecs = window.chartSpecs;

  const remap = {
    "Butterfly Compare": ["BAR", 5],
    "Progress Bar": ["BAR", 6],
    "Half Donut": ["PIE", 5],
    "Multiple Pies": ["PIE", 6],
    "Value Projection": ["RANGE", 5],
    "Ribbon Rank Bar": ["BAR", 7],
    "Timeline Dots": ["TIMELINE", 1],
    "Gauge Cards": ["RADIAL", 1],
    "Up Down Bars": ["BAR", 8],
    "Scorecard Table": ["TABLE", 1],
    "Floating Waterfall": ["BAR", 9],
    "Mosaic Stack": ["BAR", 10],
    "Radial Fan": ["RADIAL", 2],
    "Polar Stack": ["RADIAL", 3],
    "Growth Arrow Bars": ["BAR", 11],
    "Process Chevrons": ["PROCESS", 1],
    "Radial Rings": ["RADIAL", 4],
    "Split Hexagons": ["PROCESS", 2],
    "Cycle Bubbles": ["PROCESS", 3],
    "Half Pie Callouts": ["PIE", 7],
    "Profile Lines": ["LINE", 5],
    "Alluvial Before After": ["FLOW", 1],
    "Layered Gantt": ["TIMELINE", 2],
    "Roadmap Swimlane": ["TIMELINE", 3],
  };

  window.chartSpecs = function polishedChartSpecs() {
    const base = previousChartSpecs().map((item) => normalizeSpec(item));
    const textSpec = { group: "TEXT", number: 1, label: "Word Cloud", build: wordCloud };
    const actual = uniqueSpecs([...base, textSpec]).filter((item) => item.group !== "VIZZLO" && item.group !== ALL_GROUP);
    const allSpecs = actual.map((item, index) => ({
      ...item,
      group: ALL_GROUP,
      number: index + 1,
      label: `${item.group} · ${item.label}`,
    }));
    return [...allSpecs, ...actual];
  };

  window.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
      const select = document.querySelector("#chartGroup");
      if (!select) return;
      [...select.options].forEach((option) => {
        if (option.value === "VIZZLO" || option.textContent === "VIZZLO") option.remove();
      });
      if (select.value === "VIZZLO" || select.value === "ALL") select.value = "";
    }, 20);
  });

  function normalizeSpec(item) {
    const mapped = item.group === "VIZZLO" ? remap[item.label] : null;
    const group = mapped ? mapped[0] : item.group;
    const number = mapped ? mapped[1] : item.number;
    return { ...item, group, number, build: (data) => styleChart(item.build(data)) };
  }

  function uniqueSpecs(specs) {
    const seen = new Set();
    return specs.filter((item) => {
      const key = `${item.group}:${item.number}:${item.label}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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
        legend: { orientation: "h", x: 0, y: -0.22, font: { size: 10, color: "#5E6C84" }, ...(layout.legend || {}) },
        xaxis: axis(layout.xaxis),
        yaxis: axis(layout.yaxis),
      },
    };
  }

  function styleTrace(trace, index) {
    const next = { ...trace };
    const baseColor = palette[index % palette.length];
    if (next.type === "bar" || next.type === "waterfall" || next.type === "barpolar") {
      next.marker = { ...(next.marker || {}), color: next.marker?.color || baseColor, line: { color: "#ffffff", width: 1, ...(next.marker?.line || {}) } };
    }
    if (next.type === "scatter" || next.type === "scatterpolar") {
      next.line = { ...(next.line || {}), color: next.line?.color || baseColor, width: next.line?.width || 2.4 };
      next.marker = { ...(next.marker || {}), color: next.marker?.color || baseColor, size: next.marker?.size || 9, line: { color: "#ffffff", width: 1, ...(next.marker?.line || {}) } };
    }
    if (next.type === "pie") {
      next.marker = { ...(next.marker || {}), colors: next.marker?.colors || palette, line: { color: "#ffffff", width: 2, ...(next.marker?.line || {}) } };
      next.textinfo = next.textinfo || "label+percent";
    }
    if (next.type === "heatmap") {
      next.colorscale = [[0, "#F7FCFB"], [0.35, "#DDF3EC"], [0.7, "#8FD6C8"], [1, "#2F95B8"]];
    }
    if (next.type === "indicator" && next.gauge) {
      next.gauge = { ...next.gauge, bar: { color: baseColor, ...(next.gauge.bar || {}) }, bgcolor: "#F4FAF8" };
    }
    return next;
  }

  function axis(axisLayout = {}) {
    return {
      showline: true,
      linecolor: "#B8C8C5",
      gridcolor: grid,
      zerolinecolor: "#C8D6D3",
      tickfont: { size: 10, color: "#5E6C84" },
      titlefont: { size: 11, color: ink },
      automargin: true,
      ...axisLayout,
    };
  }

  function wordCloud(data) {
    const totals = [];
    data.series.forEach((series, rowIndex) => totals.push({ text: series, value: data.values[rowIndex].reduce((sum, value) => sum + value, 0) }));
    data.labels.forEach((label, colIndex) => totals.push({ text: label, value: data.values.reduce((sum, row) => sum + row[colIndex], 0) }));
    const words = totals.filter((item) => item.text && item.value > 0).sort((a, b) => b.value - a.value).slice(0, 48);
    const max = Math.max(...words.map((item) => item.value), 1);
    const points = words.map((item, index) => spiralPoint(index));
    return {
      traces: [{
        type: "scatter",
        mode: "text",
        x: points.map((point) => point.x),
        y: points.map((point) => point.y),
        text: words.map((item) => item.text),
        textfont: {
          size: words.map((item) => 14 + (item.value / max) * 34),
          color: words.map((_, index) => palette[index % palette.length]),
        },
        hovertext: words.map((item) => `${item.text}: ${Number(item.value).toLocaleString("ko-KR")}`),
        hoverinfo: "text",
        showlegend: false,
      }],
      layout: { xaxis: { visible: false }, yaxis: { visible: false, scaleanchor: "x" }, margin: { l: 20, r: 20, t: 55, b: 20 } },
    };
  }

  function spiralPoint(index) {
    if (index === 0) return { x: 0, y: 0 };
    const angle = index * 2.399963;
    const radius = 0.12 * Math.sqrt(index);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }
}());
