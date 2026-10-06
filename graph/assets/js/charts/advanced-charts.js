(function () {
  window.addEventListener("DOMContentLoaded", () => {
    const chartGroup = document.querySelector("#chartGroup");
    if (chartGroup && !chartGroup.querySelector('option[value="ADVANCED"]')) {
      const option = document.createElement("option");
      option.value = "ADVANCED";
      option.textContent = "ADVANCED";
      chartGroup.appendChild(option);
    }
  });

  if (typeof window.chartSpecs !== "function") return;

  const palette = [
    "#274C77", "#6096BA", "#A3CEF1", "#8B8C89",
    "#D9A441", "#A44A3F", "#587B7F", "#6A4C93",
    "#2A9D8F", "#E76F51", "#264653", "#B56576",
  ];

  const originalChartSpecs = window.chartSpecs;
  window.chartSpecs = function patchedChartSpecs() {
    const specs = originalChartSpecs().map((item) => (
      item.group === "TREEMAP" && item.number === 3
        ? { ...item, build: fixedCellTreemap }
        : item
    ));

    if (specs.some((item) => item.group === "ADVANCED")) return specs;

    return [
      ...specs,
      spec("ADVANCED", 1, "워터폴", waterfallChart),
      spec("ADVANCED", 2, "퍼널", funnelChart),
      spec("ADVANCED", 3, "파레토", paretoChart),
      spec("ADVANCED", 4, "레이더", radarChart),
      spec("ADVANCED", 5, "박스플롯", boxPlot),
      spec("ADVANCED", 6, "바이올린", violinPlot),
      spec("ADVANCED", 7, "히스토그램", histogramPlot),
      spec("ADVANCED", 8, "선버스트", sunburstChart),
      spec("ADVANCED", 9, "아이시클", icicleChart),
      spec("ADVANCED", 10, "생키", sankeyChart),
      spec("ADVANCED", 11, "버블 타임라인", bubbleTimeline),
      spec("ADVANCED", 12, "롤리팝", lollipopChart),
      spec("ADVANCED", 13, "범프 차트", bumpChart),
      spec("ADVANCED", 14, "불릿 그래프", bulletGraph),
      spec("ADVANCED", 15, "피라미드", pyramidChart),
      spec("ADVANCED", 16, "마리메코 스타일", marimekkoChart),
    ];
  };

  function spec(group, number, label, build) {
    return { group, number, label, build };
  }

  function color(index) {
    return palette[index % palette.length];
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

  function fixedCellTreemap(data) {
    const points = cells(data).filter((point) => point.value > 0);
    if (points.length === 0) {
      return { traces: [{ type: "treemap", labels: ["데이터 없음"], parents: [""], values: [1] }], layout: {} };
    }
    const totals = seriesTotals(data);
    const total = totals.reduce((sum, item) => sum + item.value, 0);
    const ids = ["root"];
    const labels = ["전체"];
    const parents = [""];
    const values = [total];
    totals.forEach((item) => {
      ids.push(`series:${item.name}`);
      labels.push(item.name);
      parents.push("root");
      values.push(item.value);
    });
    points.forEach((point) => {
      ids.push(`cell:${point.series}:${point.label}`);
      labels.push(point.label);
      parents.push(`series:${point.series}`);
      values.push(point.value);
    });
    return { traces: [{ type: "treemap", ids, labels, parents, values, branchvalues: "total", marker: { colors: values.map((_, i) => color(i)) } }], layout: {} };
  }

  function waterfallChart(data) {
    const totals = labelTotals(data);
    return { traces: [{ type: "waterfall", x: totals.map((d) => d.name), y: totals.map((d) => d.value), measure: totals.map(() => "relative"), connector: { line: { color: "#8B8C89" } } }], layout: { yaxis: { title: "증감/누적" }, showlegend: false } };
  }

  function funnelChart(data) {
    const totals = seriesTotals(data).sort((a, b) => b.value - a.value);
    return { traces: [{ type: "funnel", y: totals.map((d) => d.name), x: totals.map((d) => d.value), marker: { color: totals.map((_, i) => color(i)) } }], layout: { margin: { l: 110 }, showlegend: false } };
  }

  function paretoChart(data) {
    const totals = seriesTotals(data).sort((a, b) => b.value - a.value);
    const total = totals.reduce((sum, item) => sum + item.value, 0) || 1;
    let running = 0;
    const cumulative = totals.map((item) => {
      running += item.value;
      return running / total * 100;
    });
    return {
      traces: [
        { type: "bar", x: totals.map((d) => d.name), y: totals.map((d) => d.value), name: "값", marker: { color: totals.map((_, i) => color(i)) } },
        { type: "scatter", mode: "lines+markers+text", x: totals.map((d) => d.name), y: cumulative, yaxis: "y2", name: "누적 %", text: cumulative.map((v) => `${v.toFixed(0)}%`), textposition: "top center", line: { color: "#A44A3F", width: 2 } },
      ],
      layout: { yaxis: { title: "값" }, yaxis2: { title: "누적 %", overlaying: "y", side: "right", range: [0, 105] } },
    };
  }

  function radarChart(data) {
    const theta = [...data.labels, data.labels[0]];
    return { traces: data.series.slice(0, 6).map((name, i) => ({ type: "scatterpolar", r: [...data.values[i], data.values[i][0]], theta, fill: "toself", name, line: { color: color(i) }, opacity: 0.72 })), layout: { polar: { radialaxis: { visible: true } } } };
  }

  function boxPlot(data) {
    return { traces: data.labels.map((label, i) => ({ type: "box", y: data.values.map((row) => row[i]), name: label, marker: { color: color(i) } })), layout: { yaxis: { title: "분포" } } };
  }

  function violinPlot(data) {
    return { traces: data.labels.map((label, i) => ({ type: "violin", y: data.values.map((row) => row[i]), name: label, box: { visible: true }, meanline: { visible: true }, marker: { color: color(i) } })), layout: { yaxis: { title: "분포" } } };
  }

  function histogramPlot(data) {
    const values = data.values.flat();
    return { traces: [{ type: "histogram", x: values, marker: { color: "#6096BA" }, nbinsx: Math.min(12, Math.max(4, values.length)) }], layout: { xaxis: { title: "값" }, yaxis: { title: "빈도" }, showlegend: false } };
  }

  function hierarchicalTrace(data, type) {
    const points = cells(data).filter((point) => point.value > 0);
    const ids = ["root"];
    const labels = ["전체"];
    const parents = [""];
    const values = [points.reduce((sum, point) => sum + point.value, 0)];
    seriesTotals(data).forEach((item) => {
      ids.push(`series:${item.name}`);
      labels.push(item.name);
      parents.push("root");
      values.push(item.value);
    });
    points.forEach((point) => {
      ids.push(`cell:${point.series}:${point.label}`);
      labels.push(point.label);
      parents.push(`series:${point.series}`);
      values.push(point.value);
    });
    return { type, ids, labels, parents, values, branchvalues: "total", marker: { colors: values.map((_, i) => color(i)) } };
  }

  function sunburstChart(data) { return { traces: [hierarchicalTrace(data, "sunburst")], layout: {} }; }
  function icicleChart(data) { return { traces: [hierarchicalTrace(data, "icicle")], layout: {} }; }

  function sankeyChart(data) {
    const points = cells(data).filter((point) => point.value > 0);
    const nodes = [...data.series, ...data.labels];
    const labelOffset = data.series.length;
    return { traces: [{ type: "sankey", node: { label: nodes, color: nodes.map((_, i) => color(i)), pad: 12, thickness: 14 }, link: { source: points.map((point) => point.seriesIndex), target: points.map((point) => labelOffset + point.labelIndex), value: points.map((point) => point.value) } }], layout: {} };
  }

  function bubbleTimeline(data) {
    const points = cells(data).filter((point) => point.value > 0);
    const max = safeMax(points.map((point) => point.value));
    return { traces: [{ type: "scatter", mode: "markers", x: points.map((p) => p.label), y: points.map((p) => p.series), text: points.map((p) => `${p.series} · ${p.label}: ${formatNumber(p.value)}`), marker: { size: points.map((p) => 8 + p.value / max * 42), color: points.map((p) => color(p.seriesIndex)), opacity: 0.7, line: { color: "white", width: 1 } } }], layout: { margin: { l: 110, b: 70 }, showlegend: false } };
  }

  function lollipopChart(data) {
    const totals = labelTotals(data).sort((a, b) => a.value - b.value);
    return { traces: [...totals.map((d) => ({ type: "scatter", mode: "lines", x: [0, d.value], y: [d.name, d.name], showlegend: false, line: { color: "#D0D0D0", width: 2 } })), { type: "scatter", mode: "markers+text", x: totals.map((d) => d.value), y: totals.map((d) => d.name), text: totals.map((d) => formatNumber(d.value)), textposition: "middle right", marker: { size: 13, color: totals.map((_, i) => color(i)) }, showlegend: false }], layout: { xaxis: { title: "합계" }, margin: { l: 110 } } };
  }

  function bumpChart(data) {
    const traces = data.series.map((series, seriesIndex) => {
      const ranks = data.labels.map((label, labelIndex) => {
        const ordered = data.series.map((name, rowIndex) => ({ name, value: data.values[rowIndex][labelIndex] })).sort((a, b) => b.value - a.value);
        return ordered.findIndex((item) => item.name === series) + 1;
      });
      return { type: "scatter", mode: "lines+markers", x: data.labels, y: ranks, name: series, line: { color: color(seriesIndex), width: 2 } };
    });
    return { traces, layout: { yaxis: { title: "순위", autorange: "reversed", dtick: 1 } } };
  }

  function bulletGraph(data) {
    const totals = labelTotals(data);
    const max = safeMax(totals.map((d) => d.value));
    const target = totals.reduce((sum, d) => sum + d.value, 0) / Math.max(totals.length, 1);
    return { traces: totals.map((item, i) => ({ type: "indicator", mode: "number+gauge", value: item.value, title: { text: item.name }, domain: { x: [0, 1], y: [1 - (i + 1) / totals.length, 1 - i / totals.length] }, gauge: { shape: "bullet", axis: { range: [0, max * 1.15] }, bar: { color: color(i) }, threshold: { line: { color: "#A44A3F", width: 2 }, value: target } } })), layout: { margin: { l: 90, r: 30, t: 60, b: 30 }, height: Math.max(390, totals.length * 82) } };
  }

  function pyramidChart(data) {
    const secondIndex = Math.min(1, data.series.length - 1);
    return { traces: [{ type: "bar", orientation: "h", y: data.labels, x: data.values[0].map((v) => -Math.abs(v)), name: data.series[0], marker: { color: color(0) } }, { type: "bar", orientation: "h", y: data.labels, x: data.values[secondIndex].map((v) => Math.abs(v)), name: data.series[secondIndex], marker: { color: color(1) } }], layout: { barmode: "relative", xaxis: { title: "좌우 비교" }, margin: { l: 110 } } };
  }

  function marimekkoChart(data) {
    const totals = labelTotals(data);
    const totalSum = totals.reduce((sum, d) => sum + d.value, 0) || 1;
    let left = 0;
    const traces = [];
    data.labels.forEach((label, labelIndex) => {
      const width = Math.max((totals[labelIndex]?.value || 0) / totalSum, 0.01);
      let bottom = 0;
      const columnTotal = totals[labelIndex]?.value || 1;
      data.series.forEach((series, seriesIndex) => {
        const height = data.values[seriesIndex][labelIndex] / columnTotal;
        traces.push({ type: "bar", x: [left + width / 2], y: [height], width: [width], base: bottom, name: series, legendgroup: series, showlegend: labelIndex === 0, marker: { color: color(seriesIndex) }, hovertext: `${series} · ${label}: ${formatNumber(data.values[seriesIndex][labelIndex])}` });
        bottom += height;
      });
      left += width;
    });
    return { traces, layout: { barmode: "stack", xaxis: { tickvals: [], title: "라벨별 전체 비중" }, yaxis: { title: "구성비", tickformat: ".0%" } } };
  }
}());
