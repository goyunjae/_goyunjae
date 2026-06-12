(function () {
  if (typeof window.chartSpecs !== "function") return;

  const ALL = "전체";
  const themes = [
    ["Mint", ["#45B8AC", "#B8E6A3", "#2F95B8", "#2D64A8", "#F2B75E", "#E56F76"]],
    ["Ocean", ["#1CA7A8", "#76D7C4", "#247BA0", "#173F5F", "#F6D55C", "#ED553B"]],
    ["Forest", ["#2E7D32", "#81C784", "#A5D6A7", "#546E7A", "#F9A825", "#D84315"]],
    ["Sunset", ["#FF6B6B", "#FFD166", "#F4A261", "#2A9D8F", "#264653", "#8E7AD8"]],
    ["Nord", ["#5E81AC", "#88C0D0", "#A3BE8C", "#EBCB8B", "#D08770", "#B48EAD"]],
    ["Berry", ["#7B2CBF", "#C77DFF", "#FF4D6D", "#FFB3C1", "#00B4D8", "#90E0EF"]],
    ["Slate", ["#334E68", "#627D98", "#9FB3C8", "#38B2AC", "#F6AD55", "#E53E3E"]],
    ["Pastel", ["#8FD6C8", "#B8E6A3", "#9BD7E8", "#F2B75E", "#D88C9A", "#8E7AD8"]],
    ["Bold", ["#006D77", "#83C5BE", "#FFDDD2", "#E29578", "#2D64A8", "#F2B75E"]],
    ["Clean", ["#2F95B8", "#7FC8A9", "#C9EFB7", "#5E6C84", "#F2B75E", "#E56F76"]],
  ].map(([name, colors]) => ({ name, colors }));
  let theme = themes[0];
  const previous = window.chartSpecs;
  const wanted = [
    ["BAR", "그룹 막대"],
    ["BAR", "누적 막대"],
    ["LINE", "기본 추이"],
    ["AREA", "누적 면적"],
    ["SCATTER", "버블 산점"],
    ["PIE", "도넛"],
    ["HEATMAP", "주석 매트릭스"],
    ["RANGE", "범위 밴드"],
    ["RADIAL", "Gauge Cards"],
    ["TEXT", "Word Cloud"],
  ];

  window.chartSpecs = function chartSpecs() {
    const source = previous().map(normalize);
    const specs = wanted.map(([group, label], index) => {
      if (group === "TEXT") return { group, number: index + 1, label, build: wordCloud };
      const found = source.find((item) => item.group === group && item.label === label);
      return found ? { ...found, number: index + 1 } : null;
    }).filter(Boolean);
    return [
      ...specs.map((item, index) => ({ ...item, group: ALL, number: index + 1, label: `${item.group} · ${item.label}` })),
      ...specs,
    ];
  };

  window.addEventListener("DOMContentLoaded", () => {
    injectStyle();
    installThemePicker();
    setTimeout(cleanSelect, 20);
  });

  function normalize(item) {
    const mapped = item.group === "VIZZLO" && item.label === "Gauge Cards";
    return {
      ...item,
      group: mapped ? "RADIAL" : item.group,
      number: mapped ? 9 : item.number,
      build: (data) => styleChart(item.build(data)),
    };
  }

  function installThemePicker() {
    const anchor = document.querySelector("#chartGroup")?.closest(".field");
    if (!anchor || document.querySelector("#themeSelect")) return;
    const field = document.createElement("div");
    field.className = "field theme-field";
    field.innerHTML = '<label for="themeSelect">색상 테마</label><select id="themeSelect"></select><div id="themeSwatches" class="theme-swatches" aria-hidden="true"></div>';
    anchor.insertAdjacentElement("afterend", field);
    const select = field.querySelector("#themeSelect");
    themes.forEach((item, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = item.name;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      theme = themes[Number(select.value)] || themes[0];
      renderSwatches();
      if (document.querySelectorAll(".chart-card").length) document.querySelector("#generateBtn")?.click();
    });
    renderSwatches();
  }

  function renderSwatches() {
    const box = document.querySelector("#themeSwatches");
    if (!box) return;
    box.innerHTML = theme.colors.map((color) => `<span style="background:${color}"></span>`).join("");
  }

  function cleanSelect() {
    const select = document.querySelector("#chartGroup");
    if (!select) return;
    [...select.options].forEach((option) => {
      if (["ALL", "VIZZLO"].includes(option.value) || option.textContent === "VIZZLO") option.remove();
    });
    if (["ALL", "VIZZLO"].includes(select.value)) select.value = "";
  }

  function styleChart(chart) {
    const layout = chart.layout || {};
    return {
      traces: (chart.traces || []).map(styleTrace),
      layout: {
        ...layout,
        paper_bgcolor: "#ffffff",
        plot_bgcolor: "#ffffff",
        colorway: theme.colors,
        font: { family: "Malgun Gothic, Apple SD Gothic Neo, Noto Sans KR, Arial", color: "#21313A" },
        hoverlabel: { bgcolor: "#21313A", bordercolor: "#21313A", font: { color: "#ffffff" } },
        legend: { orientation: "h", x: 0, y: -0.22, font: { size: 10, color: "#5E6C84" }, ...(layout.legend || {}) },
        xaxis: axis(layout.xaxis),
        yaxis: axis(layout.yaxis),
      },
    };
  }

  function styleTrace(trace, index) {
    const next = { ...trace };
    const color = theme.colors[index % theme.colors.length];
    if (["bar", "waterfall", "barpolar"].includes(next.type)) {
      next.marker = { ...(next.marker || {}), color: colorsFor(next, index), line: { color: "#ffffff", width: 1 } };
    }
    if (["scatter", "scatterpolar"].includes(next.type)) {
      next.line = { ...(next.line || {}), color, width: next.line?.width || 2.4 };
      next.marker = { ...(next.marker || {}), color: colorsFor(next, index), size: next.marker?.size || 9, line: { color: "#ffffff", width: 1 } };
    }
    if (next.type === "pie") {
      next.marker = { ...(next.marker || {}), colors: pieColors(next.marker?.colors), line: { color: "#ffffff", width: 2 } };
      next.textinfo = next.textinfo || "label+percent";
    }
    if (next.type === "heatmap") {
      next.colorscale = [[0, "#F7FCFB"], [0.35, "#DDF3EC"], [0.7, theme.colors[1]], [1, theme.colors[0]]];
    }
    if (next.type === "indicator" && next.gauge) {
      next.gauge = { ...next.gauge, bar: { ...(next.gauge.bar || {}), color }, bgcolor: "#F4FAF8" };
    }
    return next;
  }

  function colorsFor(trace, index) {
    const count = Array.isArray(trace.x) ? trace.x.length : Array.isArray(trace.y) ? trace.y.length : 0;
    if (count > 1 && Array.isArray(trace.marker?.color)) {
      return trace.marker.color.map((_, colorIndex) => theme.colors[(index + colorIndex) % theme.colors.length]);
    }
    return theme.colors[index % theme.colors.length];
  }

  function pieColors(colors) {
    if (!Array.isArray(colors)) return theme.colors;
    return colors.map((color, index) => String(color).includes("rgba(0,0,0,0)") ? color : theme.colors[index % theme.colors.length]);
  }

  function axis(axisLayout = {}) {
    return {
      showline: true,
      linecolor: "#B8C8C5",
      gridcolor: "#E5F0EE",
      zerolinecolor: "#C8D6D3",
      tickfont: { size: 10, color: "#5E6C84" },
      titlefont: { size: 11, color: "#21313A" },
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
    const points = words.map((_, index) => spiral(index));
    return {
      traces: [{
        type: "scatter", mode: "text", x: points.map((p) => p.x), y: points.map((p) => p.y),
        text: words.map((item) => item.text),
        textfont: { size: words.map((item) => 14 + (item.value / max) * 34), color: words.map((_, index) => theme.colors[index % theme.colors.length]) },
        hovertext: words.map((item) => `${item.text}: ${Number(item.value).toLocaleString("ko-KR")}`),
        hoverinfo: "text", showlegend: false,
      }],
      layout: { xaxis: { visible: false }, yaxis: { visible: false, scaleanchor: "x" }, margin: { l: 20, r: 20, t: 55, b: 20 } },
    };
  }

  function spiral(index) {
    if (index === 0) return { x: 0, y: 0 };
    const angle = index * 2.399963;
    const radius = 0.12 * Math.sqrt(index);
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  function injectStyle() {
    if (document.querySelector("#chart-theme-style")) return;
    const style = document.createElement("style");
    style.id = "chart-theme-style";
    style.textContent = '.theme-field{gap:8px}.theme-swatches{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:4px}.theme-swatches span{height:22px;border-radius:3px;border:1px solid rgba(22,34,45,.14);box-shadow:inset 0 -7px 12px rgba(0,0,0,.08)}';
    document.head.appendChild(style);
  }
}());
